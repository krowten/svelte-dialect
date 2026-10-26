import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createDialect } from './core.svelte';

const messages = {
	'/m/en/home.json': { default: { title: 'Welcome' } },
	'/m/ru/home.json': { default: { title: 'Привет' } }
};

describe('reactivity', () => {
	// setLocale writes both <html lang> and a cookie, and createDialect reads both back, so reset
	// them or tests leak their locale into each other — and across runs, since the page is reused.
	// navigator.languages is pinned too: it's the last resort in locale resolution, and left alone
	// these tests would pass or fail depending on the language of the machine running them.
	beforeEach(() => {
		document.documentElement.lang = 'en';
		for (const name of ['dialect', 'lang']) document.cookie = `${name}=;path=/;max-age=0`;
		vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US', 'en']);
	});

	afterEach(() => vi.restoreAllMocks());

	it('initializes locale from document lang set by SSR', () => {
		document.documentElement.lang = 'ru';
		const d = createDialect({ messages, defaultLocale: 'en' });
		expect(d.getLocale()).toBe('ru');
	});

	it('prefers a saved cookie over everything else', () => {
		document.cookie = 'dialect=ru;path=/';
		document.documentElement.lang = 'en';

		expect(createDialect({ messages, defaultLocale: 'en' }).getLocale()).toBe('ru');
	});

	it('falls back to navigator when lang only carries the default, as on a static host', () => {
		// a prerendered page always says the default, so it decides nothing
		document.documentElement.lang = 'en';
		vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ru-RU', 'ru']);

		expect(createDialect({ messages, defaultLocale: 'en' }).getLocale()).toBe('ru');
	});

	it('lets a server-rendered lang win over navigator when it differs from the default', () => {
		document.documentElement.lang = 'ru';
		vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US', 'en']);

		expect(createDialect({ messages, defaultLocale: 'en' }).getLocale()).toBe('ru');
	});

	it('falls back to defaultLocale when document lang is unknown or empty', () => {
		document.documentElement.lang = 'de';
		expect(createDialect({ messages, defaultLocale: 'en' }).getLocale()).toBe('en');

		document.documentElement.lang = '';
		expect(createDialect({ messages, defaultLocale: 'en' }).getLocale()).toBe('en');
	});

	it('setLocale writes the lang attribute and the cookie', () => {
		createDialect({ messages, defaultLocale: 'en' }).setLocale('ru');

		expect(document.documentElement.lang).toBe('ru');
		expect(document.cookie).toContain('dialect=ru');
	});

	it('setLocale keeps the dir attribute in step, so an RTL switch takes effect on static hosting', () => {
		const d = createDialect({
			messages: { ...messages, '/m/ar/home.json': { default: { title: 'مرحبا' } } },
			defaultLocale: 'en'
		});

		d.setLocale('ar');
		expect(document.documentElement.dir).toBe('rtl');
		d.setLocale('en');
		expect(document.documentElement.dir).toBe('ltr');
	});

	it('setLocale honours a custom cookie name', () => {
		createDialect({ messages, defaultLocale: 'en', cookie: 'lang' }).setLocale('ru');

		expect(document.cookie).toContain('lang=ru');
	});

	it('setLocale with reload:false switches state without navigating', () => {
		// the navigation itself can't run here — location.href would carry the iframe away —
		// so this pins the opt-out; the URL side of a real switch is covered by localizeHref tests
		const d = createDialect({
			messages,
			locales: ['en', 'ru'],
			defaultLocale: 'en',
			routing: true
		});
		const before = location.href;

		d.setLocale('ru', { reload: false });

		expect(d.getLocale()).toBe('ru');
		expect(location.href).toBe(before);
		d.setLocale('en', { reload: false });
	});

	it('a rejected unknown locale leaves the lang attribute untouched', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const d = createDialect({ messages, defaultLocale: 'en' });

		d.setLocale('de');
		expect(d.getLocale()).toBe('en');
		expect(document.documentElement.lang).toBe('en');
		warn.mockRestore();
	});

	it('refetches lazy-glob namespaces on a locale change, with no loader configured', async () => {
		// the static-hosting shape: everything comes from a non-eager glob, no user loader at all
		const d = createDialect({
			messages: {
				'/m/en/home.json': { default: { title: 'Welcome' } },
				'/m/en/lazy.json': async () => ({ default: { hi: 'Hi en' } }),
				'/m/ru/lazy.json': async () => ({ default: { hi: 'Привет' } })
			},
			defaultLocale: 'en'
		});

		const { t } = await d.loadTranslations('lazy');
		expect(t('lazy:hi')).toBe('Hi en');

		d.setLocale('ru');
		await vi.waitFor(() => expect(t('lazy:hi')).toBe('Привет'));
	});

	it('configure notifies reactive readers even when the active locale does not change', () => {
		const d = createDialect({
			messages: {
				...messages,
				'/m/fr/home.json': { default: { title: 'Bienvenue', fallback: 'French fallback' } }
			},
			defaultLocale: 'en'
		});
		const seen: { locales: string; text: string }[] = [];
		const cleanup = $effect.root(() => {
			$effect(() => {
				seen.push({ locales: d.locales.join(','), text: d.t('home:fallback') });
			});
		});
		flushSync();
		seen.length = 0;

		d.configure({ defaultLocale: 'fr', locales: ['en', 'ru', 'fr'] });
		flushSync();

		expect(seen.at(-1)).toEqual({ locales: 'en,ru,fr', text: 'French fallback' });
		cleanup();
	});

	it('configure re-points the document when it takes the current locale away', () => {
		const d = createDialect({
			messages: { ...messages, '/m/ar/home.json': { default: { title: 'مرحبا' } } },
			defaultLocale: 'en'
		});
		d.setLocale('ar');
		expect(document.documentElement.dir).toBe('rtl');

		d.configure({ locales: ['en', 'ru'] });

		expect(d.getLocale()).toBe('en');
		expect(document.documentElement.lang).toBe('en');
		expect(document.documentElement.dir).toBe('ltr');
	});

	it('refetches requested namespaces when the locale changes, without re-calling loadTranslations', async () => {
		const loader = vi.fn(async ({ locale }: { locale: string }) => ({ hi: `Hi ${locale}` }));
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		// the plain destructured form: grabbed once, never awaited again
		const { t } = await d.loadTranslations('remote');
		expect(t('remote:hi')).toBe('Hi en');

		d.setLocale('ru');
		await vi.waitFor(() => expect(t('remote:hi')).toBe('Hi ru'));
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('loadTranslations can run inside a $derived, as an `await` expression in markup does', async () => {
		const loader = vi.fn(async () => ({ hi: 'Hi' }));
		const d = createDialect({ messages, defaultLocale: 'en', loader });
		let pending: Promise<unknown> | undefined;
		const cleanup = $effect.root(() => {
			const load = $derived(d.loadTranslations('remote'));
			$effect(() => {
				pending = load;
			});
		});
		flushSync();
		await pending;
		cleanup();
		expect(d.t('remote:hi')).toBe('Hi');
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it('an effect calling loadTranslations runs once, not again on every catalog change', async () => {
		const d = createDialect({ messages, defaultLocale: 'en', loader: async () => ({ hi: 'Hi' }) });
		let runs = 0;
		const cleanup = $effect.root(() => {
			$effect(() => {
				runs++;
				d.loadTranslations('remote');
			});
		});
		flushSync();
		await vi.waitFor(() => expect(d.t('remote:hi')).toBe('Hi'));
		await new Promise((r) => setTimeout(r));
		cleanup();
		expect(runs).toBe(1);
	});

	it('loading one namespace does not retry another that failed earlier', async () => {
		const loader = vi.fn(async ({ namespace }: { namespace: string }) => {
			if (namespace === 'broken') throw new Error('404');
			return { hi: 'Hi' };
		});
		const d = createDialect({ messages, defaultLocale: 'en', loader });
		await expect(d.loadTranslations('broken')).rejects.toThrow('404');
		await d.loadTranslations('remote');
		await new Promise((r) => setTimeout(r));
		expect(loader.mock.calls.map(([a]) => a.namespace)).toEqual(['broken', 'remote']);
	});

	it('t() re-runs in effects when locale changes', async () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const seen: string[] = [];
		const cleanup = $effect.root(() => {
			$effect(() => {
				seen.push(d.t('home:title'));
			});
		});
		await Promise.resolve(); // flush effects
		await new Promise((r) => setTimeout(r));
		d.setLocale('ru');
		await new Promise((r) => setTimeout(r));
		cleanup();
		expect(seen).toEqual(['Welcome', 'Привет']);
	});
});
