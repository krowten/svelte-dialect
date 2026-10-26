import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck } from './check.js';

let root: string;

afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

/**
 * Builds a fixture with:
 *  - `home:greeting` present in every locale (never missing)
 *  - `home:onlyEnKey` present only in `en` (missing in `ru`)
 *  - `home:unusedKey` present in the catalog but never referenced from source
 *  - a `.svelte` file that calls `t('home:greeting', …)`, `t('home:onlyEnKey')`, and a template
 *    literal with `${…}` interpolation that must be ignored by the scan
 *  - a `.ts` file that calls `loadTranslations('remote')` (a namespace no locale has) and then
 *    `t('home:ghost')` — a key absent from every locale
 */
const setupFixture = async () => {
	const dir = await mkdtemp(join(tmpdir(), 'dialect-check-'));

	await mkdir(join(dir, 'messages/en'), { recursive: true });
	await mkdir(join(dir, 'messages/ru'), { recursive: true });
	await writeFile(
		join(dir, 'messages/en/home.json'),
		JSON.stringify({
			greeting: 'Hello, {$name}!',
			onlyEnKey: 'Only in English',
			unusedKey: 'Nobody calls this'
		})
	);
	await writeFile(
		join(dir, 'messages/ru/home.json'),
		JSON.stringify({ greeting: 'Привет, {$name}!' })
	);

	await mkdir(join(dir, 'src/lib'), { recursive: true });
	await mkdir(join(dir, 'src/routes'), { recursive: true });
	await writeFile(
		join(dir, 'src/lib/Comp.svelte'),
		`<script>
	import { t } from 'svelte-dialect';
	const dynamic = 'x';
</script>

<p>{t('home:greeting', { name: 'World' })}</p>
<p>{t('home:onlyEnKey')}</p>
<p>{t(\`home:\${dynamic}\`)}</p>
`
	);
	await writeFile(
		join(dir, 'src/routes/+page.ts'),
		`import { loadTranslations } from 'svelte-dialect';

export const load = async () => {
	const { t } = await loadTranslations('remote');
	return { ghost: t('home:ghost') };
};
`
	);

	return dir;
};

describe('runCheck', () => {
	it('reports keys missing from some locales, keys missing from every locale, and unknown namespaces', async () => {
		root = await setupFixture();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);

		const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
		log.mockRestore();

		expect(code).toBe(1);
		// used everywhere — must not show up as missing
		expect(output).not.toMatch(/home:greeting/);
		// present in en, missing in ru
		expect(output).toMatch(/home:onlyEnKey.*missing in ru/);
		// absent from every locale
		expect(output).toMatch(/home:ghost.*missing in (en, ru|ru, en)/);
		// loadTranslations('remote') — no locale has this namespace at all
		expect(output).toMatch(/remote:\*.*missing in (en, ru|ru, en)/);
		// the template literal with ${…} must be invisible to the scan
		expect(output).not.toMatch(/home:x/);
		expect(output).toMatch(/3 keys used, 3 missing/);
	});

	it('lists unused catalog keys only when --unused is passed', async () => {
		root = await setupFixture();
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});

		const withoutFlag = await runCheck([
			'--messages',
			join(root, 'messages'),
			'--src',
			join(root, 'src')
		]);
		const outputWithoutFlag = log.mock.calls.map((call) => call.join(' ')).join('\n');
		expect(outputWithoutFlag).not.toMatch(/home:unusedKey/);
		expect(withoutFlag).toBe(1);

		log.mockClear();

		const withFlag = await runCheck([
			'--messages',
			join(root, 'messages'),
			'--src',
			join(root, 'src'),
			'--unused'
		]);
		const outputWithFlag = log.mock.calls.map((call) => call.join(' ')).join('\n');
		log.mockRestore();

		expect(withFlag).toBe(1);
		expect(outputWithFlag).toMatch(/Unused:/);
		expect(outputWithFlag).toMatch(/home:unusedKey/);
		expect(outputWithFlag).toMatch(/3 keys used, 3 missing, 1 unused/);
	});

	it('returns 0 and reports no missing keys when the catalog covers everything used', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages/en'), { recursive: true });
		await mkdir(join(root, 'messages/ru'), { recursive: true });
		await writeFile(join(root, 'messages/en/home.json'), JSON.stringify({ greeting: 'Hi' }));
		await writeFile(join(root, 'messages/ru/home.json'), JSON.stringify({ greeting: 'Привет' }));
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(join(root, 'src/app.ts'), `t('home:greeting');`);

		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);
		const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
		log.mockRestore();

		expect(code).toBe(0);
		expect(output).not.toMatch(/Missing:/);
		expect(output).toMatch(/1 keys used, 0 missing/);
	});

	it('fails loudly on an empty --messages directory instead of reporting a clean pass', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages'), { recursive: true }); // exists, but has no locale subdirs
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(join(root, 'src/app.ts'), `t('home:greeting');`);

		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);
		const output = error.mock.calls.map((call) => call.join(' ')).join('\n');
		error.mockRestore();

		expect(code).toBe(1);
		expect(output).toMatch(/No locales found/);
	});

	it('does not error on an empty --messages directory when nothing is used', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages'), { recursive: true });
		await mkdir(join(root, 'src'), { recursive: true });

		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);
		expect(code).toBe(0);
	});

	it('does not mistake a documentation example string for a real call', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages/en'), { recursive: true });
		await writeFile(join(root, 'messages/en/home.json'), JSON.stringify({ greeting: 'Hi' }));
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(
			join(root, 'src/docs.server.ts'),
			[
				'const EXAMPLE = `// message',
				'{ "hero": "Welcome" }',
				'',
				't(\'cms:hero\') // → "Welcome"`;',
				'',
				"// t('also:ignored') — a comment, not a call",
				"t('home:greeting');"
			].join('\n')
		);

		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);
		const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
		log.mockRestore();

		expect(code).toBe(0);
		expect(output).not.toMatch(/cms:hero/);
		expect(output).not.toMatch(/also:ignored/);
		expect(output).toMatch(/1 keys used, 0 missing/);
	});

	it('still catches a real missing key that sits right next to a documentation example', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages/en'), { recursive: true });
		await writeFile(join(root, 'messages/en/home.json'), JSON.stringify({ greeting: 'Hi' }));
		await mkdir(join(root, 'src'), { recursive: true });
		await writeFile(
			join(root, 'src/docs.server.ts'),
			["const EXAMPLE = `t('cms:hero')`;", "t('home:reallyMissing');"].join('\n')
		);

		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);
		const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
		log.mockRestore();

		expect(code).toBe(1);
		expect(output).toMatch(/home:reallyMissing/);
		expect(output).not.toMatch(/cms:hero/);
	});

	it('skips node_modules and hidden directories while scanning', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages/en'), { recursive: true });
		await writeFile(join(root, 'messages/en/home.json'), JSON.stringify({ greeting: 'Hi' }));
		await mkdir(join(root, 'src/node_modules/some-pkg'), { recursive: true });
		await writeFile(join(root, 'src/node_modules/some-pkg/index.ts'), `t('home:ghost');`);
		await mkdir(join(root, 'src/.hidden'), { recursive: true });
		await writeFile(join(root, 'src/.hidden/file.ts'), `t('home:ghost');`);

		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const code = await runCheck(['--messages', join(root, 'messages'), '--src', join(root, 'src')]);
		const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
		log.mockRestore();

		expect(code).toBe(0);
		expect(output).toMatch(/0 keys used, 0 missing/);
	});

	describe('scanner edge cases', () => {
		/** One `en/home.json` with `greeting`, the given source files, then `check` (with --unused). */
		const scan = async (files: Record<string, string>) => {
			root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
			await mkdir(join(root, 'messages/en'), { recursive: true });
			await mkdir(join(root, 'src'), { recursive: true });
			await writeFile(
				join(root, 'messages/en/home.json'),
				JSON.stringify({ greeting: 'Hi', rich: 'A {#b}bold{/b} word' })
			);
			for (const [name, text] of Object.entries(files)) {
				await mkdir(join(root, 'src', name, '..'), { recursive: true });
				await writeFile(join(root, 'src', name), text);
			}
			const log = vi.spyOn(console, 'log').mockImplementation(() => {});
			const code = await runCheck([
				'--messages',
				join(root, 'messages'),
				'--src',
				join(root, 'src'),
				'--unused'
			]);
			const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
			log.mockRestore();
			return { code, output };
		};

		it('counts formatParts calls, the way <Rich> reads a message', async () => {
			const { code, output } = await scan({
				'a.svelte': `<Rich parts={formatParts('home:rich')} /><Rich parts={formatParts('home:gone')} />`
			});
			expect(code).toBe(1);
			expect(output).toMatch(/home:gone — missing/);
			expect(output).not.toMatch(/Unused:[\s\S]*home:rich/);
		});

		it('ignores a call inside an HTML comment', async () => {
			const { code } = await scan({ 'a.svelte': `<!-- <p>{t('ghost:old')}</p> -->` });
			expect(code).toBe(0);
		});

		it('finds a call inside a template literal interpolation', async () => {
			const { code, output } = await scan({ 'a.ts': "const s = `Hi ${t('home:nope')}!`;" });
			expect(code).toBe(1);
			expect(output).toMatch(/home:nope/);
		});

		it('is not thrown off by a quote or a comment opener inside a regex literal', async () => {
			const { code, output } = await scan({
				'a.ts': [
					'const re = /[\'"]/;',
					'const url = /https:\\/\\/x\\/*/;',
					"// t('ghost:example')",
					"t('home:greeting');"
				].join('\n')
			});
			expect(code).toBe(0);
			expect(output).toMatch(/1 keys used, 0 missing/);
		});

		it('reads the namespaces out of a loadTranslations array', async () => {
			const { code, output } = await scan({ 'a.ts': `loadTranslations(['home', 'gone']);` });
			expect(code).toBe(1);
			expect(output).toMatch(/gone:\* — missing/);
			expect(output).not.toMatch(/home:\* — missing/);
		});

		it('does not take an Object.prototype member for an existing key', async () => {
			const { code, output } = await scan({
				'a.ts': `t('home:toString'); loadTranslations('constructor');`
			});
			expect(code).toBe(1);
			expect(output).toMatch(/home:toString — missing/);
			expect(output).toMatch(/constructor:\* — missing/);
		});

		it('follows a symlinked directory inside --src', async () => {
			const { code: before } = await scan({});
			expect(before).toBe(0);
			await mkdir(join(root, 'shared'), { recursive: true });
			await writeFile(join(root, 'shared/a.ts'), `t('home:fromLink');`);
			await symlink(join(root, 'shared'), join(root, 'src/linked'));
			const log = vi.spyOn(console, 'log').mockImplementation(() => {});
			const code = await runCheck([
				'--messages',
				join(root, 'messages'),
				'--src',
				join(root, 'src')
			]);
			const output = log.mock.calls.map((call) => call.join(' ')).join('\n');
			log.mockRestore();
			expect(code).toBe(1);
			expect(output).toMatch(/home:fromLink — missing/);
		});
	});

	it('fails on a --src that was passed explicitly but does not exist', async () => {
		root = await mkdtemp(join(tmpdir(), 'dialect-check-'));
		await mkdir(join(root, 'messages/en'), { recursive: true });
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const code = await runCheck([
			'--messages',
			join(root, 'messages'),
			'--src',
			join(root, 'srcc')
		]);
		error.mockRestore();
		expect(code).toBe(1);
	});
});
