/**
 * `svelte-dialect check` — cross-references `t('ns:dot.path', …)` calls found in source against
 * the message catalogs, so a renamed or deleted key shows up as a build-time failure instead of a
 * key rendered verbatim in production.
 *
 * The scan is a regex over file text, not a parse of the AST — good enough for a lint-grade check,
 * but it has real blind spots: a key assembled from a variable (`t(section + ':' + name)`, a
 * template literal with `${…}`, a key read from an array/object) is invisible to it. Such keys are
 * silently skipped rather than flagged, on both sides — they neither trigger a false "missing" nor
 * get credited toward "used" for --unused. Keep dynamic keys to a minimum, or list them by hand.
 */
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { readCatalogDirs, allKeys } from './catalog.js';
import type { SourceCatalog } from './catalog.js';

const SCAN_EXTENSIONS = new Set(['.ts', '.js', '.svelte']);

/**
 * Matches `t('ns:path')`, `tr("ns:path")`, `data.t(\`ns:path\`)`, `formatParts('ns:path')` — a bare
 * `t`/`tr`/`formatParts` identifier, or one hanging off a member access (`data.t`, …), called with a single
 * quoted string literal. The literal must not contain `$`, which is how a template literal with
 * `${…}` interpolation gets excluded — cheaper than balancing braces, at the cost of also excluding
 * the (presumably rare) literal key that happens to contain a dollar sign.
 */
const KEY_CALL = /\b(?:[A-Za-z_$][\w$]*\.)?(?:tr?|formatParts)\(\s*(['"`])([^'"`$]+?)\1/g;

/** Same literal-only rule, for `loadTranslations('ns')`. */
const LOAD_TRANSLATIONS_CALL = /\bloadTranslations\(\s*(['"`])([^'"`$]+?)\1/g;

/** `loadTranslations(['a', 'b'])`: the array, whose string literals are the namespaces. */
const LOAD_TRANSLATIONS_LIST = /\bloadTranslations\(\s*\[([^\]]*)\]/g;
const LITERAL = /(['"`])([^'"`$]+?)\1/g;

/** Right before an opening quote, does the source so far end in a call this scanner recognises? */
const CALL_PREFIX = /\b(?:[A-Za-z_$][\w$]*\.)?(?:tr?|formatParts|loadTranslations)\(\s*$/;

/**
 * The template literal starting at `source[start]` (the opening backtick), closing backtick
 * included: `raw` as written, and `blanked` with its own text spaced out but its top-level `${…}`
 * interpolations kept, since those are code and can hold real calls. Tracks `${…}` nesting —
 * including further template literals and quoted strings inside an interpolation, so a `}` or a
 * backtick inside one of those doesn't get mistaken for the end of something it's nested in. Not a
 * full grammar (deeply exotic interpolations can still confuse it), but real source doesn't nest
 * that way.
 */
const consumeTemplate = (source: string, start: number): { raw: string; blanked: string } => {
	const n = source.length;
	let i = start + 1;
	const stack: Array<'`' | '}'> = ['`'];
	const interpolations: [number, number][] = [];
	let opened = 0;
	while (i < n && stack.length) {
		const ch = source[i];
		if (stack[stack.length - 1] === '`') {
			if (ch === '\\') i++;
			else if (ch === '`') stack.pop();
			else if (ch === '$' && source[i + 1] === '{') {
				stack.push('}');
				if (stack.length === 2) opened = i + 2;
				i++;
			}
		} else if (ch === "'" || ch === '"') {
			i++;
			while (i < n && source[i] !== ch) i += source[i] === '\\' ? 2 : 1;
		} else if (ch === '`') stack.push('`');
		else if (ch === '{') stack.push('}');
		else if (ch === '}') {
			stack.pop();
			if (stack.length === 1) interpolations.push([opened, i]);
		}
		i++;
	}
	const blank = (from: number, to: number) => source.slice(from, to).replace(/[^\n]/g, ' ');
	let blanked = '';
	let pos = start;
	for (const [from, to] of interpolations) {
		blanked += blank(pos, from) + source.slice(from, to);
		pos = to;
	}
	return { raw: source.slice(start, i), blanked: blanked + blank(pos, i) };
};

/** What can come right before a regex literal; anything else before a `/` makes it a division. */
const BEFORE_REGEX = /(?:[(,=:[!&|?{;]|\breturn|\btypeof)\s*$/;

/** End (exclusive) of the regex literal opening at `source[start]`, or -1 if it isn't one. */
const regexEnd = (source: string, start: number): number => {
	let inClass = false;
	for (let j = start + 1; j < source.length; j++) {
		const c = source[j];
		if (c === '\n') return -1;
		if (c === '\\') j++;
		else if (c === '[') inClass = true;
		else if (c === ']') inClass = false;
		else if (c === '/' && !inClass) return j + 1;
	}
	return -1;
};

/**
 * Blanks out comments (`//`, `/* *\/`, and `<!-- -->` in markup), regex literals and the text of
 * template literals that aren't a recognised call's argument, so a documentation string like
 * `` `t('cms:hero') // → …` `` embedded in a `+page.server.ts` example isn't mistaken for a real
 * call — and a quote inside `/['"]/` doesn't throw the rest of the file out of step. Regular
 * `'…'`/`"…"` string literals are left alone — they're the common shape of a real key argument, and
 * short enough that a lookalike inside one is unlikely.
 */
const stripNoise = (source: string): string => {
	let out = '';
	let i = 0;
	const n = source.length;
	while (i < n) {
		if (source[i] === '/' && source[i + 1] === '/') {
			while (i < n && source[i] !== '\n') {
				out += ' ';
				i++;
			}
			continue;
		}
		const comment =
			source[i] === '/' && source[i + 1] === '*'
				? ['/*', '*/']
				: source.startsWith('<!--', i)
					? ['<!--', '-->']
					: undefined;
		if (comment) {
			const end = source.indexOf(comment[1], i + comment[0].length);
			const stop = end === -1 ? n : end + comment[1].length;
			out += source.slice(i, stop).replace(/[^\n]/g, ' ');
			i = stop;
			continue;
		}
		const ch = source[i];
		if (ch === '/' && BEFORE_REGEX.test(out.slice(-16))) {
			const end = regexEnd(source, i);
			if (end !== -1) {
				out += source.slice(i, end).replace(/[^\n]/g, ' ');
				i = end;
				continue;
			}
		}
		if (ch === "'" || ch === '"') {
			let j = i + 1;
			while (j < n && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
			j = Math.min(j + 1, n);
			out += source.slice(i, j);
			i = j;
			continue;
		}
		if (ch === '`') {
			const { raw, blanked } = consumeTemplate(source, i);
			out += CALL_PREFIX.test(out.slice(-64)) ? raw : blanked;
			i += raw.length;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
};

/** Whether `path` is a directory, following a symlink. */
const isDirectory = (path: string): Promise<boolean> =>
	stat(path).then(
		(s) => s.isDirectory(),
		() => false
	);

/**
 * Recursively lists source files under `dir`, skipping `node_modules` and hidden directories.
 * Follows symlinked directories, as Vite does; `seen` keeps a link back to an ancestor from
 * looping.
 */
const collectSourceFiles = async (dir: string, seen = new Set<string>()): Promise<string[]> => {
	let entries;
	try {
		const real = await realpath(dir);
		if (seen.has(real)) return [];
		seen.add(real);
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return []; // an absent default `src` is reported as "0 keys used", not a crash
	}

	const files: string[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory() || (entry.isSymbolicLink() && (await isDirectory(path)))) {
			if (entry.name === 'node_modules') continue;
			files.push(...(await collectSourceFiles(path, seen)));
		} else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
			files.push(path);
		}
	}
	return files;
};

/** `ns:path` keys and bare `loadTranslations(…)` namespaces found in one file's text. */
const scanSource = (rawSource: string): { keys: string[]; namespaces: string[] } => {
	const source = stripNoise(rawSource);
	const keys: string[] = [];
	for (const match of source.matchAll(KEY_CALL)) {
		const literal = match[2];
		if (literal.includes(':')) keys.push(literal);
	}

	const namespaces: string[] = [];
	for (const match of source.matchAll(LOAD_TRANSLATIONS_CALL)) namespaces.push(match[2]);
	for (const list of source.matchAll(LOAD_TRANSLATIONS_LIST))
		for (const match of list[1].matchAll(LITERAL)) namespaces.push(match[2]);

	return { keys, namespaces };
};

/** One `ns:path` (or `ns:*` for a namespace pulled in via `loadTranslations`) missing some locales. */
type MissingEntry = { key: string; locales: string[] };

/** `obj[key]` when it's an own property — `toString` is not a namespace or a key just for being inherited. */
const own = <T>(obj: Record<string, T> | undefined, key: string): T | undefined =>
	obj && Object.hasOwn(obj, key) ? obj[key] : undefined;

/** Locales (from `catalog`) that don't have `ns:path`. */
const missingLocalesForKey = (
	catalog: SourceCatalog,
	locales: string[],
	ns: string,
	path: string
) => locales.filter((locale) => own(own(own(catalog, locale), ns), path) === undefined);

/** Locales that don't have namespace `ns` at all. */
const missingLocalesForNamespace = (catalog: SourceCatalog, locales: string[], ns: string) =>
	locales.filter((locale) => own(own(catalog, locale), ns) === undefined);

export const runCheck = async (argv: string[]): Promise<number> => {
	const { values } = parseArgs({
		args: argv,
		options: {
			messages: { type: 'string', multiple: true, default: ['src/lib/messages'] },
			// no default here: an explicit --src that doesn't exist is an error, the default isn't
			src: { type: 'string' },
			unused: { type: 'boolean', default: false }
		}
	});

	const catalog = await readCatalogDirs(values.messages!);
	const locales = Object.keys(catalog);

	if (values.src !== undefined && !(await isDirectory(values.src))) {
		console.error(`Cannot read source directory ${values.src}`);
		return 1;
	}
	const files = await collectSourceFiles(values.src ?? 'src');
	const usedKeys = new Set<string>();
	const usedNamespaces = new Set<string>();
	for (const file of files) {
		const source = await readFile(file, 'utf-8');
		const found = scanSource(source);
		for (const key of found.keys) usedKeys.add(key);
		for (const ns of found.namespaces) usedNamespaces.add(ns);
	}

	// An empty or unrecognised --messages directory yields `locales = []`, under which every "missing
	// in" filter comes back empty too — a wrong path or a typo'd layout would otherwise report a
	// clean 0-missing pass while the app renders raw keys. Silent when nothing was used either: an
	// app with no t() calls yet, or a --src that legitimately has none, is not an error.
	if (locales.length === 0 && (usedKeys.size > 0 || usedNamespaces.size > 0)) {
		console.error(
			`No locales found under ${values.messages!.join(', ')} — cannot verify ${usedKeys.size} used key(s)`
		);
		return 1;
	}

	const missing: MissingEntry[] = [];
	for (const key of usedKeys) {
		const [ns, ...pathParts] = key.split(':');
		const path = pathParts.join(':');
		const missingLocales = missingLocalesForKey(catalog, locales, ns, path);
		if (missingLocales.length > 0) missing.push({ key, locales: missingLocales });
	}
	for (const ns of usedNamespaces) {
		const missingLocales = missingLocalesForNamespace(catalog, locales, ns);
		if (missingLocales.length > 0) missing.push({ key: `${ns}:*`, locales: missingLocales });
	}
	missing.sort((a, b) => a.key.localeCompare(b.key));

	if (missing.length > 0) {
		console.log('Missing:');
		for (const entry of missing)
			console.log(`  ${entry.key} — missing in ${entry.locales.join(', ')}`);
	}

	let unused: string[] = [];
	if (values.unused) {
		unused = [...allKeys(catalog)].filter((key) => !usedKeys.has(key)).sort();
		if (unused.length > 0) {
			console.log('Unused:');
			for (const key of unused) console.log(`  ${key}`);
		}
	}

	const summary = `${usedKeys.size} keys used, ${missing.length} missing${values.unused ? `, ${unused.length} unused` : ''}`;
	console.log(summary);

	return missing.length > 0 ? 1 : 0;
};
