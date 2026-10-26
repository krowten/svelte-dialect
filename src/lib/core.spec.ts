import { describe, it, expect, vi } from 'vitest';
import { createDialect } from './core.svelte';
import type { LocaleSource } from './core.svelte';

const messages = {
	'/src/lib/messages/en/home.json': {
		default: {
			title: 'Welcome',
			nested: { deep: 'Deep value' },
			hello: 'Hello {$name}!',
			items: '.input {$count :number}\n.match $count\none {{{$count} item}}\n* {{{$count} items}}',
			bad: '.match {$x',
			'odd:key': 'Colon in the path'
		}
	},
	'/src/lib/messages/ru/home.json': {
		default: { title: 'Добро пожаловать', hello: 'Привет, {$name}!' }
	},
	'/src/lib/messages/en/nav.json': { default: { docs: 'Docs' } }
};

const make = () => createDialect({ messages, defaultLocale: 'en' });

/**
 * A `resolve` for `handle` that notes the locale the request was served in. On the server a
 * request's locale exists only inside resolve() — `handle` keeps it out of the shared state.
 */
const noting = (
	d: { getLocale(): string },
	resolve: (...args: never[]) => Promise<Response> = async () => new Response('')
) => {
	const seen = { locale: '' };
	return {
		seen,
		resolve: vi.fn(async (...args: never[]) => {
			seen.locale = d.getLocale();
			return resolve(...args);
		})
	};
};

describe('createDialect', () => {
	it('skips a stray json instead of inventing a locale from its directory', () => {
		const d = createDialect({
			messages: { ...messages, '/src/lib/messages/stray.json': { default: { x: 'X' } } },
			defaultLocale: 'en'
		});
		// 'messages' must not become a selectable locale
		expect(d.locales.sort()).toEqual(['en', 'ru']);
		expect(d.t('stray:x')).toBe('stray:x');
	});

	it('accepts region and script subtags in the locale segment', () => {
		const d = createDialect({
			messages: {
				'./messages/pt-BR/home.json': { default: { title: 'Olá' } },
				'./messages/zh-Hant/home.json': { default: { title: '你好' } }
			},
			defaultLocale: 'pt-BR'
		});
		expect(d.locales.sort()).toEqual(['pt-BR', 'zh-Hant']);
		expect(d.t('home:title')).toBe('Olá');
	});

	it('accepts a module object without a default export', () => {
		const d = createDialect({
			messages: { '/m/en/home.json': { title: 'Raw' } },
			defaultLocale: 'en'
		});
		expect(d.t('home:title')).toBe('Raw');
	});

	it('flattens arbitrarily deep nesting', () => {
		const d = createDialect({
			messages: { '/m/en/deep.json': { default: { a: { b: { c: { d: 'Bottom' } } } } } },
			defaultLocale: 'en'
		});
		expect(d.t('deep:a.b.c.d')).toBe('Bottom');
	});

	it('ignores non-string leaves, since an MF2 source is always a string', () => {
		const d = createDialect({
			messages: {
				'/m/en/odd.json': { default: { num: 5, nope: null, yes: 'Yes', flag: true } }
			},
			defaultLocale: 'en'
		});
		expect(d.t('odd:yes')).toBe('Yes');
		expect(d.t('odd:num')).toBe('odd:num');
		expect(d.t('odd:nope')).toBe('odd:nope');
		expect(d.t('odd:flag')).toBe('odd:flag');
	});

	it('keeps several namespaces for one locale side by side', () => {
		const d = make();
		expect(d.t('home:title')).toBe('Welcome');
		expect(d.t('nav:docs')).toBe('Docs');
	});

	it('derives locales from message paths', () => {
		expect(make().locales.sort()).toEqual(['en', 'ru']);
	});

	it('translates namespace:key', () => {
		expect(make().t('home:title')).toBe('Welcome');
	});

	it('resolves nested keys via dot path', () => {
		expect(make().t('home:nested.deep')).toBe('Deep value');
	});

	it('formats MF2 params', () => {
		expect(make().t('home:hello', { name: 'Kat' })).toBe('Hello Kat!');
	});

	it('handles MF2 plural selection', () => {
		const d = make();
		expect(d.t('home:items', { count: 1 })).toBe('1 item');
		expect(d.t('home:items', { count: 5 })).toBe('5 items');
	});

	it('splits on the first colon only, so extra colons stay in the path', () => {
		expect(make().t('home:odd:key')).toBe('Colon in the path');
	});

	it('returns the key when it has no namespace', () => {
		expect(make().t('title')).toBe('title');
	});

	it('returns the key for invalid MF2 source and warns only once', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const d = make();
		expect(d.t('home:bad')).toBe('home:bad');
		expect(d.t('home:bad')).toBe('home:bad');
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it('ignores an unknown locale instead of stranding t() on it', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const d = make();
		d.setLocale('de');
		expect(d.getLocale()).toBe('en');
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it('switches locale', () => {
		const d = make();
		d.setLocale('ru');
		expect(d.getLocale()).toBe('ru');
		expect(d.t('home:title')).toBe('Добро пожаловать');
	});

	it('falls back to defaultLocale for missing keys, then to the key itself', () => {
		const d = make();
		d.setLocale('ru');
		expect(d.t('nav:docs')).toBe('Docs'); // ru has no nav ns
		expect(d.t('home:missing.key')).toBe('home:missing.key');
	});

	it('ignores params for a message that has no placeholders', () => {
		expect(make().t('home:title', { unused: 'x' })).toBe('Welcome');
	});

	it('resolves an empty namespace list without touching the loader', async () => {
		const loader = vi.fn();
		const d = createDialect({ messages, defaultLocale: 'en', loader });
		await expect(d.loadTranslations([])).resolves.toMatchObject({ t: expect.any(Function) });
		expect(loader).not.toHaveBeenCalled();
	});

	it('treats an empty loader result as loaded and does not ask twice', async () => {
		const loader = vi.fn().mockResolvedValue({});
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await d.loadTranslations('remote');
		await d.loadTranslations('remote');
		expect(loader).toHaveBeenCalledOnce();
		expect(d.t('remote:whatever')).toBe('remote:whatever');
	});

	it('lets a reload join a plain load that is already in flight', async () => {
		let release!: (data: Record<string, unknown>) => void;
		const loader = vi.fn(() => new Promise<Record<string, unknown>>((r) => (release = r)));
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		const first = d.loadTranslations('remote');
		const second = d.loadTranslations('remote', { reload: true });
		release({ hi: 'Hi' });
		await Promise.all([first, second]);

		expect(loader).toHaveBeenCalledOnce();
	});

	it('loads a namespace on demand and formats it', async () => {
		const loader = vi.fn().mockResolvedValue({ card: { title: 'Remote' } });
		const d = createDialect({ messages, defaultLocale: 'en', loader });
		expect(d.t('remote:card.title')).toBe('remote:card.title');

		const { t } = await d.loadTranslations('remote');
		expect(t('remote:card.title')).toBe('Remote');
		expect(loader).toHaveBeenCalledWith({ locale: 'en', namespace: 'remote' });
	});

	it('accepts an array of namespaces and skips ones already bundled', async () => {
		const loader = vi.fn(async ({ namespace }: { namespace: string }) => ({ k: namespace }));
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await d.loadTranslations(['a', 'b', 'home']);
		expect(loader).toHaveBeenCalledTimes(2);
		expect(d.t('a:k')).toBe('a');
		expect(d.t('b:k')).toBe('b');
	});

	it('calls the loader once for concurrent requests of the same namespace', async () => {
		let release!: (data: Record<string, unknown>) => void;
		const loader = vi.fn(() => new Promise<Record<string, unknown>>((r) => (release = r)));
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		// ten "simultaneous SSR requests" for the same namespace
		const all = Promise.all(Array.from({ length: 10 }, () => d.loadTranslations('remote')));
		release({ hi: 'Hi' });
		await all;

		expect(loader).toHaveBeenCalledOnce();
		expect(d.t('remote:hi')).toBe('Hi');
	});

	it('joins a load that started earlier and is still in flight', async () => {
		let release!: (data: Record<string, unknown>) => void;
		const loader = vi.fn(() => new Promise<Record<string, unknown>>((r) => (release = r)));
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		// requests arriving over the life of one slow fetch, not all in the same tick
		const first = d.loadTranslations('remote');
		await new Promise((r) => setTimeout(r, 5));
		const second = d.loadTranslations('remote');
		await new Promise((r) => setTimeout(r, 5));
		const third = d.loadTranslations('remote');

		release({ hi: 'Hi' });
		await Promise.all([first, second, third]);

		expect(loader).toHaveBeenCalledOnce();
		expect(d.t('remote:hi')).toBe('Hi');
	});

	it('does not call the loader again once a namespace is cached', async () => {
		const loader = vi.fn().mockResolvedValue({ hi: 'Hi' });
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await d.loadTranslations('remote');
		await d.loadTranslations('remote');
		expect(loader).toHaveBeenCalledOnce();
	});

	it('replaces cached messages when reload is requested', async () => {
		const loader = vi.fn().mockResolvedValueOnce({ hi: 'Hi' }).mockResolvedValueOnce({ hi: 'Yo' });
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await d.loadTranslations('remote');
		expect(d.t('remote:hi')).toBe('Hi');

		await d.loadTranslations('remote', { reload: true });
		expect(d.t('remote:hi')).toBe('Yo');
		expect(loader).toHaveBeenCalledTimes(2);
	});

	it('drops keys the source removed when a namespace is reloaded', async () => {
		const loader = vi
			.fn()
			.mockResolvedValueOnce({ a: 'A', gone: 'Still here' })
			.mockResolvedValueOnce({ a: 'A2' });
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await d.loadTranslations('remote');
		expect(d.t('remote:gone')).toBe('Still here');

		await d.loadTranslations('remote', { reload: true });
		expect(d.t('remote:a')).toBe('A2');
		expect(d.t('remote:gone')).toBe('remote:gone');
	});

	it('loads per locale, not once globally', async () => {
		const loader = vi.fn(async ({ locale }: { locale: string }) => ({ hi: `Hi ${locale}` }));
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await d.loadTranslations('remote');
		d.setLocale('ru');
		await d.loadTranslations('remote');

		expect(loader).toHaveBeenCalledTimes(2);
		expect(d.t('remote:hi')).toBe('Hi ru');
	});

	it('propagates loader failures and retries on the next call', async () => {
		const loader = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ hi: 'Hi' });
		const d = createDialect({ messages, defaultLocale: 'en', loader });

		await expect(d.loadTranslations('remote')).rejects.toThrow('boom');
		await d.loadTranslations('remote');
		expect(d.t('remote:hi')).toBe('Hi');
	});

	it('unwraps a loader that resolves to a module, as a lazy glob entry is', async () => {
		const d = createDialect({
			messages,
			defaultLocale: 'en',
			loader: async () => ({ default: { hi: 'Hi' } })
		});
		await d.loadTranslations('remote');
		expect(d.t('remote:hi')).toBe('Hi');
	});

	it('names the namespace and locale when a loader resolves to something other than messages', async () => {
		for (const data of [null, 'hello', ['a']]) {
			const d = createDialect({ messages, defaultLocale: 'en', loader: async () => data as never });
			await expect(d.loadTranslations('remote')).rejects.toThrow(
				/loading "remote" for "en" must resolve to an object of messages/
			);
		}
	});

	it('keeps a bundled namespace when asked to reload it with nothing to reload from', async () => {
		const d = make();
		await d.loadTranslations('home', { reload: true });
		expect(d.t('home:title')).toBe('Welcome');
	});

	it('warns instead of rejecting when only a fallback locale fails to load', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const d = createDialect({
			messages: {
				...messages,
				'/m/ru/remote.json': async () => ({ default: { hi: 'Привет' } }),
				'/m/en/remote.json': async () => {
					throw new Error('Loading chunk 5 failed');
				}
			},
			defaultLocale: 'en'
		});
		d.setLocale('ru');

		await d.loadTranslations('remote');
		expect(d.t('remote:hi')).toBe('Привет');
		expect(warn).toHaveBeenCalledWith(
			'svelte-dialect: failed to load "remote" for "en"',
			expect.any(Error)
		);
		warn.mockRestore();
	});

	it('rejects when a namespace needs loading but no loader is configured', async () => {
		await expect(make().loadTranslations('remote')).rejects.toThrow(/no loader configured/);
	});

	it('exposes explicitly configured locales when nothing is bundled', () => {
		const d = createDialect({ defaultLocale: 'en', locales: ['en', 'ru'], loader: vi.fn() });
		expect(d.locales).toEqual(['en', 'ru']);
		d.setLocale('ru');
		expect(d.getLocale()).toBe('ru');
	});

	it('handle resolves locale from cookie and transforms %dialect.lang%', async () => {
		const d = make();
		const event = {
			cookies: { get: vi.fn().mockReturnValue('ru') },
			request: new Request('http://x/', { headers: { 'accept-language': 'en' } })
		} as never;
		const { resolve, seen } = noting(
			d,
			async (
				_e,
				opts: { transformPageChunk: (input: { html: string; done: boolean }) => string }
			) => {
				const html = opts.transformPageChunk({
					html: '<html lang="%dialect.lang%"><meta property="og:locale" content="%dialect.lang%">',
					done: true
				});
				return new Response(html as string);
			}
		);
		const res = await d.handle({ event, resolve } as never);
		// every occurrence, not just the first
		expect(await res.text()).toBe('<html lang="ru"><meta property="og:locale" content="ru">');
		expect(seen.locale).toBe('ru');
	});

	it("keeps a request's locale out of what code outside that request sees", async () => {
		// another hook in a sequence, handleError: on a server the shared value is every visitor's
		const d = make();
		const event = {
			cookies: { get: vi.fn().mockReturnValue('ru') },
			request: new Request('http://x/')
		} as never;
		const { resolve, seen } = noting(d);
		await d.handle({ event, resolve } as never);
		expect(seen.locale).toBe('ru');
		expect(d.getLocale()).toBe('en');
	});

	it('handle falls back to Accept-Language', async () => {
		const d = make();
		const event = {
			cookies: { get: vi.fn().mockReturnValue(undefined) },
			request: new Request('http://x/', {
				headers: { 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8' }
			})
		} as never;
		const { resolve, seen } = noting(d);
		await d.handle({ event, resolve } as never);
		expect(seen.locale).toBe('ru');
	});

	it('negotiates regional tags exactly, then by base language', async () => {
		const regional = createDialect({
			messages: {},
			locales: ['en-US', 'de-DE'],
			defaultLocale: 'de-DE'
		});
		// sequentially on purpose: one dialect holds one locale, which is the SSR ceiling in Backlog
		const run = async (header: string) => {
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/'),
				request: new Request('http://x/', { headers: { 'accept-language': header } })
			} as never;
			const { resolve, seen } = noting(regional);
			await regional.handle({ event, resolve } as never);
			return seen.locale;
		};

		expect(await run('en-US')).toBe('en-US');
		// no en-GB on offer, but the base language matches en-US
		expect(await run('en-GB,en;q=0.9')).toBe('en-US');
		expect(await run('de-AT')).toBe('de-DE');
		expect(await run('fr')).toBe('de-DE');
	});

	describe('lazy glob', () => {
		// values of a non-eager import.meta.glob: thunks resolving to a module with a default export
		const lazyMessages = {
			'/m/en/home.json': { default: { title: 'Welcome' } }, // eager and lazy can mix
			'/m/ru/home.json': async () => ({ default: { title: 'Добро пожаловать' } }),
			'/m/ru/extra.json': async () => ({ default: { deep: { key: 'Глубоко' } } })
		};

		it('derives locales from lazy paths too, without loading them', () => {
			const d = createDialect({ messages: lazyMessages, defaultLocale: 'en' });
			expect(d.locales.sort()).toEqual(['en', 'ru']);
		});

		it('loads a lazy namespace on demand and flattens it', async () => {
			const d = createDialect({ messages: lazyMessages, defaultLocale: 'en' });
			d.setLocale('ru');
			expect(d.t('home:title')).toBe('Welcome'); // not loaded yet → default-locale fallback

			const { t } = await d.loadTranslations(['home', 'extra']);
			expect(t('home:title')).toBe('Добро пожаловать');
			expect(t('extra:deep.key')).toBe('Глубоко');
		});

		it('needs no loader when the glob covers the namespace', async () => {
			const d = createDialect({ messages: lazyMessages, defaultLocale: 'en' });
			d.setLocale('ru');
			await expect(d.loadTranslations('home')).resolves.toMatchObject({
				t: expect.any(Function)
			});
		});

		it('prefers the glob entry over the user loader, which gets the rest', async () => {
			const loader = vi.fn(async () => ({ fromLoader: 'yes' }));
			const d = createDialect({ messages: lazyMessages, defaultLocale: 'en', loader });
			d.setLocale('ru');

			await d.loadTranslations(['home', 'cms']);
			expect(loader).toHaveBeenCalledTimes(1);
			expect(loader).toHaveBeenCalledWith({ locale: 'ru', namespace: 'cms' });
			expect(d.t('home:title')).toBe('Добро пожаловать');
			expect(d.t('cms:fromLoader')).toBe('yes');
		});

		it('accepts a lazy module without a default export', async () => {
			const d = createDialect({
				messages: { '/m/en/raw.json': async () => ({ title: 'Raw lazy' }) },
				defaultLocale: 'en'
			});
			const { t } = await d.loadTranslations('raw');
			expect(t('raw:title')).toBe('Raw lazy');
		});

		it('still throws for a namespace neither the glob nor a loader covers', async () => {
			const d = createDialect({ messages: lazyMessages, defaultLocale: 'en' });
			await expect(d.loadTranslations('nowhere')).rejects.toThrow(/no loader/);
		});
	});

	describe('url routing', () => {
		const make = () =>
			createDialect({
				messages: {
					'/m/en-US/home.json': { default: { title: 'Hello' } },
					'/m/de-DE/home.json': { default: { title: 'Hallo' } }
				},
				locales: ['en-US', 'de-DE'],
				defaultLocale: 'de-DE',
				routing: true
			});

		const visit = async (pathname: string, headers: Record<string, string> = {}) => {
			const d = make();
			const event = {
				cookies: { get: vi.fn() },
				url: new URL(`http://x${pathname}`),
				request: new Request(`http://x${pathname}`, { headers })
			} as never;
			const { resolve, seen } = noting(
				d,
				async (
					_e,
					opts: { transformPageChunk: (input: { html: string; done: boolean }) => string }
				) => new Response(opts.transformPageChunk({ html: '%dialect.lang%', done: true }) as string)
			);
			const res = await d.handle({ event, resolve } as never);
			// a redirect never reaches resolve(), so there is no served locale to report
			return {
				status: res.status,
				location: res.headers.get('location'),
				locale: seen.locale || d.getLocale()
			};
		};

		it('serves the default locale on the bare path', async () => {
			expect(await visit('/some/url')).toMatchObject({ status: 200, locale: 'de-DE' });
		});

		it('reads the locale from the prefix', async () => {
			expect(await visit('/en-US/some/url')).toMatchObject({ status: 200, locale: 'en-US' });
		});

		it('redirects the default locale prefix to the canonical path', async () => {
			expect(await visit('/de-DE/some/url')).toMatchObject({
				status: 308,
				location: '/some/url'
			});
		});

		it('lets the prefix outrank Accept-Language', async () => {
			const r = await visit('/en-US/some/url', { 'accept-language': 'de-DE' });
			expect(r.locale).toBe('en-US');
		});

		it('reroute strips the prefix so the route still matches', () => {
			const d = make();
			const strip = (p: string) => d.reroute({ url: new URL(`http://x${p}`) } as never);

			expect(strip('/en-US/some/url')).toBe('/some/url');
			expect(strip('/en-US')).toBe('/');
			expect(strip('/some/url')).toBe('/some/url');
			// a path that merely starts with something locale-shaped is left alone
			expect(strip('/entries/1')).toBe('/entries/1');
		});

		it('localizeHref prefixes everything but the default locale', () => {
			const d = make();
			expect(d.localizeHref('/some/url')).toBe('/some/url');
			expect(d.localizeHref('/some/url', 'en-US')).toBe('/en-US/some/url');
			expect(d.localizeHref('/', 'en-US')).toBe('/en-US');
			expect(d.localizeHref('/some/url', 'fr-FR')).toBe('/some/url');
		});

		it('localizeHref follows the current locale', () => {
			const d = make();
			d.setLocale('en-US');
			expect(d.localizeHref('/some/url')).toBe('/en-US/some/url');
		});

		it('localizeHref leaves anything that is not a root-relative path alone', () => {
			const d = make();

			expect(d.localizeHref('https://example.com/x', 'en-US')).toBe('https://example.com/x');
			expect(d.localizeHref('about', 'en-US')).toBe('about'); // not '/en-USabout'
			expect(d.localizeHref('#section', 'en-US')).toBe('#section');
			expect(d.localizeHref('mailto:hi@example.com', 'en-US')).toBe('mailto:hi@example.com');
			expect(d.localizeHref('', 'en-US')).toBe('');
		});

		it('localizeHref is idempotent, so an already-prefixed path never doubles up', () => {
			// the usual locale switcher feeds it page.url.pathname, which carries the current prefix
			const d = make();

			expect(d.localizeHref('/en-US/some/url', 'en-US')).toBe('/en-US/some/url');
			expect(d.localizeHref('/en-US/some/url', 'de-DE')).toBe('/some/url');
			expect(d.localizeHref('/en-US', 'en-US')).toBe('/en-US');
		});

		it('localizeHref keeps a query and a hash out of the locale logic', () => {
			const d = make();

			expect(d.localizeHref('/?page=2', 'en-US')).toBe('/en-US?page=2');
			expect(d.localizeHref('/en-US?page=2', 'en-US')).toBe('/en-US?page=2');
			expect(d.localizeHref('/en-US#hero', 'de-DE')).toBe('/#hero');
			expect(d.localizeHref('/about?x=1#h', 'en-US')).toBe('/en-US/about?x=1#h');
		});

		it('multiplies prerender entries across locales, default staying bare', () => {
			const d = make();

			expect(d.localizedEntries(['/', '/about'])).toEqual([
				'/',
				'/en-US',
				'/about',
				'/en-US/about'
			]);
		});

		it("localizedEntries seeds each locale's root for the '*' wildcard", () => {
			expect(make().localizedEntries(['*'])).toEqual(['*', '/en-US']);
		});

		it('localizedEntries is the identity when routing is off', () => {
			const d = createDialect({ messages, defaultLocale: 'en' });

			expect(d.localizedEntries(['/', '/about'])).toEqual(['/', '/about']);
		});

		it('leaves urls alone when routing is off', () => {
			const d = createDialect({ messages, defaultLocale: 'en' });
			expect(d.localizeHref('/some/url', 'ru')).toBe('/some/url');
			expect(d.reroute({ url: new URL('http://x/ru/some/url') } as never)).toBe('/ru/some/url');
		});
	});

	describe('the event handed to resolve()', () => {
		// `reroute` picks the route; the event keeps the address the browser is actually at.
		// SvelteKit derives relative asset paths (and the client's base) from `event.url`, so a
		// de-localised copy makes /ru/a/b load its scripts from /ru/_app/… and never hydrate.
		it('is the original event, prefix and request included', async () => {
			const d = createDialect({
				messages: { '/m/en/home.json': { default: { t: 'Hi' } } },
				locales: ['en', 'de-DE'],
				defaultLocale: 'en',
				routing: true
			});
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/de-DE/some/url?q=1'),
				request: new Request('http://x/de-DE/some/url?q=1')
			};
			let seen: unknown;
			let locale = '';
			await d.handle({
				event,
				resolve: async (next: unknown) => (
					(seen = next),
					(locale = d.getLocale()),
					new Response('ok')
				)
			} as never);

			expect(seen).toBe(event);
			expect(locale).toBe('de-DE');
		});
	});

	describe('text direction', () => {
		it('reports ltr and rtl from Intl rather than a hardcoded list', () => {
			const d = createDialect({ defaultLocale: 'en', locales: ['en', 'ar', 'he', 'fa', 'ru'] });

			expect(d.getTextDirection('en')).toBe('ltr');
			expect(d.getTextDirection('ru')).toBe('ltr');
			expect(d.getTextDirection('ar')).toBe('rtl');
			expect(d.getTextDirection('he')).toBe('rtl');
			expect(d.getTextDirection('fa')).toBe('rtl');
		});

		it('falls back to the RTL set when Intl has no text info', () => {
			// simulate a small-icu runtime: Intl.Locale exists but carries no textInfo
			const RealLocale = Intl.Locale;
			class BareLocale {
				language: string;
				constructor(tag: string) {
					if (/\s/.test(tag)) throw new RangeError('bad tag');
					this.language = tag.split('-')[0].toLowerCase();
				}
			}
			vi.stubGlobal('Intl', { ...Intl, Locale: BareLocale as never });
			try {
				const d = createDialect({ defaultLocale: 'en', locales: ['en', 'ar', 'ru'] });
				expect(d.getTextDirection('ar')).toBe('rtl');
				expect(d.getTextDirection('fa-IR')).toBe('rtl');
				expect(d.getTextDirection('ru')).toBe('ltr');
			} finally {
				vi.unstubAllGlobals();
				expect(Intl.Locale).toBe(RealLocale);
			}
		});

		it('defaults to the current locale and survives a nonsense tag', () => {
			const d = createDialect({ defaultLocale: 'ar', locales: ['ar', 'en'] });

			expect(d.getTextDirection()).toBe('rtl');
			expect(d.getTextDirection('not a tag')).toBe('ltr');
		});

		it('handle fills %dialect.dir% alongside the language', async () => {
			const d = createDialect({ defaultLocale: 'ar', locales: ['ar', 'en'] });
			const event = { cookies: { get: vi.fn() }, request: new Request('http://x/') } as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async (_e, opts) =>
					Promise.resolve(
						new Response(
							opts!.transformPageChunk!({
								html: '<html lang="%dialect.lang%" dir="%dialect.dir%">',
								done: true
							}) as string
						)
					)
				)
			} as never);

			expect(await res.text()).toBe('<html lang="ar" dir="rtl">');
		});
	});

	describe('strategy', () => {
		const messagesEnRu = {
			'/m/en/home.json': { default: { title: 'Hello' } },
			'/m/ru/home.json': { default: { title: 'Привет' } }
		};

		const ask = async (
			strategy: LocaleSource[] | undefined,
			signals: { cookie?: string; header?: string }
		) => {
			const d = createDialect({ messages: messagesEnRu, defaultLocale: 'en', strategy });
			const event = {
				cookies: { get: vi.fn().mockReturnValue(signals.cookie) },
				url: new URL('http://x/'),
				request: new Request('http://x/', {
					headers: signals.header ? { 'accept-language': signals.header } : {}
				})
			} as never;
			const { resolve, seen } = noting(d);
			await d.handle({ event, resolve } as never);
			return seen.locale;
		};

		it('prefers the cookie over the header by default', async () => {
			expect(await ask(undefined, { cookie: 'ru', header: 'en' })).toBe('ru');
		});

		it('honours a reordered strategy', async () => {
			expect(await ask(['header', 'cookie', 'default'], { cookie: 'ru', header: 'en' })).toBe('en');
		});

		it('skips a source that is not configured and falls through', async () => {
			// no cookie on this request, so the header decides even though cookie comes first
			expect(await ask(['cookie', 'header', 'default'], { header: 'ru' })).toBe('ru');
		});

		it('lets a strategy leave out a source entirely', async () => {
			expect(await ask(['cookie', 'default'], { header: 'ru' })).toBe('en');
		});

		it('falls back to defaultLocale when the strategy names nothing usable', async () => {
			expect(await ask(['header'], { header: 'de' })).toBe('en');
		});
	});

	describe('adverse conditions', () => {
		it('warns about a typo in the strategy list instead of silently ignoring it', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			createDialect({
				messages,
				defaultLocale: 'en',
				strategy: ['cookie', 'navigatior' as never, 'default']
			});
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('navigatior'));
			warn.mockRestore();
		});

		it('boots with a completely empty configuration', () => {
			const d = createDialect({ defaultLocale: 'en' });
			expect(d.locales).toEqual([]);
			expect(d.getLocale()).toBe('en');
			expect(d.t('any:key')).toBe('any:key');
		});

		it('works when defaultLocale has no messages of its own', () => {
			const d = createDialect({
				messages: { '/m/ru/home.json': { default: { title: 'Привет' } } },
				defaultLocale: 'en'
			});
			// current locale is en, en has nothing, fallback finds nothing → key
			expect(d.t('home:title')).toBe('home:title');
			d.setLocale('ru');
			expect(d.t('home:title')).toBe('Привет');
		});

		it('does not treat a garbage cookie as a locale', async () => {
			const d = make();
			const event = {
				cookies: { get: vi.fn().mockReturnValue('ru"; Path=/; HttpOnly') },
				request: new Request('http://x/', { headers: { 'accept-language': 'ru' } })
			} as never;
			const { resolve, seen } = noting(d);
			await d.handle({ event, resolve } as never);
			// the mangled cookie matches nothing; the header still does
			expect(seen.locale).toBe('ru');
		});

		it('survives a malformed Accept-Language header', async () => {
			const d = make();
			for (const header of [';;;,,,', 'q=0.9', '*', ' , ; , ', 'x'.repeat(10_000)]) {
				const event = {
					cookies: { get: vi.fn() },
					request: new Request('http://x/', { headers: { 'accept-language': header } })
				} as never;
				await d.handle({ event, resolve: vi.fn(async () => new Response('')) } as never);
				expect(d.getLocale()).toBe('en');
			}
		});

		it('keeps prototype junk out of the catalog', () => {
			const d = createDialect({
				messages: {
					'/m/en/home.json': {
						default: JSON.parse('{"__proto__": {"polluted": "yes"}, "safe": "ok"}')
					}
				},
				defaultLocale: 'en'
			});
			expect(d.t('home:safe')).toBe('ok');
			expect(({} as Record<string, unknown>).polluted).toBeUndefined();
			expect(d.t('home:constructor')).toBe('home:constructor');
		});

		it('keeps a message keyed "__proto__" as a message', () => {
			const d = createDialect({
				messages: { '/m/en/home.json': { default: JSON.parse('{"__proto__": "Odd but valid"}') } },
				defaultLocale: 'en'
			});
			expect(d.t('home:__proto__')).toBe('Odd but valid');
		});

		it('treats a message named like an Object.prototype member as missing, not as a function', () => {
			// catalog lookups use plain objects; 'toString' must not resolve via the prototype chain
			expect(make().t('home:toString')).toBe('home:toString');
			expect(make().t('toString:x')).toBe('toString:x');
		});

		it('an unknown "__proto__" key does not poison every other still-uncompiled message', () => {
			const first = make();
			// previously: catalog[loc]?.[ns]?.[path] resolved this to Object.prototype itself, and the
			// failed-compile branch then wrote `mf: null` straight onto it
			first.t('home:__proto__');
			expect(Object.hasOwn(Object.prototype, 'mf')).toBe(false);
			// a second, unrelated instance's ordinary message must still compile
			const second = make();
			expect(second.t('home:title')).toBe('Welcome');
		});
	});

	describe('open redirect', () => {
		const routingMake = () =>
			createDialect({ messages, defaultLocale: 'en', routing: true, base: '' });

		it('does not let stripping the default-locale prefix turn the path protocol-relative', async () => {
			const d = routingMake();
			for (const path of ['/en//evil.example/x', '/en///evil.example']) {
				const event = {
					url: new URL(`http://x${path}`),
					request: new Request(`http://x${path}`)
				} as never;
				const res = await d.handle({
					event,
					resolve: vi.fn(async () => new Response(''))
				} as never);
				expect(res.status).toBe(308);
				const location = res.headers.get('location')!;
				expect(location.startsWith('//')).toBe(false);
				expect(new URL(location, 'http://x').host).toBe('x');
			}
		});

		it('localizeHref treats a protocol-relative path as external, not as a route', () => {
			const d = routingMake();
			expect(d.localizeHref('//evil.example/x', 'ru')).toBe('//evil.example/x');
			// a browser reads a backslash as a slash, so these are protocol-relative as well
			expect(d.localizeHref('/\\evil.example/x', 'ru')).toBe('/\\evil.example/x');
			expect(new URL(d.localizeHref('/ru/\\evil.example', 'en'), 'http://x').host).toBe('x');
		});
	});

	describe('bidi isolation', () => {
		it('is off by default so LTR output stays plain', () => {
			expect(make().t('home:hello', { name: 'Kat' })).toBe('Hello Kat!');
		});

		it('wraps interpolations in isolates when enabled', () => {
			const d = createDialect({
				messages: { '/m/ar/home.json': { default: { hi: 'مرحبا {$name}' } } },
				defaultLocale: 'ar',
				bidiIsolation: true
			});
			const out = d.t('home:hi', { name: 'Kat' });
			expect(out).toBe('مرحبا ⁨Kat⁩'); // FSI…PDI around the LTR name inside RTL text
		});
	});

	describe('formatting functions', () => {
		// The MF2 draft functions — :currency, :date, :time and friends — against two locales whose
		// output differs in every way that matters: symbol placement, month name, hour cycle.
		const formats = {
			'/m/en/fmt.json': {
				default: {
					price: 'Total: {$amount :currency currency=EUR}',
					due: 'Due {$when :date length=long}',
					at: 'At {$when :time precision=minute timeZone=UTC}',
					share: 'Uptime {$part :percent}'
				}
			},
			'/m/de-DE/fmt.json': {
				default: {
					price: 'Summe: {$amount :currency currency=EUR}',
					due: 'Fällig am {$when :date length=long}',
					at: 'Um {$when :time precision=minute timeZone=UTC}'
				}
			}
		};
		const when = new Date(Date.UTC(2025, 2, 1, 15, 30));
		// Expectations come from Intl with the options MF2 resolves these to, so the assertions
		// survive an ICU data update that renames a month or moves a currency symbol.
		const money = (locale: string) =>
			new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(1234.5);
		const day = (locale: string) =>
			new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
				when
			);
		const clock = (locale: string) =>
			new Intl.DateTimeFormat(locale, {
				hour: 'numeric',
				minute: 'numeric',
				timeZone: 'UTC'
			}).format(when);

		const inLocale = (locale: string) => {
			const d = createDialect({ messages: formats, defaultLocale: 'en' });
			d.setLocale(locale);
			return d;
		};

		it('formats currency in the active locale', () => {
			expect(inLocale('en').t('fmt:price', { amount: 1234.5 })).toBe(`Total: ${money('en')}`);
			expect(inLocale('de-DE').t('fmt:price', { amount: 1234.5 })).toBe(`Summe: ${money('de-DE')}`);
		});

		it('formats dates in the active locale', () => {
			expect(inLocale('en').t('fmt:due', { when })).toBe(`Due ${day('en')}`);
			expect(inLocale('de-DE').t('fmt:due', { when })).toBe(`Fällig am ${day('de-DE')}`);
		});

		it('formats times in the active locale', () => {
			expect(inLocale('en').t('fmt:at', { when })).toBe(`At ${clock('en')}`);
			expect(inLocale('de-DE').t('fmt:at', { when })).toBe(`Um ${clock('de-DE')}`);
		});

		it('leaves no MF2 fallback text behind for a draft function', () => {
			// '{$part}' is the shape the message takes when its function isn't registered
			const out = inLocale('en').t('fmt:share', { part: 0.25 });
			expect(out).not.toContain('{$');
			expect(out).toBe(`Uptime ${new Intl.NumberFormat('en', { style: 'percent' }).format(0.25)}`);
		});

		it('registers a custom function passed in options', () => {
			const d = createDialect({
				messages: { '/m/en/fmt.json': { default: { shout: 'Hey {$who :shout}' } } },
				defaultLocale: 'en',
				functions: {
					shout: (_ctx, _options, operand) => ({
						type: 'string',
						toString: () => String(operand).toUpperCase()
					})
				}
			});
			expect(d.t('fmt:shout', { who: 'kat' })).toBe('Hey KAT');
		});

		it('lets a custom function take over a built-in name', () => {
			const d = createDialect({
				messages: { '/m/en/fmt.json': { default: { price: '{$amount :currency}' } } },
				defaultLocale: 'en',
				functions: {
					currency: (_ctx, _options, operand) => ({
						type: 'string',
						toString: () => `${operand} credits`
					})
				}
			});
			expect(d.t('fmt:price', { amount: 7 })).toBe('7 credits');
		});

		it('keeps a fallback value in formatParts, where it would otherwise vanish', () => {
			const d = createDialect({
				messages: { '/m/en/fmt.json': { default: { hi: 'Hello {$missing}!' } } },
				defaultLocale: 'en',
				onError: () => {}
			});
			expect(d.formatParts('fmt:hi')).toEqual([{ type: 'text', value: 'Hello {$missing}!' }]);
		});

		it('still degrades to fallback text for a function nobody registered', () => {
			const onError = vi.fn();
			const d = createDialect({
				messages: { '/m/en/fmt.json': { default: { odd: 'A {$x :nope}' } } },
				defaultLocale: 'en',
				onError
			});
			expect(d.t('fmt:odd', { x: 1 })).toBe('A {$x}');
			expect(onError).toHaveBeenCalledOnce();
		});
	});

	describe('onError', () => {
		it('takes the invalid-source report instead of the console, once per message', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const onError = vi.fn();
			const d = createDialect({ messages, defaultLocale: 'en', onError });

			expect(d.t('home:bad')).toBe('home:bad');
			expect(d.t('home:bad')).toBe('home:bad');
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][1]).toEqual({ key: 'home:bad', locale: 'en' });
			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});

		it('takes format-time errors, which MF2 would otherwise log itself', () => {
			const onError = vi.fn();
			const d = createDialect({ messages, defaultLocale: 'en', onError });

			// no `name` param: MF2 reports an unresolved variable and returns fallback text
			expect(d.t('home:hello')).toBe('Hello {$name}!');
			expect(onError).toHaveBeenCalledOnce();
			expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
			expect(onError.mock.calls[0][1]).toEqual({ key: 'home:hello', locale: 'en' });
		});

		it('stays quiet while nothing goes wrong', () => {
			const onError = vi.fn();
			const d = createDialect({ messages, defaultLocale: 'en', onError });

			expect(d.t('home:hello', { name: 'Kat' })).toBe('Hello Kat!');
			expect(onError).not.toHaveBeenCalled();
		});
	});

	describe('request isolation', () => {
		const serve = (d: ReturnType<typeof make>, lang: string, delayMs: number, out: string[]) =>
			d.handle({
				event: {
					cookies: { get: vi.fn() },
					url: new URL('http://x/'),
					request: new Request('http://x/', { headers: { 'accept-language': lang } })
				},
				resolve: vi.fn(async () => {
					// the window where the old shared-state model lost the race
					await new Promise((r) => setTimeout(r, delayMs));
					out.push(`${lang}:${d.getLocale()}:${d.t('home:title')}`);
					return new Response('');
				})
			} as never);

		it('keeps concurrent requests on their own locales', async () => {
			const d = make();
			const seen: string[] = [];

			// the ru request is slow; the en request lands mid-flight and must not poison it
			await Promise.all([serve(d, 'ru', 40, seen), serve(d, 'en', 5, seen)]);

			expect(seen).toContain('ru:ru:Добро пожаловать');
			expect(seen).toContain('en:en:Welcome');
		});

		it('survives a stampede of interleaved languages', async () => {
			const d = make();
			const seen: string[] = [];

			await Promise.all(
				Array.from({ length: 20 }, (_, i) => serve(d, i % 2 ? 'ru' : 'en', (i * 7) % 23, seen))
			);

			for (const line of seen) {
				const [asked, got] = line.split(':');
				expect(got).toBe(asked);
			}
		});

		it('marks language-dependent responses for shared caches', async () => {
			const d = make();
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/'),
				request: new Request('http://x/', { headers: { 'accept-language': 'ru' } })
			} as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async () => new Response('ok'))
			} as never);

			expect(res.headers.get('vary')).toContain('accept-language');
		});

		it("varies on cookie too when it participates — a shared cache can't collapse two visitors on different cookies", async () => {
			const d = createDialect({ messages, defaultLocale: 'en', strategy: ['cookie', 'default'] });
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/'),
				request: new Request('http://x/')
			} as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async () => new Response('ok'))
			} as never);

			expect(res.headers.get('vary')).toContain('cookie');
			expect(res.headers.get('vary')).not.toContain('accept-language');
		});

		it('adds to a Vary the response already has without repeating a token', async () => {
			const d = make();
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/'),
				request: new Request('http://x/')
			} as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async () => new Response('ok', { headers: { vary: 'Accept-Language' } }))
			} as never);

			expect(res.headers.get('vary')).toBe('Accept-Language, cookie');
		});

		it('omits Vary when neither header nor cookie participates', async () => {
			const d = createDialect({ messages, defaultLocale: 'en', strategy: ['default'] });
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/'),
				request: new Request('http://x/')
			} as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async () => new Response('ok'))
			} as never);

			expect(res.headers.get('vary')).toBeNull();
		});

		it('keeps Vary appendable on a redirect Response with immutable headers', async () => {
			const d = createDialect({ messages, defaultLocale: 'en', strategy: ['header', 'default'] });
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/'),
				request: new Request('http://x/', { headers: { 'accept-language': 'en' } })
			} as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async () => Response.redirect('http://x/elsewhere', 302))
			} as never);

			expect(res.status).toBe(302);
			expect(res.headers.get('location')).toBe('http://x/elsewhere');
			expect(res.headers.get('vary')).toContain('accept-language');
		});
	});

	describe('base path', () => {
		// A site served from a subdirectory: every pathname SvelteKit hands us carries `/app`.
		const make = () =>
			createDialect({
				messages: {
					'/m/en/home.json': { default: { t: 'Hi' } },
					'/m/ru/home.json': { default: { t: 'Привет' } }
				},
				defaultLocale: 'en',
				locales: ['en', 'ru'],
				routing: true,
				base: '/app'
			});

		it('finds the locale after the base rather than reading the base as one', () => {
			expect(make().localizeHref('/app/ru/about', 'ru')).toBe('/app/ru/about');
		});

		it('recognises the base when a query or a hash follows it directly', () => {
			expect(make().localizeHref('/app?q=1', 'ru')).toBe('/app/ru?q=1');
			expect(make().localizeHref('/app/ru#top', 'en')).toBe('/app#top');
		});

		it('keeps the base in what reroute returns, since kit 404s without it', () => {
			const d = make();
			expect(d.reroute({ url: new URL('http://x/app/ru/about') } as never)).toBe('/app/about');
			expect(d.reroute({ url: new URL('http://x/app/about') } as never)).toBe('/app/about');
			// the root of a based app is the base itself
			expect(d.reroute({ url: new URL('http://x/app/ru') } as never)).toBe('/app');
		});

		it('builds hrefs with the base, from paths given with or without it', () => {
			const d = make();
			expect(d.localizeHref('/about', 'ru')).toBe('/app/ru/about');
			expect(d.localizeHref('/app/about', 'ru')).toBe('/app/ru/about');
			expect(d.localizeHref('/about', 'en')).toBe('/app/about');
			expect(d.localizeHref('/', 'ru')).toBe('/app/ru');
			expect(d.localizeHref('/', 'en')).toBe('/app');
		});

		it('leaves prerender entries base-free, because kit prepends paths.base itself', () => {
			expect(make().localizedEntries(['/', '/about'])).toEqual(['/', '/ru', '/about', '/ru/about']);
		});

		it('reads the locale after the base, keeps event.url whole, and redirects within the base', async () => {
			const d = make();
			const seen: string[] = [];
			const event = {
				cookies: { get: vi.fn(), set: vi.fn() },
				url: new URL('http://x/app/ru/about'),
				request: new Request('http://x/app/ru/about')
			} as never;
			await d.handle({
				event,
				resolve: vi.fn(async (e: { url: URL }) => {
					seen.push(e.url.pathname, d.getLocale());
					return new Response('');
				})
			} as never);
			expect(seen).toEqual(['/app/ru/about', 'ru']);

			const redirect = await d.handle({
				event: {
					cookies: { get: vi.fn(), set: vi.fn() },
					url: new URL('http://x/app/en/about'),
					request: new Request('http://x/app/en/about', {
						headers: { 'sec-fetch-dest': 'document' }
					})
				} as never,
				resolve: vi.fn(async () => new Response(''))
			} as never);
			expect(redirect.status).toBe(308);
			expect(redirect.headers.get('location')).toBe('/app/about');
		});

		it('tolerates a trailing slash on the option', () => {
			const d = createDialect({
				messages: { '/m/en/h.json': { default: { t: 'Hi' } }, '/m/ru/h.json': { default: {} } },
				defaultLocale: 'en',
				routing: true,
				base: '/app/'
			});
			expect(d.localizeHref('/about', 'ru')).toBe('/app/ru/about');
		});

		it('does not mistake a route that merely starts like the base', () => {
			// `/application` is not inside `/app`, so nothing is stripped
			expect(make().localizeHref('/application', 'ru')).toBe('/app/ru/application');
		});
	});

	describe('Accept-Language negotiation', () => {
		const negotiated = async (locales: string[], header: string) => {
			const d = createDialect({ defaultLocale: locales[0], locales, loader: vi.fn() });
			let seen = '';
			await d.handle({
				event: {
					cookies: { get: vi.fn(), set: vi.fn() },
					url: new URL('http://x/'),
					request: new Request('http://x/', { headers: { 'accept-language': header } })
				},
				resolve: vi.fn(async () => ((seen = d.getLocale()), new Response('')))
			} as never);
			return seen;
		};

		it('drops a malformed or out-of-range weight instead of promoting it', async () => {
			expect(await negotiated(['de', 'en', 'ru'], 'ru;q=abc, en;q=0.9')).toBe('en');
			expect(await negotiated(['de', 'en', 'ru'], 'ru;q=5, en;q=0.5')).toBe('en');
			expect(await negotiated(['de', 'en', 'ru'], 'ru;q=0.9, en;q = 0.1')).toBe('ru');
		});

		it('tries every exact tag before a related one', async () => {
			expect(await negotiated(['de', 'en-AU', 'en-US'], 'en-GB, en-US;q=0.9')).toBe('en-US');
		});

		it('keeps the script subtag when falling back', async () => {
			expect(await negotiated(['en', 'zh-Hans', 'zh-Hant'], 'zh-Hant-HK')).toBe('zh-Hant');
		});

		it('never falls back to a language the visitor refused with q=0', async () => {
			expect(await negotiated(['en', 'de'], 'de-DE;q=0.9, de;q=0, fr;q=0.8')).toBe('en');
		});
	});

	describe('locale fallback chain', () => {
		it('falls back to a same-language sibling before the default locale', () => {
			const d = createDialect({
				messages: {
					'/m/en/home.json': { default: { a: 'A en', b: 'B en' } },
					'/m/de-DE/home.json': { default: { a: 'A de-DE' } },
					'/m/de-AT/home.json': { default: {} }
				},
				defaultLocale: 'en'
			});
			d.setLocale('de-AT');

			expect(d.t('home:a')).toBe('A de-DE'); // sibling first
			expect(d.t('home:b')).toBe('B en'); // then the default
		});

		it('prefers the sibling with the same script', () => {
			const d = createDialect({
				messages: {
					'/m/en/home.json': { default: { a: 'A en' } },
					'/m/zh-Hans/home.json': { default: { a: '简体' } },
					'/m/zh-Hant/home.json': { default: { a: '繁體' } },
					'/m/zh-Hant-TW/home.json': { default: {} }
				},
				defaultLocale: 'en'
			});
			d.setLocale('zh-Hant-TW');

			expect(d.t('home:a')).toBe('繁體');
		});

		it('ignores catalog locales the app does not offer', () => {
			const d = createDialect({
				messages: {
					'/m/en/home.json': { default: { a: 'A en' } },
					'/m/de-CH/home.json': { default: { a: 'A de-CH' } }
				},
				locales: ['en', 'de-AT'],
				defaultLocale: 'en'
			});
			d.setLocale('de-AT');

			expect(d.t('home:a')).toBe('A en'); // de-CH is in the catalog but not on offer
		});
	});

	describe('format helpers', () => {
		it('formats numbers and dates in the active locale', async () => {
			const d = make();
			const when = new Date(Date.UTC(2026, 0, 15));

			expect(d.formatNumber(1234.5)).toBe('1,234.5');
			d.setLocale('ru');
			expect(d.formatNumber(1234.5)).toBe('1 234,5');
			expect(d.formatDate(when, { month: 'long', timeZone: 'UTC' })).toBe('январь');
		});

		it('uses the request locale on the server, not the shared rune', async () => {
			const d = make();
			const seen: string[] = [];
			await Promise.all(
				['ru', 'en'].map((lang) =>
					d.handle({
						event: {
							cookies: { get: vi.fn(), set: vi.fn() },
							url: new URL('http://x/'),
							request: new Request('http://x/', { headers: { 'accept-language': lang } })
						},
						resolve: vi.fn(async () => {
							await new Promise((r) => setTimeout(r, lang === 'ru' ? 25 : 5));
							seen.push(`${lang}:${d.formatNumber(1000.5)}`);
							return new Response('');
						})
					} as never)
				)
			);
			expect(seen).toContain('en:1,000.5');
			expect(seen).toContain('ru:1 000,5');
		});
	});

	describe('cookie options', () => {
		it('accepts a full cookie shape and honours the name server-side', async () => {
			const get = vi.fn().mockReturnValue('ru');
			const d = createDialect({
				messages,
				defaultLocale: 'en',
				cookie: { name: 'lang', maxAge: 60 }
			});
			const { resolve, seen } = noting(d);
			await d.handle({
				event: {
					cookies: { get, set: vi.fn() },
					url: new URL('http://x/'),
					request: new Request('http://x/')
				},
				resolve
			} as never);

			expect(get).toHaveBeenCalledWith('lang');
			expect(seen.locale).toBe('ru');
		});
	});

	describe('detectOnBarePath', () => {
		const make = (detect: boolean) =>
			createDialect({
				messages: {
					'/m/en/home.json': { default: { t: 'Hi' } },
					'/m/ru/home.json': { default: { t: 'Привет' } }
				},
				defaultLocale: 'en',
				routing: true,
				detectOnBarePath: detect
			});

		const hit = (
			d: ReturnType<typeof make>,
			path: string,
			headers: Record<string, string>,
			cookieValue?: string
		) => {
			const set = vi.fn();
			const response = d.handle({
				event: {
					cookies: { get: vi.fn().mockReturnValue(cookieValue), set },
					url: new URL(`http://x${path}`),
					request: new Request(`http://x${path}`, { headers })
				},
				resolve: vi.fn(async () => new Response('content'))
			} as never);
			return Promise.resolve(response).then((r) => ({ r, set }));
		};

		it('redirects a bare document visit to the cookie locale with 307', async () => {
			const { r } = await hit(make(true), '/about', { 'sec-fetch-dest': 'document' }, 'ru');
			expect(r.status).toBe(307);
			expect(r.headers.get('location')).toBe('/ru/about');
		});

		it('redirects on Accept-Language when there is no cookie, with Vary', async () => {
			const { r } = await hit(make(true), '/', { 'accept-language': 'ru' });
			expect(r.status).toBe(307);
			expect(r.headers.get('location')).toBe('/ru');
			expect(r.headers.get('vary')).toContain('accept-language');
		});

		it('serves the default locale with no signal, and programmatic fetches always', async () => {
			expect((await hit(make(true), '/about', {})).r.status).toBe(200);
			expect((await hit(make(true), '/about', { 'sec-fetch-dest': 'empty' }, 'ru')).r.status).toBe(
				200
			);
		});

		it('lets a prefixed URL win and refresh the cookie', async () => {
			const { r, set } = await hit(make(true), '/ru/about', { 'sec-fetch-dest': 'document' }, 'en');
			expect(r.status).toBe(200);
			expect(set).toHaveBeenCalledWith(
				'dialect',
				'ru',
				expect.objectContaining({ httpOnly: false, path: '/' })
			);
		});

		it("lets the default locale's own prefix win over the cookie too", async () => {
			// /en/about → 308 /about; without a cookie refresh the `ru` cookie would 307 it on to /ru
			const { r } = await hit(make(true), '/en/about', { 'sec-fetch-dest': 'document' }, 'ru');
			expect(r.status).toBe(308);
			expect(r.headers.get('location')).toBe('/about');
			expect(r.headers.get('set-cookie')).toMatch(/^dialect=en;path=\//);
			// and nothing to refresh when the cookie already says so
			const same = await hit(make(true), '/en/about', { 'sec-fetch-dest': 'document' }, 'en');
			expect(same.r.headers.get('set-cookie')).toBeNull();
		});

		it('does none of it when the option is off', async () => {
			const { r, set } = await hit(make(false), '/about', { 'sec-fetch-dest': 'document' }, 'ru');
			expect(r.status).toBe(200);
			const prefixed = await hit(make(false), '/ru/about', {}, 'en');
			expect(prefixed.set).not.toHaveBeenCalled();
			expect(set).not.toHaveBeenCalled();
		});
	});

	describe('redirect scope', () => {
		const hit = async (dest: string | undefined) => {
			const d = createDialect({
				messages: { '/m/en/home.json': { default: { t: 'Hi' } } },
				locales: ['en', 'ru'],
				defaultLocale: 'en',
				routing: true
			});
			const headers: Record<string, string> = dest ? { 'sec-fetch-dest': dest } : {};
			const event = {
				cookies: { get: vi.fn() },
				url: new URL('http://x/en/some/url'),
				request: new Request('http://x/en/some/url', { headers })
			} as never;
			const res = await d.handle({
				event,
				resolve: vi.fn(async () => new Response('content'))
			} as never);
			return res.status;
		};

		it('redirects browser navigations off the default-locale prefix', async () => {
			expect(await hit('document')).toBe(308);
		});

		it('redirects clients that send no Sec-Fetch-Dest, like bots and curl', async () => {
			expect(await hit(undefined)).toBe(308);
		});

		it('serves programmatic fetches instead of redirecting them', async () => {
			expect(await hit('empty')).toBe(200);
		});
	});

	describe('configure', () => {
		/** A routing dialect whose locale set is meant to be replaced at runtime. */
		const routed = (locales: string[], defaultLocale: string) =>
			createDialect({
				messages: { '/m/en/home.json': { default: { title: 'Hello' } } },
				locales,
				defaultLocale,
				routing: true
			});

		const visit = async (d: ReturnType<typeof routed>, pathname: string) => {
			const event = {
				cookies: { get: vi.fn() },
				url: new URL(`http://x${pathname}`),
				request: new Request(`http://x${pathname}`)
			} as never as { url: URL; request: Request };
			const { resolve, seen } = noting(d, async () => new Response('content'));
			const res = await d.handle({ event, resolve } as never);
			return {
				status: res.status,
				location: res.headers.get('location'),
				locale: seen.locale || d.getLocale(),
				url: event.url.pathname
			};
		};

		it('negotiates against the locale set it installed, not the one init knew', async () => {
			const d = createDialect({ defaultLocale: 'en', locales: ['en'] });
			expect(await runHandle(d, { header: 'de-DE' })).toMatchObject({ locale: 'en' });

			d.configure({ locales: ['en', 'de-DE'] });

			expect(await runHandle(d, { header: 'de-DE' })).toMatchObject({ locale: 'de-DE' });
		});

		it('falls back to the newly configured default, placeholder included', async () => {
			const d = createDialect({ messages, defaultLocale: 'en' });

			d.configure({ defaultLocale: 'ru' });

			expect(await runHandle(d, {})).toEqual({ html: '<html lang="ru">', locale: 'ru' });
		});

		it('moves the canonical address when the default locale changes', async () => {
			const d = routed(['en', 'de-DE'], 'en');
			expect(await visit(d, '/de-DE/some/url')).toMatchObject({ status: 200, locale: 'de-DE' });

			d.configure({ defaultLocale: 'de-DE' });

			// de-DE now lives on the bare path, and en is the one that needs a prefix
			expect(await visit(d, '/de-DE/some/url')).toMatchObject({
				status: 308,
				location: '/some/url'
			});
			expect(await visit(d, '/en/some/url')).toMatchObject({ status: 200, locale: 'en' });
			expect(await visit(d, '/some/url')).toMatchObject({ status: 200, locale: 'de-DE' });
		});

		it('turns a prefix it configured away into an unknown one', async () => {
			const d = routed(['en', 'ru'], 'en');
			const strip = (p: string) => d.reroute({ url: new URL(`http://x${p}`) } as never);
			expect(strip('/ru/about')).toBe('/about');

			d.configure({ locales: ['en'] });

			// no longer a route: SvelteKit is handed the path verbatim and answers 404, exactly as it
			// would for a prefix nobody ever configured
			expect(strip('/ru/about')).toBe('/ru/about');
			// and handle stops reading it as a locale, so the request is served in the default one
			expect(await visit(d, '/ru/about')).toMatchObject({ locale: 'en', url: '/ru/about' });
		});

		it('follows the new default in localizeHref and localizedEntries', () => {
			const d = routed(['en', 'de-DE', 'ru'], 'en');
			expect(d.localizeHref('/about', 'de-DE')).toBe('/de-DE/about');

			d.configure({ defaultLocale: 'de-DE', locales: ['en', 'de-DE'] });

			expect(d.localizeHref('/about', 'de-DE')).toBe('/about');
			expect(d.localizeHref('/about', 'en')).toBe('/en/about');
			// ru is no longer on offer, so it gets the bare path like any unknown locale
			expect(d.localizeHref('/about', 'ru')).toBe('/about');
			expect(d.localizedEntries(['/', '/about'])).toEqual(['/', '/en', '/about', '/en/about']);
		});

		it('rewrites the locales array in place, so a destructured copy stays current', () => {
			const d = createDialect({ defaultLocale: 'en', locales: ['en', 'ru'] });
			const { locales } = d;

			d.configure({ defaultLocale: 'de-DE', locales: ['de-DE', 'fr'] });

			expect(locales).toBe(d.locales);
			expect(locales).toEqual(['de-DE', 'fr']);
		});

		it('drops repeats, which a switcher and localizedEntries would otherwise show twice', () => {
			const d = createDialect({ defaultLocale: 'en', locales: ['en'] });

			d.configure({ locales: ['en', 'ru', 'en'] });

			expect(d.locales).toEqual(['en', 'ru']);
		});

		it('re-points the current locale when it is configured away', () => {
			const d = createDialect({ messages, defaultLocale: 'en' });
			d.setLocale('ru');

			d.configure({ locales: ['en'] });

			expect(d.getLocale()).toBe('en');
		});

		it('leaves a current locale that survived the change alone', () => {
			const d = createDialect({ messages, defaultLocale: 'en' });
			d.setLocale('ru');

			d.configure({ locales: ['en', 'ru', 'de'] });

			expect(d.getLocale()).toBe('ru');
		});

		it('narrows what setLocale accepts', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const d = createDialect({ messages, defaultLocale: 'en' });

			d.configure({ locales: ['en', 'de'] });
			d.setLocale('ru');

			expect(d.getLocale()).toBe('en');
			expect(warn).toHaveBeenCalledOnce();
			warn.mockRestore();
		});

		it('takes an empty list as "no list yet", the way init does', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const d = createDialect({ messages, defaultLocale: 'en' });

			d.configure({ locales: [] });

			expect(warn).not.toHaveBeenCalled();
			expect(d.locales).toEqual([]);
			expect(d.getLocale()).toBe('en');
			warn.mockRestore();
		});

		it('changes nothing when nothing is passed', () => {
			const d = createDialect({ messages, defaultLocale: 'en' });

			d.configure({});
			d.configure();

			expect(d.locales.sort()).toEqual(['en', 'ru']);
			expect(d.getLocale()).toBe('en');
		});

		describe('rejects and keeps what it had', () => {
			const attempt = (call: (d: ReturnType<typeof routed>) => void) => {
				const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const d = routed(['en', 'de-DE'], 'en');
				d.setLocale('de-DE', { reload: false });

				call(d);

				expect(warn).toHaveBeenCalledWith(expect.stringContaining('configure()'));
				expect(d.locales).toEqual(['en', 'de-DE']);
				expect(d.getLocale()).toBe('de-DE');
				expect(d.localizeHref('/about', 'de-DE')).toBe('/de-DE/about');
				warn.mockRestore();
			};

			it('a default locale outside the new list', () => {
				attempt((d) => d.configure({ defaultLocale: 'fr', locales: ['en', 'de-DE'] }));
			});

			it('a default locale outside the list already configured', () => {
				attempt((d) => d.configure({ defaultLocale: 'fr' }));
			});

			it('a locale list that keeps nothing for the current default', () => {
				attempt((d) => d.configure({ locales: ['fr', 'it'] }));
			});

			it('a locales value that is not an array', () => {
				attempt((d) => d.configure({ locales: 'en,de-DE' as never }));
			});

			it('a locale list with something that is not a tag in it', () => {
				attempt((d) => d.configure({ locales: ['en', '', 'de-DE'] }));
				attempt((d) => d.configure({ locales: ['en', null as never] }));
				// a settings row someone tampered with: this would land in <html lang> and in headers
				attempt((d) => d.configure({ locales: ['en', 'de-DE', 'x"><script>alert(1)</script>'] }));
			});

			it('a default locale that is not a tag', () => {
				attempt((d) => d.configure({ defaultLocale: '' }));
				attempt((d) => d.configure({ defaultLocale: 42 as never }));
			});
		});
	});

	/** Drives `handle` and reports the locale it settled on plus the transformed html. */
	const runHandle = async (
		d: ReturnType<typeof make>,
		{ cookie, header }: { cookie?: string; header?: string },
		html = '<html lang="%dialect.lang%">'
	) => {
		const event = {
			cookies: { get: vi.fn().mockReturnValue(cookie) },
			request: new Request('http://x/', header ? { headers: { 'accept-language': header } } : {})
		} as never;
		// read inside resolve(): on the server that is the only place a request's locale exists
		let locale = '';
		const resolve = vi.fn(async (_e, opts) => {
			locale = d.getLocale();
			return new Response(opts!.transformPageChunk!({ html, done: true }) as string);
		});
		return { html: await (await d.handle({ event, resolve } as never)).text(), locale };
	};

	it('handle falls back to defaultLocale with neither cookie nor header', async () => {
		expect(await runHandle(make(), {})).toEqual({ html: '<html lang="en">', locale: 'en' });
	});

	it('handle ignores a cookie naming an unknown locale', async () => {
		expect(await runHandle(make(), { cookie: 'de' })).toEqual({
			html: '<html lang="en">',
			locale: 'en'
		});
	});

	it('handle ignores an Accept-Language with nothing on offer', async () => {
		expect(await runHandle(make(), { header: 'de-DE,fr;q=0.8' })).toEqual({
			html: '<html lang="en">',
			locale: 'en'
		});
	});

	it('handle picks the first offered locale in header order', async () => {
		expect(await runHandle(make(), { header: 'de,ru,en' })).toMatchObject({ locale: 'ru' });
	});

	it('handle refuses a locale explicitly marked q=0, even when it comes first', async () => {
		expect(await runHandle(make(), { header: 'ru;q=0,en;q=1' })).toMatchObject({ locale: 'en' });
	});

	it('handle prefers a lower-listed locale with a higher quality value', async () => {
		expect(await runHandle(make(), { header: 'ru;q=0.1,en;q=0.9' })).toMatchObject({
			locale: 'en'
		});
	});

	it('handle leaves html without the placeholder alone', async () => {
		expect(await runHandle(make(), { cookie: 'ru' }, '<html lang="fixed">')).toMatchObject({
			html: '<html lang="fixed">'
		});
	});

	it('handle reads the cookie name from options', async () => {
		const get = vi.fn().mockReturnValue('ru');
		const d = createDialect({ messages, defaultLocale: 'en', cookie: 'lang' });
		const event = { cookies: { get }, request: new Request('http://x/') } as never;
		const { resolve, seen } = noting(d);
		await d.handle({ event, resolve } as never);

		expect(get).toHaveBeenCalledWith('lang');
		expect(seen.locale).toBe('ru');
	});
});
