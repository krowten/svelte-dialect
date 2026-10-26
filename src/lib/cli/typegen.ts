/**
 * `svelte-dialect typegen` — turns the message catalog into a .d.ts:
 *
 *   export type MessageKey = 'home:title' | 'home:greeting' | …;
 *   export type MessageParams = { 'home:greeting': { name: number | string }; … };
 *
 * `MessageKey` is meant for `createDialect<MessageKey>(…)`; `MessageParams` is a reference type —
 * parameter names and best-effort types extracted from the MF2 sources, for consumers who want to
 * wrap `t` more strictly than the library does by default.
 *
 * Types are a snapshot of the catalog at generation time. For build-time messages that is exact;
 * for keys living in a database, `--from-json` types whatever dump you hand it — regenerate when
 * the dump changes, or stay with the open `string` default and lose nothing at runtime.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { parseMessage, visit } from 'messageformat';
import type { Model } from 'messageformat';
import { readCatalogDirs, readCatalogJson, allKeys } from './catalog.js';
import type { SourceCatalog } from './catalog.js';

/** What an MF2 function annotation says about the value a caller must pass. */
const PARAM_TYPES: Record<string, string> = {
	number: 'number | string',
	integer: 'number | string',
	offset: 'number | string',
	currency: 'number | string',
	percent: 'number | string',
	unit: 'number | string',
	date: 'Date | number | string',
	datetime: 'Date | number | string',
	time: 'Date | number | string',
	string: 'string'
};

/** `{ name: 'unknown', count: 'number | string' }` for one message source; {} when it has no params. */
export const extractParams = (source: string): Record<string, string> => {
	// null prototype: on a plain object, assigning `params.__proto__` swaps the prototype instead of
	// recording a param
	const params: Record<string, string> = Object.create(null);
	// every MF2 variable sits inside braces, so a source without one has none — skips the parser
	if (!source.includes('{')) return params;
	let message;
	try {
		message = parseMessage(source);
	} catch {
		return params; // invalid MF2 renders as its key at runtime; nothing to type
	}

	// `.local $greeting = {$name :string}` computes `$greeting` from the message itself — a caller
	// never passes it, so it must not show up as an external param even though it's a variable
	// reference like any other. `.input` declarations don't get the same treatment: they still name
	// an external param, just an annotated one.
	const locals = new Set(message.declarations.filter((d) => d.type === 'local').map((d) => d.name));

	// `name in params` would be true for "constructor" or "toString" via Object.prototype even
	// before this message ever mentioned them, silently skipping real params with those names.
	const note = (name: string, type: string) => {
		if (locals.has(name)) return;
		if (!Object.hasOwn(params, name) || params[name] === 'unknown') params[name] = type;
	};

	const noteValue = (value: Model.Literal | Model.VariableRef, type: string) => {
		if (value.type === 'variable') note(value.name, type);
	};

	visit(message, {
		// The declaration's own expression is visited here too (context: 'declaration'), so a
		// `.local`'s dependencies are still picked up — just filtered out if the dependency is itself
		// another local.
		expression: (expr) => {
			const fn = expr.functionRef?.name;
			const type = fn ? (PARAM_TYPES[fn] ?? 'unknown') : 'unknown';
			if (expr.arg) noteValue(expr.arg, type);
			// A function option's value can itself be a variable (`:currency currency=$code`) — its
			// type isn't in PARAM_TYPES because the option's own annotation, if any, applies to a
			// different function than the one governing this expression.
			for (const value of Object.values(expr.functionRef?.options ?? {}))
				noteValue(value, 'unknown');
		},
		// Markup options (`{#link to=$href}`) are a separate node kind from expressions and were
		// never visited at all before, so a variable used only there had no required param.
		markup: (markup) => {
			for (const value of Object.values(markup.options ?? {})) noteValue(value, 'unknown');
		}
	});
	return params;
};

// JSON.stringify already escapes backslashes and every control character (newline, CR, tab, …) the
// way a JS string literal needs; it just quotes with `"` and doesn't escape `'`, so both get
// adjusted for our single-quoted output style. A hand-rolled regex that only covered `\` and `'`
// left a literal newline in a key free to break the closing quote of the generated .d.ts.
const quote = (key: string) =>
	`'${JSON.stringify(key).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

// quote a property name only when it isn't a plain identifier — prettier strips needless quotes,
// and the generated file has to survive a format pass unchanged
const propertyName = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name));

export const renderTypes = (catalog: SourceCatalog): string => {
	const keys = [...allKeys(catalog)].sort();

	// merge param shapes across locales: translators may annotate in one locale and not another
	const paramsByKey = new Map<string, Record<string, string>>();
	for (const namespaces of Object.values(catalog)) {
		for (const [ns, messages] of Object.entries(namespaces)) {
			for (const [path, source] of Object.entries(messages)) {
				const key = `${ns}:${path}`;
				const merged = paramsByKey.get(key) ?? Object.create(null);
				for (const [name, type] of Object.entries(extractParams(source))) {
					if (!Object.hasOwn(merged, name) || merged[name] === 'unknown') merged[name] = type;
				}
				paramsByKey.set(key, merged);
			}
		}
	}

	// One member per line, prettier's own shape for a long union — the generated file must survive
	// a format pass byte-identical, or a freshness check in CI (regenerate && git diff) cries wolf.
	const keyUnion = keys.length ? `\n${keys.map((k) => `\t| ${quote(k)}`).join('\n')}` : ' never';
	const paramLines = keys
		.filter((key) => Object.keys(paramsByKey.get(key) ?? {}).length > 0)
		.map((key) => {
			const shape = Object.entries(paramsByKey.get(key)!)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([name, type]) => `${propertyName(name)}: ${type}`)
				.join('; ');
			return `\t${quote(key)}: { ${shape} };`;
		});

	return `// Generated by \`svelte-dialect typegen\`. Do not edit — regenerate instead.

/** Every message key the catalog knows. Use it as \`createDialect<MessageKey>(…)\`. */
export type MessageKey =${keyUnion};

/** Parameter shapes per key, extracted from the MF2 sources — keys without parameters are absent. */
export type MessageParams = {
${paramLines.join('\n')}
};
`;
};

export const runTypegen = async (argv: string[]): Promise<number> => {
	const { values } = parseArgs({
		args: argv,
		options: {
			messages: { type: 'string', multiple: true, default: ['src/lib/messages'] },
			'from-json': { type: 'string' },
			out: { type: 'string', default: 'src/lib/i18n-keys.d.ts' }
		}
	});

	const catalog = values['from-json']
		? await readCatalogJson(values['from-json'])
		: await readCatalogDirs(values.messages!);

	const keyCount = allKeys(catalog).size;
	await mkdir(dirname(values.out!), { recursive: true });
	await writeFile(values.out!, renderTypes(catalog));
	console.log(`svelte-dialect typegen: ${keyCount} keys → ${values.out}`);
	return 0;
};
