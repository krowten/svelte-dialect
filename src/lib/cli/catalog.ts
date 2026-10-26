/**
 * Reading message catalogs from disk (or a JSON dump) for the CLI commands. Same layout rules as
 * the runtime: `<locale>/<namespace>.json`, nested objects flattened to dot paths.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { MESSAGE_PATH, flattenSources, legacyLocaleFolder } from '../message-path.js';

/** catalog[locale][namespace]['dot.path'] = MF2 source */
export type SourceCatalog = Record<string, Record<string, Record<string, string>>>;

/**
 * `JSON.parse` that names the file it failed on — in a catalog of a hundred files, a bare "Unexpected
 * token" is a guessing game. A UTF-8 byte order mark, which Windows tools like to write, is dropped.
 */
export const parseJsonFile = (raw: string, file: string): unknown => {
	try {
		return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
	} catch (error) {
		throw new Error(
			`invalid JSON in "${file}": ${error instanceof Error ? error.message : error}`,
			{
				cause: error
			}
		);
	}
};

/** Whether `path` is a directory, following a symlink — the runtime's glob follows them too. */
export const isDirectory = (path: string): Promise<boolean> =>
	stat(path).then(
		(s) => s.isDirectory(),
		() => false
	);

/** Walks `<dir>/<locale>/<namespace>.json` files into a catalog. */
export const readCatalogDir = async (dir: string): Promise<SourceCatalog> => {
	// null-prototype at every level, so a `__proto__` or `toString` locale/namespace is just a name
	const catalog: SourceCatalog = Object.create(null);
	const locales: string[] = [];
	try {
		for (const e of await readdir(dir, { withFileTypes: true })) {
			if (e.isDirectory() || (e.isSymbolicLink() && (await isDirectory(join(dir, e.name)))))
				locales.push(e.name);
		}
	} catch {
		throw new Error(`cannot read messages directory "${dir}"`);
	}

	for (const locale of locales) {
		const renamed = legacyLocaleFolder(locale);
		if (renamed)
			console.error(
				`svelte-dialect: skipped "${dir}/${locale}" — locale folders are BCP 47 tags, rename it to "${renamed}"`
			);
		for (const file of await readdir(join(dir, locale))) {
			// the same gate as the runtime glob: the locale segment must look like a language tag
			const m = MESSAGE_PATH.exec(`${locale}/${file}`);
			const path = join(dir, locale, file);
			if (!m || (await isDirectory(path))) continue;
			const [, loc, ns] = m;
			const data = parseJsonFile(await readFile(path, 'utf-8'), path);
			(catalog[loc] ??= Object.create(null))[ns] = flattenSources(data as Record<string, unknown>);
		}
	}
	return catalog;
};

/** Accepts a `{locale: {namespace: {…nested}}}` dump, e.g. exported from a database. */
export const readCatalogJson = async (file: string): Promise<SourceCatalog> => {
	const raw = parseJsonFile(await readFile(file, 'utf-8'), file) as Record<
		string,
		Record<string, Record<string, unknown>>
	>;
	const catalog: SourceCatalog = Object.create(null);
	for (const [locale, namespaces] of Object.entries(raw)) {
		for (const [ns, data] of Object.entries(namespaces)) {
			(catalog[locale] ??= Object.create(null))[ns] = flattenSources(data);
		}
	}
	return catalog;
};

/** Reads several message directories into one catalog — a project may keep bundled and lazy trees apart. */
export const readCatalogDirs = async (dirs: string[]): Promise<SourceCatalog> => {
	const catalog: SourceCatalog = Object.create(null);
	for (const dir of dirs) {
		for (const [locale, namespaces] of Object.entries(await readCatalogDir(dir))) {
			for (const [ns, messagesInNs] of Object.entries(namespaces)) {
				const into = (catalog[locale] ??= Object.create(null));
				into[ns] = Object.assign(into[ns] ?? Object.create(null), messagesInNs);
			}
		}
	}
	return catalog;
};

/** Every `namespace:dot.path` key across all locales. */
export const allKeys = (catalog: SourceCatalog): Set<string> => {
	const keys = new Set<string>();
	for (const namespaces of Object.values(catalog)) {
		for (const [ns, messages] of Object.entries(namespaces)) {
			for (const path of Object.keys(messages)) keys.add(`${ns}:${path}`);
		}
	}
	return keys;
};
