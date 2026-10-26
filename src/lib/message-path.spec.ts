import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MESSAGE_PATH, legacyLocaleFolder } from './message-path.js';
import { readCatalogDir } from './cli/catalog.js';

describe('MESSAGE_PATH', () => {
	it.each(['en', 'pt-BR', 'zh-Hant', 'zh-Hant-TW', 'es-419'])(
		'accepts the locale folder %s',
		(locale) => {
			expect(MESSAGE_PATH.exec(`src/messages/${locale}/home.json`)?.slice(1)).toEqual([
				locale,
				'home'
			]);
		}
	);

	it.each(['zh_CN', 'pt_BR', 'assets', 'messages'])('does not take %s for a locale', (folder) => {
		expect(MESSAGE_PATH.exec(`${folder}/home.json`)).toBeNull();
	});
});

describe('legacyLocaleFolder', () => {
	it('suggests the BCP 47 spelling of an underscore folder', () => {
		expect(legacyLocaleFolder('zh_CN')).toBe('zh-CN');
		expect(legacyLocaleFolder('zh_Hant_TW')).toBe('zh-Hant-TW');
		expect(legacyLocaleFolder('es_419')).toBe('es-419');
	});

	it('leaves real tags and ordinary folder names alone', () => {
		for (const name of ['en', 'pt-BR', 'zh-Hant', 'my_assets', 'node_modules', 'not_a_locale'])
			expect(legacyLocaleFolder(name), name).toBeUndefined();
	});
});

describe('readCatalogDir (check, typegen)', () => {
	let dir: string;
	afterEach(async () => {
		vi.restoreAllMocks();
		await rm(dir, { recursive: true, force: true });
	});

	it('reads hyphenated locale folders and names a skipped underscore one', async () => {
		dir = await mkdtemp(join(tmpdir(), 'svelte-dialect-catalog-'));
		for (const locale of ['pt-BR', 'zh-Hant', 'zh_CN']) {
			await mkdir(join(dir, locale));
			await writeFile(join(dir, locale, 'home.json'), JSON.stringify({ hi: 'Hi' }));
		}
		const errors: string[] = [];
		vi.spyOn(console, 'error').mockImplementation(
			(...args: unknown[]) => void errors.push(args.join(' '))
		);

		const catalog = await readCatalogDir(dir);
		expect(Object.keys(catalog).sort()).toEqual(['pt-BR', 'zh-Hant']);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('rename it to "zh-CN"');
	});
});
