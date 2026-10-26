/**
 * `svelte-dialect migrate` — rewrites i18next / ICU MessageFormat catalogs as MF2, in place.
 *
 * The command is meant to be run once, on someone else's message files, and then reviewed in a
 * diff. That shapes every decision here: nothing is converted unless the result parses as MF2
 * (every produced source goes through `new MessageFormat(locale, …)` before it is kept), and
 * anything the parser does not fully understand is left exactly as it was, with a warning naming
 * the file and the key. A catalog that comes out of `migrate` unchanged is a catalog that needs a
 * human, not a silently mangled one.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { MessageFormat } from 'messageformat';
import { DraftFunctions } from 'messageformat/functions';
import { MESSAGE_PATH, legacyLocaleFolder } from '../message-path.js';
import { isDirectory, parseJsonFile } from './catalog.js';

/** ICU `{n, number, integer}` and i18next `{{n, number}}` styles we can name in MF2. */
const NUMBER_STYLES: Record<string, string> = {
	integer: 'integer',
	percent: 'percent',
	currency: 'currency'
};

/**
 * ICU date and time styles → `:date` / `:time` options, each one checked by formatting it with the
 * functions the runtime registers (`DraftFunctions`). `:date` has no `full` length, so `full` asks
 * for the weekday field instead; `:time` has no style at all, only a precision and a time-zone
 * name, so the styles are spelled out from those.
 */
const DATE_STYLES: Record<string, string> = {
	short: 'date length=short',
	medium: 'date length=medium',
	long: 'date length=long',
	full: 'date fields=year-month-day-weekday length=long'
};
const TIME_STYLES: Record<string, string> = {
	short: 'time',
	medium: 'time precision=second',
	long: 'time precision=second timeZoneStyle=short',
	full: 'time precision=second timeZoneStyle=long'
};

/** `{n, number, ::percent}` — the only ICU number skeleton `:percent` covers on its own. */
const NUMBER_SKELETONS: Record<string, string> = { '::percent': 'percent' };

/** i18next interpolation formats → MF2 functions. The rest is left to a human. */
const I18NEXT_FORMATS: Record<string, string> = {
	number: 'number',
	integer: 'integer',
	currency: 'currency',
	percent: 'percent',
	date: 'date',
	time: 'time',
	datetime: 'datetime',
	unit: 'unit'
};

/** i18next plural suffixes, in the order the MF2 variants should come out. */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

const PLURAL_SUFFIX = new RegExp(`^(.+)_(${PLURAL_CATEGORIES.join('|')})$`);

/** i18next keeps ordinal plurals under `<key>_ordinal_<category>`; the collapsed base ends in `_ordinal`. */
const ORDINAL_BASE = /^.+_ordinal$/;

/** `<b>`, `</b>`, `<br/>`, `<br />` — a tag name with nothing else in it. */
const PLAIN_TAG = /<(\/?)([A-Za-z][A-Za-z0-9]*)\s*(\/?)>/g;

/** `<a href="…">` — an opening tag that carries attributes, which MF2 markup cannot. */
const ATTRIBUTE_TAG = /<([A-Za-z][A-Za-z0-9]*)\s+(?!\/?>)[^<>]*>/g;

const VOID_TAGS = new Set(['br', 'hr', 'wbr']);

/** A message with more variants than this is a modelling mistake, not a translation. */
const MAX_VARIANTS = 64;

type Node =
	| { kind: 'text'; value: string }
	| { kind: 'arg'; name: string; fn?: string }
	| { kind: 'markup'; value: string }
	| { kind: 'select'; name: string; fn: string; options?: string; arms: [string, Node[]][] };

type Cursor = {
	src: string;
	i: number;
	warn: (reason: string) => void;
	/** Tag names that appear with attributes somewhere in the message; none of their tags are converted. */
	attributed: Set<string>;
	/** Attribute-less tags turned into MF2 markup, shared by every cursor of one message. */
	converted: Set<string>;
};

const newCursor = (
	src: string,
	warn: (reason: string) => void,
	converted: Set<string>
): Cursor => ({
	src,
	i: 0,
	warn,
	attributed: new Set([...src.matchAll(ATTRIBUTE_TAG)].map((m) => m[1])),
	converted
});

/** Splits a text run around the tags that convert cleanly; everything else stays text. */
const pushText = (c: Cursor, nodes: Node[], text: string) => {
	let last = 0;
	for (const m of text.matchAll(PLAIN_TAG)) {
		const [raw, closing, name, selfClosing] = m;
		if (c.attributed.has(name)) continue;
		if (m.index > last) nodes.push({ kind: 'text', value: text.slice(last, m.index) });
		last = m.index + raw.length;
		c.converted.add(raw);
		const standalone = selfClosing || (!closing && VOID_TAGS.has(name));
		nodes.push({
			kind: 'markup',
			value: closing ? `/${name}` : standalone ? `#${name}/` : `#${name}`
		});
	}
	if (last < text.length) nodes.push({ kind: 'text', value: text.slice(last) });
};

/* -------------------------------------------------------------------------- parsing */

/**
 * A recursive-descent parser for the ICU / i18next subset real catalogs are written in: plain
 * arguments, `number`/`date`/`time`, `plural`, `selectordinal`, `select`, `#`, apostrophe
 * escaping, and i18next's `{{name}}` / `{{name, format}}`. Not the full ICU grammar — no offsets,
 * no skeletons, no `spellout`/`duration`. Whatever falls outside throws, and the caller keeps the
 * original string. Regex cannot do this: plural arms nest.
 */
const parsePattern = (c: Cursor, plural: string | undefined, nested: boolean): Node[] => {
	const nodes: Node[] = [];
	let text = '';
	const flush = () => {
		if (text) pushText(c, nodes, text);
		text = '';
	};

	while (c.i < c.src.length) {
		const ch = c.src[c.i];
		if (ch === '}') {
			if (nested) break;
			throw new Error('unbalanced "}"');
		}
		if (ch === '{') {
			flush();
			nodes.push(c.src[c.i + 1] === '{' ? parseI18next(c) : parseIcu(c, plural));
			continue;
		}
		if (ch === '#' && plural) {
			flush();
			nodes.push({ kind: 'arg', name: plural, fn: 'number' });
			c.i++;
			continue;
		}
		if (ch === "'") {
			text += parseQuoted(c);
			continue;
		}
		text += ch;
		c.i++;
	}
	if (nested && c.src[c.i] !== '}') throw new Error('unterminated arm');
	flush();
	return nodes;
};

/** ICU apostrophe escaping: `''` is a literal quote, `'{'` quotes the syntax characters. */
const parseQuoted = (c: Cursor): string => {
	const next = c.src[c.i + 1];
	if (next === "'") {
		c.i += 2;
		return "'";
	}
	if (next !== '{' && next !== '}' && next !== '#' && next !== '|') {
		c.i++;
		return "'";
	}
	c.i++;
	let out = '';
	while (c.i < c.src.length) {
		if (c.src[c.i] === "'") {
			if (c.src[c.i + 1] === "'") {
				out += "'";
				c.i += 2;
				continue;
			}
			c.i++;
			return out;
		}
		out += c.src[c.i++];
	}
	return out; // an unclosed quote runs to the end of the message, as in ICU
};

const skipSpace = (c: Cursor) => {
	while (c.i < c.src.length && /\s/.test(c.src[c.i])) c.i++;
};

const readUntil = (c: Cursor, stop: string): string => {
	const start = c.i;
	while (c.i < c.src.length && !stop.includes(c.src[c.i])) c.i++;
	return c.src.slice(start, c.i).trim();
};

const checkName = (name: string): string => {
	if (!name || /[{}#|\s]/.test(name)) throw new Error(`malformed placeholder name "${name}"`);
	return name;
};

/** `{{name}}`, `{{name, number}}`, `{{- name}}` (i18next's unescaped form). */
const parseI18next = (c: Cursor): Node => {
	const end = c.src.indexOf('}}', c.i + 2);
	if (end === -1) throw new Error('unterminated "{{"');
	const body = c.src.slice(c.i + 2, end);
	if (/[{}]/.test(body)) throw new Error('malformed "{{…}}" placeholder');
	c.i = end + 2;

	const parts = body.split(',').map((p) => p.trim());
	const name = checkName(parts[0].replace(/^-\s*/, ''));
	if (parts.length === 1) return { kind: 'arg', name };
	if (parts.length > 2 || /[()]/.test(parts[1]))
		throw new Error(`unsupported i18next format "${parts.slice(1).join(',')}"`);
	const fn = I18NEXT_FORMATS[parts[1].toLowerCase()];
	if (!fn) {
		// a custom formatter has no MF2 counterpart; the value itself is still worth keeping
		c.warn(
			`format "${parts[1]}" dropped from "{{${body.trim()}}}" — "${name}" is now a plain {$${name}}`
		);
		return { kind: 'arg', name };
	}
	return { kind: 'arg', name, fn: annotate(c, name, fn) };
};

/** `:currency` refuses to format without a code, and neither ICU nor i18next carried one here. */
const annotate = (c: Cursor, name: string, fn: string): string => {
	if (fn === 'currency')
		c.warn(
			`"${name}" became :currency, which needs a code — write {$${name} :currency currency=EUR} or pass one at runtime`
		);
	return fn;
};

const parseIcu = (c: Cursor, plural: string | undefined): Node => {
	c.i++; // '{'
	const name = checkName(readUntil(c, ',}'));
	if (c.src[c.i] === '}') {
		c.i++;
		return { kind: 'arg', name };
	}
	if (c.src[c.i] !== ',') throw new Error(`unterminated "{${name}"`);
	c.i++;
	const type = readUntil(c, ',}').toLowerCase();

	if (c.src[c.i] === '}') {
		c.i++;
		if (type === 'number' || type === 'date' || type === 'time')
			return { kind: 'arg', name, fn: type };
		throw new Error(`unsupported ICU type "${type}"`);
	}
	if (c.src[c.i] !== ',') throw new Error(`unterminated "{${name}, ${type}"`);
	c.i++;

	if (type === 'plural' || type === 'selectordinal' || type === 'select') {
		const ordinal = type === 'selectordinal';
		const numeric = type !== 'select';
		const arms = parseArms(c, numeric ? name : plural, numeric);
		if (ordinal)
			c.warn(
				`"${name}" used ICU selectordinal — converted to ":number select=ordinal"; MF2 ordinal categories can differ, review the arms`
			);
		return {
			kind: 'select',
			name,
			fn: numeric ? 'number' : 'string',
			options: ordinal ? 'select=ordinal' : undefined,
			arms
		};
	}

	if (type === 'number' || type === 'date' || type === 'time') {
		const style = readStyle(c);
		const key = style.toLowerCase();
		const mapped =
			type === 'number'
				? (NUMBER_STYLES[key] ?? NUMBER_SKELETONS[key])
				: (type === 'date' ? DATE_STYLES : TIME_STYLES)[key];
		if (!mapped) c.warn(`style "${style}" dropped from "{${name}, ${type}, ${style}}"`);
		return { kind: 'arg', name, fn: annotate(c, name, mapped ?? type) };
	}

	throw new Error(`unsupported ICU type "${type}"`);
};

/** The style of `{n, number, …}` — consumed verbatim up to the closing brace. */
const readStyle = (c: Cursor): string => {
	const start = c.i;
	let depth = 0;
	while (c.i < c.src.length) {
		const ch = c.src[c.i];
		if (ch === '{') depth++;
		else if (ch === '}') {
			if (depth === 0) {
				const style = c.src.slice(start, c.i).trim();
				c.i++;
				return style;
			}
			depth--;
		}
		c.i++;
	}
	throw new Error('unterminated argument');
};

const parseArms = (c: Cursor, plural: string | undefined, numeric: boolean): [string, Node[]][] => {
	const arms: [string, Node[]][] = [];
	for (;;) {
		skipSpace(c);
		if (c.i >= c.src.length) throw new Error('unterminated arms');
		if (c.src[c.i] === '}') {
			c.i++;
			break;
		}
		const raw = readUntil(c, '{}');
		if (!raw) throw new Error('missing arm key');
		if (raw.startsWith('offset:')) throw new Error('plural offset is not supported');
		if (c.src[c.i] !== '{') throw new Error(`malformed arm "${raw}"`);
		c.i++;
		const nodes = parsePattern(c, plural, true);
		if (c.src[c.i] !== '}') throw new Error(`unterminated arm "${raw}"`);
		c.i++;
		arms.push([armKey(raw, numeric), nodes]);
	}
	if (!arms.some(([key]) => key === '*')) throw new Error('no "other" arm');
	return arms;
};

/** ICU arm key → MF2 variant key: `other` is the catch-all `*`, `=N` an exact number. */
const armKey = (raw: string, numeric: boolean): string => {
	if (raw === 'other') return '*';
	if (raw.startsWith('=')) {
		const n = raw.slice(1);
		if (!/^-?\d+(\.\d+)?$/.test(n)) throw new Error(`malformed exact arm key "${raw}"`);
		return n;
	}
	if (numeric && !/^(zero|one|two|few|many)$/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw))
		throw new Error(`unknown plural arm key "${raw}"`);
	return raw;
};

/* ----------------------------------------------------------------------- generating */

const escapeText = (value: string) => value.replace(/([\\{}])/g, '\\$1');

/** MF2 variant keys are names or numbers; anything else has to be a quoted literal. */
const variantKey = (key: string) =>
	key === '*' || /^[A-Za-z0-9_][A-Za-z0-9_.+-]*$/.test(key)
		? key
		: `|${key.replace(/([\\|])/g, '\\$1')}|`;

type Selector = { name: string; fn: string; options?: string; keys: string[]; varName: string };

/** Distinguishes two selectors over the same source variable but a different function/options — a cardinal and an ordinal use of the same ICU variable are not the same selector. */
const selectorIdentity = (name: string, fn: string, options?: string) =>
	`${name}\0${fn}\0${options ?? ''}`;

/** Every selector in the message, in first-appearance order, with the union of its arm keys. */
const collectSelectors = (nodes: Node[], out = new Map<string, Selector>()): Selector[] => {
	for (const node of nodes) {
		if (node.kind !== 'select') continue;
		const id = selectorIdentity(node.name, node.fn, node.options);
		const selector = out.get(id) ?? {
			name: node.name,
			fn: node.fn,
			options: node.options,
			keys: [],
			varName: ''
		};
		for (const [key] of node.arms)
			if (key !== '*' && !selector.keys.includes(key)) selector.keys.push(key);
		out.set(id, selector);
		for (const [, arm] of node.arms) collectSelectors(arm, out);
	}
	const selectors = [...out.values()];
	// Every selector needs a distinct MF2 variable name to `.match` on. The first use of a source
	// variable keeps its name via `.input`; a second selector over the same variable (different
	// function/options — same name would already have merged above) gets a numbered alias declared
	// with `.local`, derived from the same external variable.
	const seen = new Map<string, number>();
	for (const s of selectors) {
		const n = (seen.get(s.name) ?? 0) + 1;
		seen.set(s.name, n);
		s.varName = n === 1 ? s.name : `${s.name}_${n}`;
	}
	return selectors;
};

/**
 * MF2 has one `.match` per message, so nested ICU selects flatten into extra selectors: the
 * variants are the cartesian product, each rendered by walking the tree with those keys chosen.
 */
const pickArm = (node: Node & { kind: 'select' }, key: string, locale: string): Node[] => {
	const exact = node.arms.find(([k]) => k === key);
	if (exact) return exact[1];
	if (/^-?\d+(\.\d+)?$/.test(key)) {
		// an exact `=1` on the outside can still mean `one` for an inner select
		try {
			const type = node.options === 'select=ordinal' ? 'ordinal' : 'cardinal';
			const category = new Intl.PluralRules(locale, { type }).select(Number(key));
			const byCategory = node.arms.find(([k]) => k === category);
			if (byCategory) return byCategory[1];
		} catch {
			// an unusable locale tag just falls through to the catch-all
		}
	}
	return node.arms.find(([k]) => k === '*')![1];
};

const renderPattern = (
	nodes: Node[],
	chosen: Map<string, string>,
	selectors: Selector[],
	locale: string
): string =>
	nodes
		.map((node) => {
			if (node.kind === 'text') return escapeText(node.value);
			if (node.kind === 'markup') return `{${node.value}}`;
			if (node.kind === 'select') {
				const id = selectorIdentity(node.name, node.fn, node.options);
				return renderPattern(pickArm(node, chosen.get(id)!, locale), chosen, selectors, locale);
			}
			// a selector is already annotated by its `.input`; repeating the function only adds noise.
			// Only the canonical (first, `.input`-declared) selector for this variable counts here — a
			// plain `{$n}` reference always means the original external variable, never a `.local` alias.
			const declared = selectors.find((s) => s.name === node.name && s.varName === s.name);
			const fn = declared?.fn === node.fn ? undefined : node.fn;
			return fn ? `{$${node.name} :${fn}}` : `{$${node.name}}`;
		})
		.join('');

const build = (nodes: Node[], locale: string): string => {
	const selectors = collectSelectors(nodes);
	if (!selectors.length) {
		const pattern = renderPattern(nodes, new Map(), selectors, locale);
		// a simple message may not start with a '.', or MF2 reads it as a declaration
		return pattern.startsWith('.') ? `{{${pattern}}}` : pattern;
	}

	const keyLists = selectors.map((s) => [...s.keys, '*']);
	const total = keyLists.reduce((n, keys) => n * keys.length, 1);
	if (total > MAX_VARIANTS) throw new Error(`${total} variant combinations is too many`);

	let combos: string[][] = [[]];
	for (const keys of keyLists)
		combos = combos.flatMap((combo) => keys.map((key) => [...combo, key]));

	const lines = selectors.map((s) => {
		const annotation = `:${s.fn}${s.options ? ` ${s.options}` : ''}`;
		// The canonical selector for a variable is the real external input; any further selector
		// sharing its name (cardinal + ordinal on the same ICU variable, say) has to be a `.local`
		// alias instead — MF2 can't declare the same `.input` name twice.
		return s.varName === s.name
			? `.input {$${s.name} ${annotation}}`
			: `.local $${s.varName} = {$${s.name} ${annotation}}`;
	});
	lines.push(`.match ${selectors.map((s) => `$${s.varName}`).join(' ')}`);
	for (const combo of combos) {
		const chosen = new Map(
			selectors.map((s, i) => [selectorIdentity(s.name, s.fn, s.options), combo[i]])
		);
		const keys = combo.map(variantKey).join(' ');
		lines.push(`${keys} {{${renderPattern(nodes, chosen, selectors, locale)}}}`);
	}
	return lines.join('\n');
};

/* -------------------------------------------------------------------------- pipeline */

/**
 * Sources already written in MF2 are left alone — migration must be safe to run twice. A message
 * with no declarations and no `{$…}` placeholder can still be MF2 output: plain text this command
 * itself produced by escaping a literal backslash or brace (`escapeText`). Recognising `\\`, `\{`
 * and `\}` — the exact sequences that function produces and nothing else has reason to — catches
 * that case without a second, format-guessing parse. `parseMessage` succeeding is not enough on its
 * own: an unconverted ICU/plain string can happen to parse as valid (if wrong) MF2 too.
 */
const isMf2 = (source: string) =>
	/^\s*\.(input|match|local)\b/.test(source) ||
	// a message starting with a dot, which this command wraps in `{{…}}` to keep it a pattern
	/^\{\{\./.test(source) ||
	source.includes('{$') ||
	// markup this command wrote; a bare `{#st}` is an ICU plural arm, so it needs a closing partner
	/\{\/[A-Za-z]|\{#[A-Za-z][\w-]*\/\}/.test(source) ||
	/\\[\\{}]/.test(source);

type Converted = { source?: string; warnings: string[] };

/** i18next nesting survives conversion as plain text, so it is worth a warning on every run. */
const nestingWarning = (sources: string[]): string[] =>
	sources.some((s) => s.includes('$t('))
		? [
				'i18next nesting "$t(…)" has no MF2 equivalent — pass the other translation in as a parameter, or split the message'
			]
		: [];

/** Tags with attributes cannot become MF2 markup, so they stay in the text. */
const keptTagWarning = (sources: string[]): string[] => {
	const tags = new Set(sources.flatMap((s) => [...s.matchAll(ATTRIBUTE_TAG)].map((m) => m[0])));
	return tags.size
		? [
				`HTML ${[...tags].join(', ')} left as text — markup carries no attributes. Write {#name}…{/name}, render it with the Rich component and set the attributes in its snippet`
			]
		: [];
};

const convertedTagWarning = (tags: Set<string>): string[] =>
	tags.size
		? [
				`HTML ${[...tags].join(', ')} converted to MF2 markup ({#name}…{/name}) — render it with the Rich component`
			]
		: [];

/** One source string → MF2, or `{}` when it is unconvertible or already fine as it is. */
const convert = (source: string, locale: string): Converted => {
	const warnings = nestingWarning([source]);
	if (!source || isMf2(source)) return { warnings };
	const tags = new Set<string>();
	const result = convertNodes(
		() =>
			parsePattern(
				newCursor(source, (w) => warnings.push(w), tags),
				undefined,
				false
			),
		source,
		locale,
		warnings
	);
	warnings.push(...keptTagWarning([source]));
	if (result.source) warnings.push(...convertedTagWarning(tags));
	return result;
};

const convertNodes = (
	parse: () => Node[],
	original: string,
	locale: string,
	warnings: string[]
): Converted => {
	let produced: string;
	try {
		produced = build(parse(), locale);
	} catch (error) {
		warnings.push(error instanceof Error ? error.message : String(error));
		return { warnings };
	}
	try {
		// the same function set the runtime registers, so an option it would reject is caught here
		new MessageFormat(locale, produced, { functions: DraftFunctions });
	} catch (error) {
		// the safety net: an unparseable result is a bug in this command, never something we write
		warnings.push(
			`produced invalid MF2 (${error instanceof Error ? error.message : error}), left unchanged`
		);
		return { warnings };
	}
	return { source: produced === original ? undefined : produced, warnings };
};

type Change = { key: string; from: string; to: string };
type FileResult = { ns: string; changes: Change[]; unchanged: number; warnings: string[] };

/** i18next carries plurals in sibling keys; MF2 carries them in one message. Collapse the group. */
const collapseGroups = (obj: Record<string, unknown>, warn: (key: string, why: string) => void) => {
	const groups = new Map<string, Map<string, string>>();
	for (const [key, value] of Object.entries(obj)) {
		const m = PLURAL_SUFFIX.exec(key);
		if (!m || typeof value !== 'string') continue;
		const [, base, category] = m;
		(groups.get(base) ?? groups.set(base, new Map()).get(base)!).set(category, value);
	}
	for (const [base, forms] of [...groups]) {
		if (!forms.has('other')) groups.delete(base);
		else if (Object.hasOwn(obj, base)) {
			warn(base, `i18next plural group "${base}_*" not collapsed — "${base}" already exists`);
			groups.delete(base);
		} else if ([...forms.values()].some(isMf2)) {
			warn(base, `i18next plural group "${base}_*" not collapsed — some forms are already MF2`);
			groups.delete(base);
		}
	}
	return groups;
};

const migrateObject = (
	obj: Record<string, unknown>,
	locale: string,
	path: string,
	result: FileResult
): Record<string, unknown> => {
	// no prototype, so a `__proto__` key is written through like any other key
	const out: Record<string, unknown> = Object.create(null);
	const groups = collapseGroups(obj, (base, why) => result.warnings.push(`${path}${base}: ${why}`));
	const emitted = new Set<string>();

	for (const [key, value] of Object.entries(obj)) {
		const m = PLURAL_SUFFIX.exec(key);
		const base = m && groups.has(m[1]) ? m[1] : undefined;

		if (base) {
			if (emitted.has(base)) continue;
			emitted.add(base);
			const forms = groups.get(base)!;
			const warnings: string[] = [];
			const warn = (w: string) => warnings.push(w);
			const tags = new Set<string>();
			const ordinal = ORDINAL_BASE.test(base);
			const original = [...forms.values()].join('\n');
			const texts = [...forms.values()];
			warnings.push(...nestingWarning(texts));
			const { source, warnings: all } = convertNodes(
				() => [
					{
						kind: 'select',
						name: 'count',
						fn: 'number',
						// i18next looked ordinals up as t('key', { count, ordinal: true }) → `key_ordinal_*`
						options: ordinal ? 'select=ordinal' : undefined,
						// i18next's `_zero` is a special case for count === 0 exactly, independent of
						// whatever plural category the locale's rules assign to zero (most have none, and
						// `other` would otherwise silently absorb it) — an exact numeric variant key `0`
						// gets MF2 match priority over any category, unlike the category key `zero` this
						// used to emit. Ordinals have no such special case: `_zero` there is the category.
						arms: PLURAL_CATEGORIES.filter((c) => forms.has(c)).map((c) => [
							c === 'other' ? '*' : c === 'zero' && !ordinal ? '0' : c,
							parsePattern(newCursor(forms.get(c)!, warn, tags), 'count', false)
						]) as [string, Node[]][]
					}
				],
				original,
				locale,
				warnings
			);
			if (source) {
				all.push(...convertedTagWarning(tags));
				if (ordinal)
					all.push(
						`i18next ordinal plural converted to ":number select=ordinal" — call t('${result.ns}:${path}${base}', { count }) instead of t('${result.ns}:${path}${base.replace(/_ordinal$/, '')}', { count, ordinal: true })`
					);
			}
			all.push(...keptTagWarning(texts));
			for (const w of all) result.warnings.push(`${path}${base}: ${w}`);
			if (source) {
				out[base] = source;
				result.changes.push({ key: `${path}${base}`, from: `${base}_*`, to: source });
			} else {
				for (const [category, form] of forms) out[`${base}_${category}`] = form;
				result.unchanged += forms.size;
			}
			continue;
		}

		if (typeof value === 'string') {
			const { source, warnings } = convert(value, locale);
			for (const w of warnings) result.warnings.push(`${path}${key}: ${w}`);
			if (source) {
				out[key] = source;
				result.changes.push({ key: `${path}${key}`, from: value, to: source });
			} else {
				out[key] = value;
				result.unchanged++;
			}
		} else if (value && typeof value === 'object' && !Array.isArray(value)) {
			out[key] = migrateObject(value as Record<string, unknown>, locale, `${path}${key}.`, result);
		} else {
			out[key] = value; // arrays and non-string leaves are not messages
		}
	}
	warnContext(out, path, result);
	return out;
};

/**
 * `friend` next to `friend_male` and `friend_female` is how i18next spells context. Nothing here
 * converts it — the call site passes `context`, and MF2 wants a parameter the message matches on —
 * but a human has to see it, because the variants are separate keys that nothing will ever look up.
 */
const warnContext = (obj: Record<string, unknown>, path: string, result: FileResult) => {
	const strings = Object.keys(obj).filter((k) => typeof obj[k] === 'string');
	const variants = new Map<string, string[]>();
	for (const key of strings) {
		const cut = key.lastIndexOf('_');
		const suffix = key.slice(cut + 1);
		if (cut < 1 || !suffix || suffix === 'ordinal' || PLURAL_CATEGORIES.some((c) => c === suffix))
			continue;
		const base = key.slice(0, cut);
		variants.set(base, [...(variants.get(base) ?? []), key]);
	}
	for (const [base, keys] of variants) {
		if (keys.length < 2 && !strings.includes(base)) continue;
		const names = keys.map((k) => `"${k}"`).join(', ');
		result.warnings.push(
			`${path}${base}: ${names} look like i18next context variants — MF2 handles context with a .match on a parameter; ignore this if they are separate messages`
		);
	}
};

/* ------------------------------------------------------------------------- command */

const diff = (label: string, value: string) =>
	value
		.split('\n')
		.map((line) => `${label} ${line}`)
		.join('\n');

const languageNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
const isKnownLanguage = (tag: string): boolean => {
	try {
		return languageNames.of(tag.replaceAll('_', '-')) !== undefined;
	} catch {
		return false; // not even a well-formed tag
	}
};

export const runMigrate = async (argv: string[]): Promise<number> => {
	const { values } = parseArgs({
		args: argv,
		options: {
			messages: { type: 'string', multiple: true, default: ['src/lib/messages'] },
			'dry-run': { type: 'boolean', default: false },
			strict: { type: 'boolean', default: false }
		}
	});
	const dryRun = values['dry-run']!;

	let converted = 0;
	let warned = 0;
	let files = 0;
	let flat = 0;
	const warnAt = (where: string, why: string) => {
		warned++;
		console.error(`  ${where}: ${why}`);
	};
	// Every file is read and parsed before the first one is written: a broken JSON file halfway down
	// the tree fails the run with nothing touched, instead of leaving it half migrated.
	const jobs: {
		locale: string;
		file: string;
		loc: string;
		ns: string;
		full: string;
		data: unknown;
	}[] = [];
	// several --messages directories are migrated independently, same flag shape as the other commands
	for (const dir of values.messages!) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			throw new Error(`cannot read messages directory "${dir}"`);
		}
		const locales: string[] = [];
		for (const e of entries) {
			if (e.isDirectory() || (e.isSymbolicLink() && (await isDirectory(join(dir, e.name)))))
				locales.push(e.name);
		}

		// svelte-i18n's `en.json` next to the other locales: the runtime never reads it either
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			const flatLocale = /^([a-z]{2,3}(?:[_-][A-Za-z0-9]+)*)\.json$/i.exec(entry.name)?.[1];
			// only names Intl knows as a language: `app.json` or `nav2.json` next to the locale
			// folders are someone's own files, not a flat catalog
			if (!entry.isFile() || !flatLocale || !isKnownLanguage(flatLocale)) continue;
			flat++;
			warnAt(
				`${dir}/${entry.name}`,
				`skipped — it sits directly in the messages directory. Move it to ${flatLocale.replaceAll('_', '-')}/common.json (any namespace name works)`
			);
		}

		for (const locale of locales.sort()) {
			const renamed = legacyLocaleFolder(locale);
			if (renamed) {
				warnAt(
					`${dir}/${locale}/`,
					`skipped — locale folders are BCP 47 tags. Rename it to "${renamed}"`
				);
				continue;
			}
			for (const file of (await readdir(join(dir, locale))).sort()) {
				// the same gate as the runtime glob: the locale segment must look like a language tag
				const m = MESSAGE_PATH.exec(`${locale}/${file}`);
				const full = join(dir, locale, file);
				if (!m || (await isDirectory(full))) continue;
				const data = parseJsonFile(await readFile(full, 'utf-8'), full);
				jobs.push({ locale, file, loc: m[1], ns: m[2], full, data });
			}
		}
	}

	for (const { locale, file, loc, ns, full, data } of jobs) {
		files++;
		const result: FileResult = { ns, changes: [], unchanged: 0, warnings: [] };
		const migrated = migrateObject(data as Record<string, unknown>, loc, '', result);
		converted += result.changes.length;
		warned += result.warnings.length;

		console.log(
			`svelte-dialect migrate: ${locale}/${file} — ${result.changes.length} converted, ${result.unchanged} unchanged, ${result.warnings.length} warnings`
		);
		for (const change of result.changes) {
			if (!dryRun) continue;
			console.log(`  ${change.key}`);
			console.log(diff('  -', change.from));
			console.log(diff('  +', change.to));
		}
		for (const warning of result.warnings) console.error(`  ${file}: ${warning}`);

		if (!dryRun && result.changes.length)
			await writeFile(full, `${JSON.stringify(migrated, null, '\t')}\n`);
	}

	console.log(
		dryRun
			? `svelte-dialect migrate: ${converted} messages would change, ${warned} warnings (dry run, nothing written)`
			: `svelte-dialect migrate: ${converted} messages converted, ${warned} warnings`
	);
	if (flat && !files) {
		console.error(
			'svelte-dialect migrate: nothing was migrated — move each <locale>.json into <locale>/<namespace>.json'
		);
		return 1;
	}
	if (values.strict && warned) {
		console.error(`svelte-dialect migrate: --strict: ${warned} warnings, exiting with 1`);
		return 1;
	}
	return 0;
};
