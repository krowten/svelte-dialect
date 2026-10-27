import { describe, expect, it } from 'vitest';

import addon, { parseLocales } from './sv.js';

const APP_HTML = '<!doctype html>\n<html lang="en">\n\t<head></head>\n\t<body></body>\n</html>\n';

/** Runs the add-on against an in-memory project and returns the files it wrote. */
const runAddon = (
	files: Record<string, string>,
	{ isKit = true, routing = true, language = 'ts' } = {}
) => {
	const out = { ...files };
	const dependencies: Record<string, string> = {};
	addon.run({
		isKit,
		language,
		directory: { src: 'src', lib: 'src/lib', kitRoutes: 'src/routes' },
		options: { locales: 'en, de-ch', routing },
		sv: {
			dependency: (name: string, version: string) => (dependencies[name] = version),
			file: (path: string, edit: (content: string) => string | false) => {
				const result = edit(out[path] ?? '');
				if (result !== false) out[path] = result;
			}
		},
		cancel: () => {}
	} as unknown as Parameters<typeof addon.run>[0]);
	return { files: out, dependencies };
};

describe('sv add-on', () => {
	it('canonicalises the locale list and rejects bad tags', () => {
		expect(parseLocales('en, de-ch  pt-br')).toEqual(['en', 'de-CH', 'pt-BR']);
		expect(() => parseLocales('en, not a tag!')).toThrow(RangeError);
	});

	it('wires a fresh SvelteKit project', () => {
		const { files, dependencies } = runAddon({ 'src/app.html': APP_HTML });

		expect(dependencies['svelte-dialect']).toMatch(/^\^\d+\.\d+\.\d+/);
		expect(files['src/lib/i18n.ts']).toContain("from 'svelte-dialect/kit'");
		expect(files['src/lib/i18n.ts']).toContain("locales: ['en', 'de-CH'],\n\trouting: true");
		expect(JSON.parse(files['src/lib/messages/de-CH/common.json'])).toEqual({
			greeting: 'Hello, {$name}!'
		});
		expect(files['src/hooks.server.ts']).toContain(
			"import { handle as dialect } from '#lib/i18n.ts'"
		);
		expect(files['src/hooks.server.ts']).toContain('export const handle: Handle = dialect;');
		expect(files['src/hooks.ts']).toContain("import { reroute as dialect } from '#lib/i18n.ts'");
		expect(files['src/hooks.ts']).toContain('export const reroute: Reroute = dialect');
		expect(files['src/app.html']).toContain('<html lang="%dialect.lang%" dir="%dialect.dir%">');
	});

	it('sequences an existing handle and leaves user files alone', () => {
		const existing = {
			'src/app.html': APP_HTML,
			'src/lib/i18n.ts': '// mine\n',
			'src/lib/messages/en/common.json': '{ "mine": "yes" }',
			'src/hooks.server.ts':
				"import type { Handle } from '@sveltejs/kit/hooks';\n\nexport const handle: Handle = ({ event, resolve }) => resolve(event);\n",
			'src/hooks.ts': 'export const reroute = () => {};\n'
		};
		const { files } = runAddon(existing);

		expect(files['src/lib/i18n.ts']).toBe('// mine\n');
		expect(files['src/lib/messages/en/common.json']).toBe('{ "mine": "yes" }');
		expect(files['src/hooks.server.ts']).toContain('sequence(originalHandle, handleDialect)');
		expect(files['src/hooks.ts']).toBe(existing['src/hooks.ts']);

		// A second run changes nothing.
		expect(runAddon(files).files).toEqual(files);
	});

	it('skips hooks without SvelteKit and reroute without routing', () => {
		expect(Object.keys(runAddon({}, { isKit: false }).files).sort()).toEqual([
			'src/lib/i18n.ts',
			'src/lib/messages/de-CH/common.json',
			'src/lib/messages/en/common.json'
		]);
		const { files } = runAddon({ 'src/app.html': APP_HTML }, { routing: false });
		expect(files['src/hooks.ts']).toBeUndefined();
		expect(files['src/lib/i18n.ts']).toContain('export const { t, handle, setLocale, locales }');
	});

	it('adds reroute next to other exports in a JavaScript hooks file', () => {
		const { files } = runAddon(
			{ 'src/hooks.js': 'export const transport = {};\n' },
			{ language: 'js' }
		);
		expect(files['src/lib/i18n.js']).toContain("from 'svelte-dialect/kit'");
		expect(files['src/hooks.js']).toContain('export const transport = {};');
		expect(files['src/hooks.js']).toContain("import { reroute as dialect } from '#lib/i18n.js'");
		expect(files['src/hooks.js']).toMatch(
			/@type \{import\('@sveltejs\/kit\/hooks'\)\.Reroute\} \*\/\s*export const reroute = dialect;/
		);
		expect(files['src/hooks.server.js']).toContain(
			"/** @type {import('@sveltejs/kit/hooks').Handle} */\nexport const handle = dialect;"
		);
	});
});
