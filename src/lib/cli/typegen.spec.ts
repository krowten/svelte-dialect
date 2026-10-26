import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ts from 'typescript';
import { extractParams, renderTypes, runTypegen } from './typegen.js';
import { readCatalogDir } from './catalog.js';

describe('extractParams', () => {
	it('finds bare variables as unknown', () => {
		expect(extractParams('Hello {$name}!')).toEqual({ name: 'unknown' });
	});

	it('maps annotations to caller-side types', () => {
		expect(extractParams('{$count :number} of {$when :date}')).toEqual({
			count: 'number | string',
			when: 'Date | number | string'
		});
	});

	it('types :offset, a required MF2 function, as a number', () => {
		expect(extractParams('{$count :offset add=1}')).toEqual({ count: 'number | string' });
	});

	it('lets an annotated use win over a bare one', () => {
		const src =
			'.input {$count :number}\n.match $count\none {{{$count} item}}\n* {{{$count} items}}';
		expect(extractParams(src)).toEqual({ count: 'number | string' });
	});

	it('returns nothing for an invalid source instead of throwing', () => {
		expect(extractParams('.match {$broken')).toEqual({});
	});

	it('types an unknown custom function as unknown', () => {
		expect(extractParams('Hey {$who :shout}')).toEqual({ who: 'unknown' });
	});

	it('excludes a .local alias but keeps the external variable it depends on', () => {
		const src = '.local $greeting = {$name :string}\n{{Hello {$greeting}}}';
		expect(extractParams(src)).toEqual({ name: 'string' });
	});

	it('finds variables used only in a function option', () => {
		expect(extractParams('{$amount :currency currency=$code}')).toEqual({
			amount: 'number | string',
			code: 'unknown'
		});
	});

	it('finds variables used only in a markup option', () => {
		expect(extractParams('{#link to=$href}Click{/link}')).toEqual({ href: 'unknown' });
	});

	it('is not fooled by a param named "constructor" or "toString"', () => {
		expect(extractParams('{$constructor} {$toString :number}')).toEqual({
			constructor: 'unknown',
			toString: 'number | string'
		});
	});

	it('keeps a param named "__proto__" instead of swallowing it as a prototype write', () => {
		const params = extractParams('{$__proto__}');
		expect(Object.keys(params)).toEqual(['__proto__']);
		expect(renderTypes({ en: { home: { odd: '{$__proto__}' } } })).toContain(
			"'home:odd': { __proto__: unknown };"
		);
	});
});

describe('renderTypes', () => {
	it('renders a sorted key union and only parameterful entries in MessageParams', () => {
		const out = renderTypes({
			en: {
				home: { title: 'Welcome', greeting: 'Hello {$name}!' },
				nav: { docs: 'Docs' }
			}
		});
		expect(out).toContain(
			`export type MessageKey =\n\t| 'home:greeting'\n\t| 'home:title'\n\t| 'nav:docs';`
		);
		expect(out).toContain(`'home:greeting': { name: unknown };`);
		expect(out).not.toContain(`'home:title':`);
	});

	it('merges parameter shapes across locales, annotations winning', () => {
		const out = renderTypes({
			en: { home: { n: '{$count} items' } },
			de: { home: { n: '{$count :number} Stück' } }
		});
		expect(out).toContain(`'home:n': { count: number | string };`);
	});

	it('renders never for an empty catalog', () => {
		expect(renderTypes({})).toContain('export type MessageKey = never;');
	});

	it('produces syntactically valid TypeScript for a key with a newline, quotes and a backslash', () => {
		const key = 'line\nbreak \'quoted\' "and" C:\\path';
		const out = renderTypes({ en: { home: { [key]: 'Hi' } } });
		const source = ts.createSourceFile('keys.d.ts', out, ts.ScriptTarget.Latest, true);
		const diagnostics = (source as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics;
		expect(diagnostics).toEqual([]);
		// round-trips through real TS evaluation, not just a diff against a hand-escaped string
		const literal = out.match(/export type MessageKey =\n\t\| (.+);/)![1];
		expect(new Function(`return ${literal}`)()).toBe(`home:${key}`);
	});
});

describe('runTypegen', () => {
	let dir: string;
	afterEach(() => rm(dir, { recursive: true, force: true }));

	it('reads a messages directory and writes the .d.ts', async () => {
		dir = await mkdtemp(join(tmpdir(), 'dialect-typegen-'));
		await mkdir(join(dir, 'en'));
		await writeFile(
			join(dir, 'en', 'home.json'),
			JSON.stringify({ title: 'Hi', nested: { deep: 'D {$x :integer}' } })
		);
		const out = join(dir, 'keys.d.ts');

		const code = await runTypegen(['--messages', join(dir, 'en', '..'), '--out', out]);

		expect(code).toBe(0);
		const text = await readFile(out, 'utf-8');
		expect(text).toContain(`| 'home:nested.deep'\n\t| 'home:title'`);
		expect(text).toContain(`'home:nested.deep': { x: number | string };`);
	});

	it('accepts a {locale: {ns: …}} JSON dump for database-held keys', async () => {
		dir = await mkdtemp(join(tmpdir(), 'dialect-typegen-'));
		const dump = join(dir, 'dump.json');
		await writeFile(dump, JSON.stringify({ en: { cms: { hero: 'Yo {$user}' } } }));
		const out = join(dir, 'keys.d.ts');

		const code = await runTypegen(['--from-json', dump, '--out', out]);

		expect(code).toBe(0);
		const text = await readFile(out, 'utf-8');
		expect(text).toContain(`export type MessageKey =\n\t| 'cms:hero';`);
	});

	it('merges several --messages directories into one catalog', async () => {
		dir = await mkdtemp(join(tmpdir(), 'dialect-typegen-'));
		for (const [tree, ns, key] of [
			['bundled', 'home', 'title'],
			['lazy', 'dashboard', 'intro']
		]) {
			await mkdir(join(dir, tree, 'en'), { recursive: true });
			await writeFile(join(dir, tree, 'en', `${ns}.json`), JSON.stringify({ [key]: 'X' }));
		}
		const out = join(dir, 'keys.d.ts');

		const code = await runTypegen([
			'--messages',
			join(dir, 'bundled'),
			'--messages',
			join(dir, 'lazy'),
			'--out',
			out
		]);

		expect(code).toBe(0);
		expect(await readFile(out, 'utf-8')).toContain(`| 'dashboard:intro'\n\t| 'home:title'`);
	});

	it('skips a stray json instead of inventing a locale, same as the runtime glob', async () => {
		dir = await mkdtemp(join(tmpdir(), 'dialect-typegen-'));
		await mkdir(join(dir, 'en'));
		await mkdir(join(dir, 'messages'));
		await writeFile(join(dir, 'en', 'home.json'), JSON.stringify({ a: 'A' }));
		await writeFile(join(dir, 'messages', 'notes.json'), JSON.stringify({ b: 'B' }));

		const catalog = await readCatalogDir(dir);
		expect(Object.keys(catalog)).toEqual(['en']);
	});
});
