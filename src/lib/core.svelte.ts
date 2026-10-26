import { untrack } from 'svelte';
import { MessageFormat } from 'messageformat';
import { DraftFunctions } from 'messageformat/functions';
import type { MessageFunction } from 'messageformat/functions';
import { MESSAGE_PATH } from './message-path.js';
import { localizedEntries as staticEntries } from './entries.js';

type Params = Record<string, unknown>;

/**
 * An MF2 function handler, as `messageformat` defines it: `(context, options, operand) => value`.
 * Re-exported so a consumer can type a custom one without depending on `messageformat` directly.
 */
export type DialectFunction = MessageFunction<string>;

/**
 * Fetches one namespace for one locale, as nested or flat JSON. Local files, a remote API,
 * whatever — freshness and caching policy beyond "load once" are yours to decide in here.
 */
export type MessageLoader = (params: {
	locale: string;
	namespace: string;
}) => Promise<Record<string, unknown>>;

export type DialectOptions = {
	/**
	 * An `import.meta.glob` result; paths must end in `<locale>/<namespace>.json`. Eager
	 * (`{ eager: true }`) inlines every message into the bundle. Without `eager` the values are
	 * import thunks, and each namespace becomes its own chunk fetched on first use — the bundle
	 * then carries only the locales a visitor actually reads. The two can be mixed with `loader`:
	 * glob entries win for the namespaces they cover, the loader gets the rest.
	 */
	messages?: Record<string, unknown>;
	defaultLocale: string;
	/** Selectable locales. Defaults to those found in `messages` — set it explicitly when loading everything dynamically. */
	locales?: string[];
	/**
	 * The cookie that persists the locale: a name, or a full shape. Defaults: name `'dialect'`,
	 * `maxAge` 400 days (the ceiling Chrome enforces), path `/`, `samesite=lax`.
	 */
	cookie?: string | CookieOptions;
	/** Called by `loadTranslations` for namespaces that aren't loaded yet. */
	loader?: MessageLoader;
	/**
	 * Serve every non-default locale under a URL prefix spelled exactly like the locale —
	 * `/de-DE/about` — while `defaultLocale` keeps the bare path. Off by default; turning it on
	 * means wiring `reroute` into `src/hooks.ts` as well as `handle`.
	 */
	routing?: boolean;
	/**
	 * Reactive read of the current page URL, used to resync the locale after client-side
	 * navigation. Leave it unset outside SvelteKit; `createDialect` from `svelte-dialect/kit`
	 * fills it in with `page.url`.
	 */
	currentUrl?: () => { readonly pathname: string };
	/**
	 * The app's base path, when it is served from a subdirectory. `createDialect` from
	 * `svelte-dialect/kit` fills it in from `paths.base`; set it yourself only outside SvelteKit.
	 * Only meaningful with `routing`, which otherwise reads the base segment as a locale and finds
	 * none. Paths handed back to SvelteKit or the browser carry it: `reroute`'s return value, the
	 * redirect `Location`, `localizeHref`. `localizedEntries` deliberately does not — SvelteKit
	 * prepends `paths.base` to `prerender.entries` itself.
	 */
	base?: string;
	/**
	 * Redirect a bare-path visit to the visitor's own locale: `/about` with a `ru` cookie (or a
	 * matching `Accept-Language`) answers **307** to `/ru/about`. Off by default, because it
	 * changes what a bare URL means — with it off, `/about` IS the default locale, full stop.
	 * Scoped the way next-intl scopes it: only document navigations of an unprefixed path are
	 * redirected, a prefixed URL always wins over the cookie and refreshes it, and the redirect is
	 * temporary (the preference may change). Needs `routing`.
	 */
	detectOnBarePath?: boolean;
	/**
	 * Where the locale is looked for, first match wins. Sources that don't apply to the current side
	 * are skipped: `header` only exists on the server, `lang` and `navigator` only in the browser.
	 * Default: `['url', 'cookie', 'lang', 'header', 'navigator', 'default']`.
	 */
	strategy?: LocaleSource[];
	/**
	 * Wrap interpolated values in Unicode bidi isolates, so a left-to-right name inside a
	 * right-to-left sentence doesn't visually reorder it. Off by default: with LTR-only locales the
	 * isolates are invisible characters that break exact string comparison for no benefit. Turn it
	 * on when you serve an RTL locale.
	 */
	bidiIsolation?: boolean;
	/**
	 * Extra MF2 functions, on top of the ones every message already gets: the required `:number`,
	 * `:integer`, `:offset` and `:string`, plus the draft `:currency`, `:date`, `:datetime`,
	 * `:time`, `:percent` and `:unit`. Same name as a built-in replaces it. A value that only has
	 * `toString()` formats in `t()`; for `formatParts` and `<Rich>` it also needs `toParts()`, or it
	 * renders as its `{$name}` fallback there.
	 */
	functions?: Record<string, DialectFunction>;
	/**
	 * Where message errors go instead of the console: a source that doesn't compile (reported once
	 * per message, like the warning it replaces) and anything MF2 reports while formatting, such as
	 * a parameter the message wanted and the call didn't pass. Neither kind throws either way —
	 * `t()` degrades to the key or to MF2's fallback text.
	 */
	onError?: (error: unknown, context: { key: string; locale: string }) => void;
};

/** The locale cookie's shape; `name` aside, these mirror the cookie attributes they set. */
export type CookieOptions = {
	name?: string;
	/** Seconds. Default: 400 days — Chrome caps anything longer to that anyway. */
	maxAge?: number;
	domain?: string;
	secure?: boolean;
};

/**
 * One piece of a formatted message, for rendering translations that contain MF2 markup
 * (`{#link}…{/link}`). Text between an `open` and its `close` arrives as the parts in between;
 * `standalone` is self-closing markup (`{#img/}`). Values interpolated into the message are
 * already stringified into `text` parts.
 */
export type RichPart =
	| { type: 'text'; value: string }
	| { type: 'open' | 'close' | 'standalone'; name: string; options?: Record<string, unknown> };

/**
 * The slice of SvelteKit's `RequestEvent` that `handle` reads. Declared here instead of imported so
 * the root entry's types don't need `@sveltejs/kit` installed; Kit's own `Handle` and `Reroute`
 * accept the functions typed this way as they are.
 */
type HandleEvent = {
	readonly url: URL;
	readonly request: Request;
	readonly cookies: {
		get(name: string): string | undefined;
		set(
			name: string,
			value: string,
			options: { path: string; maxAge?: number; httpOnly?: boolean; sameSite?: 'lax' } & Pick<
				CookieOptions,
				'domain' | 'secure'
			>
		): void;
	};
};

type Handle = <E extends HandleEvent>(input: {
	event: E;
	resolve: (
		event: E,
		options?: { transformPageChunk?: (input: { html: string; done: boolean }) => string }
	) => Response | Promise<Response>;
}) => Promise<Response>;

type Reroute = (event: { url: URL }) => string;

/**
 * The parts of the configuration that can be replaced after init, via `configure`. Both are
 * optional; whichever you leave out keeps its current value. See `configure` for the rules.
 */
export type DialectConfig = {
	/** The locale served on the bare path and used as the fallback. Must be one of `locales`. */
	defaultLocale?: string;
	/** Replaces the selectable locales outright — this is not a merge. */
	locales?: string[];
};

/**
 * A place a locale can come from.
 *
 * - `url` — the path prefix, needs `routing: true`
 * - `cookie` — what the visitor last chose
 * - `lang` — `<html lang>`, browser only, and only when it isn't `defaultLocale` (see below)
 * - `header` — `Accept-Language`, server only
 * - `navigator` — `navigator.languages`, browser only
 * - `default` — `defaultLocale`, always matches, so nothing after it is ever consulted
 */
export type LocaleSource = 'url' | 'cookie' | 'lang' | 'header' | 'navigator' | 'default';

const DEFAULT_STRATEGY: LocaleSource[] = [
	'url',
	'cookie',
	'lang',
	'header',
	'navigator',
	'default'
];

/**
 * Safety net for runtimes whose Intl has no text info (small-icu Node builds): without it every
 * RTL locale would silently render left-to-right. Kept deliberately small — Intl answers first,
 * this list only catches the fallback.
 */
const RTL_LANGUAGES = new Set(['ar', 'dv', 'fa', 'he', 'ks', 'ku', 'ps', 'sd', 'ug', 'ur', 'yi']);

/** Per locale, constant; `new Intl.Locale` is a quarter of what `handle` costs if not cached. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a cache, never rendered
const directions = new Map<string, 'ltr' | 'rtl'>();

/** Writing direction for a locale: Intl when it can answer, the RTL set when it can't. */
const direction = (locale: string): 'ltr' | 'rtl' => {
	let dir = directions.get(locale);
	if (!dir) directions.set(locale, (dir = textDirection(locale)));
	return dir;
};

const textDirection = (locale: string): 'ltr' | 'rtl' => {
	try {
		const info = new Intl.Locale(locale) as Intl.Locale & {
			getTextInfo?: () => { direction?: string };
			textInfo?: { direction?: string };
		};
		const fromIntl = (info.getTextInfo?.() ?? info.textInfo)?.direction;
		if (fromIntl === 'rtl' || fromIntl === 'ltr') return fromIntl;
		return RTL_LANGUAGES.has(info.language ?? '') ? 'rtl' : 'ltr';
	} catch {
		return 'ltr';
	}
};

/** What one server request knows. Lives in AsyncLocalStorage so concurrent requests can't mix. */
type RequestStore = { locale: string };

/** The slice of AsyncLocalStorage we use — also the shape of the single-slot mock. */
type LocaleStorage = {
	getStore(): RequestStore | undefined;
	run<T>(store: RequestStore, fn: () => T): T | Promise<T>;
};

/**
 * Fallback for runtimes without `async_hooks`: one slot per process, set for the duration of the
 * callback. This is exactly the shared-state model the real storage exists to fix, so under this
 * mock concurrent SSR requests can still bleed into each other — same trade-off Paraglide makes,
 * and said once in the console so whoever deploys there knows.
 */
const mockStorage = (): LocaleStorage => {
	console.warn(
		"svelte-dialect: node:async_hooks is unavailable, so concurrent requests share one locale slot and can see each other's language"
	);
	let current: RequestStore | undefined;
	return {
		getStore: () => current,
		async run(store, fn) {
			const outer = current;
			current = store;
			try {
				return await fn();
			} finally {
				// a nested run (Kit's internal fetch) hands the slot back to the request around it;
				// a run that finished while another took the slot over leaves that one alone
				if (current === store) current = outer;
			}
		}
	};
};

/** One message. `mf` is memoised on first use; `null` means the source doesn't compile. */
type Entry = { src: string; mf?: MessageFormat<string> | null };

/**
 * Stands in for MessageFormat when a message has no placeholder, markup, escape or declaration:
 * MF2 formats such a source to itself, so most of a catalog ("Save", "Cancel") skips the parser and
 * the memory a compiled message holds.
 */
const plainMessage = (src: string) =>
	({
		format: () => src,
		formatToParts: () => [{ type: 'text', value: src }]
	}) as unknown as MessageFormat<string>;

const isPlain = (src: string) => !/[{}\\]/.test(src) && !src.trimStart().startsWith('.');

/** catalog[locale][namespace]['dot.path'] */
type Catalog = Record<string, Record<string, Record<string, Entry>>>;

/**
 * Unwraps an ES module namespace object to its `default` export; passes raw data through
 * untouched. `mod.default ?? mod` can't tell the two apart when a raw JSON namespace has its own
 * `default` key: for `{ default: 'Default text', title: 'Title' }` it picked the string, and the
 * catalog ended up flattening *that string's characters* while `title` vanished. A wrapper's
 * `default` is always the whole namespace object; a raw namespace's own `default` key is a message,
 * a string. Only unwrapping when `default` is itself an object catches the reported case while
 * keeping the module-wrapper shape (`{ default: {...} }`) working exactly as before.
 */
const unwrapModule = (mod: unknown): Record<string, unknown> => {
	const hasDefault = mod !== null && typeof mod === 'object' && Object.hasOwn(mod, 'default');
	const def = hasDefault ? (mod as { default: unknown }).default : undefined;
	return (def !== null && typeof def === 'object' ? def : mod) as Record<string, unknown>;
};

/** `{ nav: { home: 'Home' } }` → `{ 'nav.home': { src: 'Home' } }` */
const flatten = (obj: Record<string, unknown>, prefix = ''): Record<string, Entry> =>
	Object.entries(obj).reduce<Record<string, Entry>>((acc, [k, v]) => {
		const key = prefix + k;
		if (typeof v === 'string') acc[key] = { src: v };
		else if (v && typeof v === 'object')
			Object.assign(acc, flatten(v as Record<string, unknown>, `${key}.`));
		return acc;
		// no prototype, so a `__proto__` key is a message like any other, not a prototype swap
	}, Object.create(null));

/**
 * A key that autocompletes to the known set but accepts any string: `string & {}` keeps the
 * literal union visible to the IDE without closing the door on keys that only exist at runtime
 * (a loader hitting a database knows things the build never saw).
 */
type Loose<K extends string> = K | (string & {});

/** `'home:title' | 'nav:docs'` → `'home' | 'nav'` — the namespaces of a key union. */
type NamespaceOf<K extends string> = K extends `${infer NS}:${string}` ? NS : never;

/**
 * The argument list `t` accepts for one key. A key `typegen` found parameters for takes exactly
 * that shape and cannot omit it; everything else — keys with no parameters, and keys that only
 * exist at runtime — keeps params optional, so the second generic is purely additive.
 */
type ParamsFor<Key, P> = Key extends keyof P
	? P[Key] extends Params
		? [params: P[Key]]
		: [params?: Params]
	: [params?: Params];

export function createDialect<
	K extends string = string,
	P extends Partial<Record<K, Params>> = Record<never, never>
>({
	messages = {},
	defaultLocale: initialDefaultLocale,
	locales: selectable,
	cookie: cookieOption = 'dialect',
	loader,
	routing = false,
	currentUrl,
	base: basePath = '',
	detectOnBarePath = false,
	strategy = DEFAULT_STRATEGY,
	bidiIsolation = false,
	functions: extraFunctions,
	onError
}: DialectOptions) {
	// messageformat registers only the four functions the spec marks REQUIRED unless it is handed a
	// `functions` option — everything a translator actually reaches for after plurals (:currency,
	// :date, :time) is DRAFT and would otherwise resolve to fallback text with no exception thrown.
	// So the draft set is on by default, and a consumer's own entry wins over ours.
	const functions: Record<string, DialectFunction> = { ...DraftFunctions, ...extraFunctions };

	const cookieConfig = typeof cookieOption === 'string' ? { name: cookieOption } : cookieOption;
	const cookie = cookieConfig.name ?? 'dialect';
	const cookieMaxAge = cookieConfig.maxAge ?? 60 * 60 * 24 * 400;
	/** The attribute tail shared by every write of the locale cookie. */
	const cookieAttributes = [
		'path=/',
		`max-age=${cookieMaxAge}`,
		'samesite=lax',
		...(cookieConfig.domain ? [`domain=${cookieConfig.domain}`] : []),
		...(cookieConfig.secure ? ['secure'] : [])
	].join(';');

	// A typo in a strategy entry would otherwise be skipped without a trace — TypeScript catches it,
	// plain JavaScript doesn't.
	for (const source of strategy) {
		if (!DEFAULT_STRATEGY.includes(source)) {
			console.warn(`svelte-dialect: unknown strategy source "${source}", it will be ignored`);
		}
	}

	const initial: Catalog = {};
	/**
	 * Namespaces from a non-eager glob, keyed `locale\0namespace`: not loaded, but known — the
	 * import thunk is a built-in loader for exactly that entry. Known-ness matters beyond loading:
	 * these paths still contribute their locales to the selectable set.
	 */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- import table, never rendered
	const lazyImports = new Map<string, () => Promise<unknown>>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- build-time path scan, never rendered
	const discovered = new Set<string>();
	for (const [file, mod] of Object.entries(messages)) {
		const m = MESSAGE_PATH.exec(file);
		if (!m) continue;
		const [, locale, ns] = m;
		discovered.add(locale);
		if (typeof mod === 'function') {
			lazyImports.set(`${locale}\0${ns}`, mod as () => Promise<unknown>);
			continue;
		}
		(initial[locale] ??= {})[ns] = flatten(unwrapModule(mod));
	}

	// $state.raw, reassigned wholesale when a namespace lands: t() repaints without paying to
	// proxy every message. Coarse — one namespace arriving invalidates every t() read. The catalog
	// is also the only record of what's cached: presence of catalog[locale][ns] IS "already loaded".
	let catalog = $state.raw(initial);

	// Both hold the *current* configuration, not the one createDialect was called with: `configure`
	// replaces them when the real values only become readable at runtime (a settings table, an env
	// resolved at boot). Everything below reads them through this closure, so it follows along.
	// $state, not a plain closure variable: `configure` can change these without the active locale
	// itself changing, and reads elsewhere in the app (locales.join(','), a fallback t() result) need
	// to see that — a bare reassignment is invisible to Svelte's reactivity.
	let defaultLocale = $state(initialDefaultLocale);
	// Copied, then only ever spliced: the array handed back from createDialect is a live view of the
	// set, so a consumer that destructured `locales` at module scope still sees the current one.
	const locales = $state([...(selectable ?? discovered)]);

	/**
	 * Offered locales that share a prefix with `tag`, longest prefix first: `zh-Hant-HK` finds
	 * `zh-Hant` before any other `zh-…`, and `de` finds `de-DE`. Includes `tag` itself if offered.
	 */
	const relatedLocales = (tag: string): string[] => {
		const subtags = tag.toLowerCase().split('-');
		const found: string[] = [];
		for (let n = subtags.length; n > 0; n--) {
			const prefix = subtags.slice(0, n).join('-');
			for (const l of locales) {
				const lower = l.toLowerCase();
				if ((lower === prefix || lower.startsWith(`${prefix}-`)) && !found.includes(l))
					found.push(l);
			}
		}
		return found;
	};

	/**
	 * First entry of an `Accept-Language`-shaped list that we have messages for. Every exact tag is
	 * tried before any related one, so `en-GB, en-US;q=0.9` gets `en-US` over an offered `en-AU`; a
	 * visitor asking for `de-AT` gets `de-AT` if it exists and falls back to `de-DE` if it doesn't.
	 */
	const negotiate = (header: string | null | undefined): string | undefined => {
		const ranges = (header ?? '')
			.split(',')
			.map((part) => {
				const [tag, ...params] = part.split(';').map((p) => p.trim());
				const q = params.map((p) => /^q\s*=\s*(.*)$/i.exec(p)?.[1]).find((v) => v !== undefined);
				// RFC 9110 weights are 0–1 with up to three decimals; a malformed one drops its entry
				// rather than silently promoting it above every well-formed preference
				const weight =
					q === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(q) ? Number(q) : 0;
				return { tag: tag.toLowerCase(), q: weight };
			})
			.filter((entry) => entry.tag);
		// q=0 means "not this one", and that has to hold for the related-locale pass too
		const refused = ranges.filter((entry) => entry.q === 0).map((entry) => entry.tag);
		const wanted = ranges
			.filter((entry) => entry.q > 0)
			// a header isn't required to list its tags in preference order — Array#sort is stable, so
			// equal-weight tags keep the order the visitor sent them in
			.sort((a, b) => b.q - a.q)
			.map((entry) => entry.tag);

		for (const tag of wanted) {
			const exact = locales.find((l) => l.toLowerCase() === tag);
			if (exact) return exact;
		}
		for (const tag of wanted) {
			const related = relatedLocales(tag).find((l) => !refused.includes(l.toLowerCase()));
			if (related) return related;
		}
	};

	// SvelteKit forbids a trailing slash here, but a consumer building the value by hand may not know
	const base = basePath.replace(/\/$/, '');

	/** `/app/de-DE/about` → `/de-DE/about`: everything below works on route paths, base removed. */
	const stripBase = (pathname: string): string =>
		base && (pathname === base || pathname.startsWith(`${base}/`))
			? pathname.slice(base.length) || '/'
			: pathname;

	/** The inverse, for paths going back to SvelteKit or into an href. */
	const withBase = (path: string): string => (path === '/' ? base || '/' : base + path);

	// Collapses a run of leading slashes to one: with the locale prefix removed, `/en//evil.example`
	// leaves a path starting with `//`, which a browser reads as protocol-relative — a redirect built
	// from it changes origin instead of staying on this site. Backslashes count: a browser reads
	// `/\evil.example` the same way. A route path never legitimately starts with more than one slash,
	// so this is safe to normalise unconditionally.
	const singleLeadingSlash = (path: string): string => path.replace(/^[/\\]+/, '/');

	/**
	 * `/app/de-DE/about` → `{ locale: 'de-DE', path: '/about' }`. The returned path is
	 * route-relative — no base, no locale — because that is the only form the locale logic can
	 * compare against `locales`.
	 */
	const splitPath = (pathname: string): { locale?: string; path: string } => {
		const routePath = stripBase(pathname);
		const slash = routePath.indexOf('/', 1);
		const head = routePath.slice(1, slash === -1 ? undefined : slash);
		const found = locales.find((l) => l === head);
		return found
			? { locale: found, path: singleLeadingSlash(routePath.slice(head.length + 1) || '/') }
			: { path: singleLeadingSlash(routePath) };
	};

	/** `/about` in `ru` → `/ru/about`; route-relative in, route-relative out. */
	const withLocale = (routePath: string, target: string): string => {
		if (target === defaultLocale || !locales.includes(target)) return routePath;
		return routePath === '/' ? `/${target}` : `/${target}${routePath}`;
	};

	/** What the server knows about this request. In the browser these come from globals instead. */
	type Signals = { pathname?: string; cookie?: string; header?: string | null };

	// `document` is the test for being in a browser, not `navigator`: Node has had a global
	// `navigator` since v21, and its `language` follows the machine's system locale — left
	// unguarded, the `navigator` source would quietly decide the locale during SSR.
	const inBrowser = () => typeof document !== 'undefined';

	const savedCookie = (): string | undefined =>
		!inBrowser()
			? undefined
			: document.cookie
					.split('; ')
					.find((c) => c.startsWith(`${cookie}=`))
					?.slice(cookie.length + 1);

	const fromSource = (source: LocaleSource, signals: Signals): string | undefined => {
		switch (source) {
			case 'url': {
				if (!routing) return undefined;
				const path = signals.pathname ?? (inBrowser() ? location.pathname : undefined);
				return path === undefined ? undefined : splitPath(path).locale;
			}
			case 'cookie':
				return signals.cookie ?? savedCookie();
			case 'lang': {
				// Browser only, and deliberately ignored when it equals defaultLocale: that case is
				// ambiguous, because a page prerendered for a static host always says the default,
				// whereas a value *different* from the default can only be a server's decision.
				if (!inBrowser()) return undefined;
				const lang = document.documentElement.lang;
				return lang !== defaultLocale ? lang : undefined;
			}
			case 'header':
				return negotiate(signals.header);
			case 'navigator':
				return inBrowser()
					? negotiate(navigator.languages?.join(',') ?? navigator.language)
					: undefined;
			case 'default':
				return defaultLocale;
		}
	};

	/** Walks `strategy` and takes the first source that names a locale we actually have. */
	const resolveLocale = (signals: Signals = {}, skip?: Set<LocaleSource>): string => {
		for (const source of strategy) {
			if (skip?.has(source)) continue;
			const found = fromSource(source, signals);
			// defaultLocale is accepted even when the catalog is empty, so a misconfigured glob still boots
			if (found && (found === defaultLocale || locales.includes(found))) return found;
		}
		return defaultLocale;
	};

	// The rune is the *client's* locale (and the last-request echo on the server). During SSR the
	// authoritative value lives in per-request AsyncLocalStorage — see requestLocale() — so
	// concurrent requests with different languages can't bleed into each other. On runtimes
	// without async_hooks a single-slot mock takes over, which reverts to the old shared-state
	// behaviour; that trade-off is documented, not hidden.
	let locale = $state(resolveLocale());

	let storage: LocaleStorage | undefined;
	let storagePromise: Promise<LocaleStorage> | undefined;

	/** Lazily loads async_hooks on first server request; browsers and edge runtimes get the mock. */
	const ensureStorage = (): Promise<LocaleStorage> => {
		if (storage) return Promise.resolve(storage);
		// The specifier goes through a variable with @vite-ignore so client bundles neither resolve
		// nor include the node module; the import only ever runs inside handle(), on the server.
		const specifier = 'node:async_hooks';
		storagePromise ??= import(/* @vite-ignore */ specifier)
			.then(({ AsyncLocalStorage }) => new AsyncLocalStorage() as LocaleStorage)
			.catch(() => mockStorage())
			.then((s) => (storage = s));
		return storagePromise;
	};

	/** The locale of the request being served, when we're inside one. */
	const requestLocale = (): string | undefined => storage?.getStore()?.locale;

	/** Keeps `<html>` in step whenever we settle on a locale ourselves rather than being served one. */
	const syncDocument = (next: string) => {
		if (typeof document === 'undefined') return;
		document.documentElement.lang = next;
		document.documentElement.dir = direction(next);
	};

	// e.g. we resolved it from a cookie on a static host, where every document says the default
	syncDocument(locale);

	// A plain `<a href="/ru/...">` a consumer's own template renders is invisible to `setLocale` —
	// SvelteKit's client router navigates it without ever calling into this module, so `locale` was
	// left stale until something else happened to touch it. `page.url` (from `$app/state`, injected
	// as `currentUrl` by `svelte-dialect/kit` so this module never imports the router) is
	// SvelteKit's own reactive record of the confirmed navigation, prefix and all (`reroute` only
	// picks the route; nothing strips the prefix from the URL itself). Reading it here resyncs the
	// locale after any URL-driven navigation — a plain link, Back/Forward, `goto()` — without the
	// app wiring anything itself. Preloading (hover) doesn't touch `page`, only a confirmed
	// navigation does, so a prefetched page can't switch the locale before the visitor actually
	// arrives there.
	//
	// A bare path is not "the default locale, full stop": that framing only describes whether
	// `detectOnBarePath` redirects it, not what content it serves. `resolveLocale` itself proves
	// this — visiting `/` with a `ru` cookie renders `ru` at the bare address, cookie beating
	// `defaultLocale` in the strategy walk. So a bare path here re-runs the very same walk a fresh
	// request would make, `'lang'` excluded: that source means "what did SSR just hand hydration",
	// and reusing it for an ongoing resync would just read back whatever `syncDocument` last wrote —
	// one step behind reality, not a fresh signal.
	//
	// Guarded to `routing` and to `strategy` actually including `'url'`: without either, the address
	// bar isn't a locale signal this instance negotiates from, and reacting to it anyway would fight
	// `setLocale(next, { reload: false })`, whose entire point is letting the caller hold a locale the
	// URL doesn't (yet) agree with. `untrack` on the comparison is what keeps that working: the effect
	// re-runs when the URL changes, not when `locale` itself changes for some unrelated reason.
	if (routing && currentUrl && strategy.includes('url')) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- static membership check, never rendered
		const skipLang = new Set<LocaleSource>(['lang']);
		$effect.root(() => {
			$effect(() => {
				const pathname = currentUrl().pathname;
				// before SvelteKit's client router has run at all, `page.url` isn't a real path yet
				if (!pathname.startsWith('/')) return;
				const found = resolveLocale({ pathname }, skipLang);
				if (found !== untrack(() => locale)) {
					locale = found;
					syncDocument(found);
				}
			});
		});
	}

	/**
	 * De-AT → de / de-DE → defaultLocale, the language before jumping ship. Only locales the app
	 * offers participate, so a stray catalog entry can't hijack the chain. Shared by message
	 * resolution and by `loadTranslations`, which has to warm every locale in it — not just the
	 * active one — for the fallback to actually be there when `t()` reads it synchronously.
	 */
	const localeChain = (active: string): string[] => [
		active,
		...relatedLocales(active).filter((l) => l !== active),
		defaultLocale
	];

	/** `obj[key]`, but only when `key` is `obj`'s own property — an inherited one is not a message. */
	const ownGet = <T>(obj: Record<string, T> | undefined, key: string): T | undefined =>
		obj && Object.hasOwn(obj, key) ? obj[key] : undefined;

	/**
	 * Catalog entries are plain objects, and a lookup like `catalog[loc]?.[ns]?.[path]` walks the
	 * prototype chain along with the own properties — so `t('home:__proto__')` would resolve to
	 * `Object.prototype` and a failed compile would then write `mf: null` onto it, breaking every
	 * other still-uncompiled message in the process. `ownGet` at each level keeps the lookup to what
	 * was actually loaded.
	 */
	const lookupEntry = (loc: string, ns: string, path: string): Entry | undefined =>
		ownGet(ownGet(ownGet(catalog, loc), ns), path);

	/** Finds the message for `key` (current locale, then default) with its MessageFormat memoised. */
	const resolveMessage = (key: string): { mf: MessageFormat<string>; loc: string } | undefined => {
		const sep = key.indexOf(':');
		if (sep === -1) return undefined;
		const ns = key.slice(0, sep);
		// everything after the first colon is the path, so an accidental extra colon isn't silently dropped
		const path = key.slice(sep + 1);

		const chain = localeChain(requestLocale() ?? locale);
		const loc = chain.find((l) => lookupEntry(l, ns, path) !== undefined) ?? defaultLocale;
		const entry = lookupEntry(loc, ns, path);
		if (!entry) return undefined;
		if (entry.mf === undefined && isPlain(entry.src)) entry.mf = plainMessage(entry.src);
		if (entry.mf === undefined) {
			try {
				entry.mf = new MessageFormat<string>(loc, entry.src, {
					bidiIsolation: bidiIsolation ? 'default' : 'none',
					functions
				});
			} catch (e) {
				// memoised as null: reported once, not on every render
				if (onError) onError(e, { key, locale: loc });
				else console.warn(`svelte-dialect: invalid message "${key}" (${loc})`, e);
				entry.mf = null;
			}
		}
		return entry.mf ? { mf: entry.mf, loc } : undefined;
	};

	const t = <Key extends Loose<K>>(key: Key, ...rest: ParamsFor<Key, P>): string => {
		const params = rest[0];
		const found = resolveMessage(key);
		if (!found) return key;
		// Without onError, MF2 logs format-time errors itself and returns fallback text either way.
		return found.mf.format(params, onError && ((e) => onError(e, { key, locale: found.loc })));
	};

	/**
	 * The message as render-ready parts instead of one string: markup (`{#link}…{/link}`) arrives
	 * as `open`/`close`/`standalone` parts, everything else — literal text and interpolated values
	 * alike — as `text`. This is what the `Rich` component consumes; use it directly to render
	 * markup with your own machinery. A key with no message degrades to a single text part, so the
	 * fallback shape matches `t()`.
	 */
	const formatParts = <Key extends Loose<K>>(key: Key, ...rest: ParamsFor<Key, P>): RichPart[] => {
		const params = rest[0];
		const found = resolveMessage(key);
		if (!found) return [{ type: 'text', value: key }];
		const raw = found.mf.formatToParts(
			params,
			onError && ((e) => onError(e, { key, locale: found.loc }))
		);
		const out: RichPart[] = [];
		for (const part of raw) {
			if (part.type === 'markup') {
				const { kind, name, options } = part as {
					kind: 'open' | 'close' | 'standalone';
					name: string;
					options?: Record<string, unknown>;
				};
				out.push({ type: kind, name, options });
				continue;
			}
			// formatted values carry their text in nested Intl parts; text and bidi carry `value`; a
			// value that couldn't be formatted is a fallback, which reads `{$name}` just as in t()
			const nested = (part as { parts?: { value?: unknown }[] }).parts;
			const value =
				part.type === 'fallback'
					? `{${(part as { source: string }).source}}`
					: nested
						? nested.map((n) => String(n.value ?? '')).join('')
						: String((part as { value?: unknown }).value ?? '');
			const last = out[out.length - 1];
			// merge adjacent text so consumers see one part per run, not one per token
			if (last?.type === 'text') last.value += value;
			else out.push({ type: 'text', value });
		}
		return out;
	};

	/**
	 * In-flight loader calls, keyed `locale\0namespace`. Shared by every caller in the process, so
	 * a hundred concurrent SSR requests for the same namespace trigger one loader call, not a hundred.
	 */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- request dedupe, never rendered
	const inflight = new Map<string, Promise<void>>();
	/** every namespace asked for so far, so a locale change can refetch them */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping; the catalog drives repaints
	const requested = new Set<string>();

	const loadNamespace = (loc: string, ns: string, reload: boolean) => {
		// own properties only, or a namespace named `toString` would count as loaded already
		if (!reload && ownGet(ownGet(catalog, loc), ns)) return;
		const cacheKey = `${loc}\0${ns}`;
		let pending = inflight.get(cacheKey);
		if (!pending) {
			// A lazy glob entry is the built-in loader for its namespace and wins over the user's:
			// the glob names the file explicitly, so it is the more specific claim.
			const lazyImport = lazyImports.get(cacheKey);
			const fetch = lazyImport ?? (loader && (() => loader({ locale: loc, namespace: ns })));
			if (!fetch) {
				// a bundled namespace asked to reload has nowhere to reload from: what's there stays
				if (ownGet(ownGet(catalog, loc), ns)) return;
				throw new Error(`svelte-dialect: no loader configured, cannot load "${ns}"`);
			}
			pending = fetch()
				.then((mod) => {
					// a loader may hand back a module (`import(...)`) just like a lazy glob entry does
					const data = unwrapModule(mod);
					if (data === null || typeof data !== 'object' || Array.isArray(data)) {
						throw new Error(
							`svelte-dialect: loading "${ns}" for "${loc}" must resolve to an object of messages, got ${data === null ? 'null' : typeof data}`
						);
					}
					// replaces the namespace outright, so keys dropped upstream — and the compiled
					// messages living on the old entries — go with it
					catalog = { ...catalog, [loc]: { ...catalog[loc], [ns]: flatten(data) } };
				})
				.finally(() => inflight.delete(cacheKey));
			inflight.set(cacheKey, pending);
		}
		return pending;
	};

	/**
	 * Fallback locales (everything in the chain but the active one) are only warmed from a lazy glob
	 * entry, never from the generic `loader` — a loader was configured for a specific namespace/locale
	 * the app actually asked for, and calling it speculatively for every fallback locale on every
	 * load would multiply requests to it in a way the loader's author didn't sign up for. A lazy glob
	 * entry has no such ambiguity: it names its own locale and namespace at build time.
	 */
	const hasLazyEntry = (loc: string, ns: string): boolean => lazyImports.has(`${loc}\0${ns}`);

	/**
	 * A load nobody waits on the outcome of — a fallback locale, a refetch after a locale switch —
	 * degrades to a warning: the page renders either way, from whatever did load.
	 */
	const loadQuietly = (loc: string, ns: string) =>
		loadNamespace(loc, ns, false)?.catch((e) =>
			console.warn(`svelte-dialect: failed to load "${ns}" for "${loc}"`, e)
		);

	/**
	 * Ensures `namespaces` are in the cache for the current locale, then hands back `t`. Reads the
	 * locale synchronously, so in a Svelte `await` expression it re-runs when the locale changes —
	 * and only then: the catalog it reads and writes is untracked. Rejects if loading the active
	 * locale fails (catch inside your loader if you'd rather degrade to keys); a fallback locale
	 * failing only warns.
	 *
	 * Also warms the rest of the fallback chain (regional sibling, then defaultLocale) for the same
	 * namespaces, where a lazy glob entry covers them — not just the active locale. `resolveMessage`
	 * falls back synchronously, so a fallback translation that hasn't been fetched yet is
	 * indistinguishable from one that doesn't exist; the first visit to a locale with an incomplete
	 * namespace would otherwise show raw keys until some other request happened to warm the default
	 * locale first.
	 */
	const loadTranslations = async (
		namespaces: Loose<NamespaceOf<K>> | Loose<NamespaceOf<K>>[],
		options?: { reload?: boolean }
	) => {
		const loc = requestLocale() ?? locale;
		const list = typeof namespaces === 'string' ? [namespaces] : namespaces;
		for (const ns of list) requested.add(ns);
		const chain = localeChain(loc);
		// Untracked, because a caller inside a $derived or an effect (an `await` in markup is one)
		// must depend on the locale alone: tracking the catalog would re-run it whenever any namespace
		// lands, and writing state there is otherwise a `state_unsafe_mutation`.
		const loads = untrack(() => {
			const pending = list.flatMap((ns) => [
				loadNamespace(loc, ns, options?.reload ?? false),
				...chain
					.filter((fallbackLoc) => fallbackLoc !== loc && hasLazyEntry(fallbackLoc, ns))
					.map((fallbackLoc) => loadQuietly(fallbackLoc, ns))
			]);
			// Workaround for Svelte 5.57 with experimental.async. The catalog write that lands after
			// the fetch has no batch to join, so Svelte gives it a batch of its own, and that batch can
			// commit before a client-side navigation still waiting on this very call. The layout's
			// effects then run against the previous route and are never re-run. Writing the catalog
			// now, synchronously, puts it into the batch that is running, so the later write merges
			// into it instead. Harmless without the flag, and no longer needed once
			// sveltejs/svelte#19030 or #18880 ships.
			if (pending.some(Boolean)) catalog = { ...catalog };
			return pending;
		});
		await Promise.all(loads);
		return { t };
	};

	// Refetch everything the app has asked for whenever the locale changes, so a plain
	// `const { t } = await loadTranslations(...)` keeps working after a switch — the caller doesn't
	// have to re-run the load itself. Browser only: effects don't run during SSR, where each render
	// awaits its own loadTranslations anyway. Also warms the new locale's fallback chain via lazy
	// entries, for the same reason loadTranslations does.
	$effect.root(() => {
		$effect(() => {
			const loc = locale;
			const chain = localeChain(loc);
			// untracked: a namespace landing must not re-run this (and retry every failed one)
			untrack(() => {
				for (const ns of requested) {
					// refetch only what some source can actually provide — a lazy glob entry or the
					// loader; anything else would throw for namespaces that were bundled eagerly
					if (loader || hasLazyEntry(loc, ns)) loadQuietly(loc, ns);
					for (const fallbackLoc of chain) {
						if (fallbackLoc !== loc && hasLazyEntry(fallbackLoc, ns)) loadQuietly(fallbackLoc, ns);
					}
				}
			});
		});
	});

	/**
	 * Intl formatter instances are expensive to construct and trivially reusable, so both helpers
	 * memoise per locale + options. The cache never empties: the option shapes an app uses are a
	 * small fixed set.
	 */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- formatter cache, never rendered
	const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
	const formatterFor = <T extends Intl.NumberFormat | Intl.DateTimeFormat>(
		kind: 'n' | 'd',
		options: object | undefined,
		make: (loc: string) => T
	): T => {
		const loc = requestLocale() ?? locale;
		const cacheKey = `${kind}\0${loc}\0${JSON.stringify(options) ?? ''}`;
		let formatter = formatters.get(cacheKey);
		if (!formatter) {
			formatter = make(loc);
			formatters.set(cacheKey, formatter);
		}
		return formatter as T;
	};

	/** `Intl.NumberFormat` for the current locale — per-request on the server, reactive on the client. */
	const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
		formatterFor('n', options, (loc) => new Intl.NumberFormat(loc, options)).format(value);

	/** `Intl.DateTimeFormat` for the current locale — per-request on the server, reactive on the client. */
	const formatDate = (value: Date | number, options?: Intl.DateTimeFormatOptions): string =>
		formatterFor('d', options, (loc) => new Intl.DateTimeFormat(loc, options)).format(value);

	const setLocale = (next: string, options?: { reload?: boolean }) => {
		// defaultLocale stays settable even with no catalog, so a misconfigured glob can't warn per request
		if (next !== defaultLocale && !locales.includes(next)) {
			console.warn(`svelte-dialect: unknown locale "${next}", keeping "${locale}"`);
			return;
		}
		locale = next;
		if (typeof document !== 'undefined') {
			document.cookie = `${cookie}=${next};${cookieAttributes}`;
			// lang and dir move together, or a static site switched to an RTL locale stays ltr
			syncDocument(next);

			// With the locale in the URL, switching means going to the other address — otherwise the
			// address bar keeps the old prefix while the content changes underneath it. A full
			// navigation on purpose: the server re-negotiates and document, URL and runtime agree.
			// Pass { reload: false } to opt out and handle navigation yourself.
			if (routing && (options?.reload ?? true)) {
				const target = localizeHref(location.pathname, next) + location.search + location.hash;
				if (target !== location.pathname + location.search + location.hash) {
					location.href = target;
				}
			}
		}
	};

	// The shape of a language tag (`en`, `de-DE`, `zh-Hant`, `es-419`), checked because configure()
	// takes values from a database or a settings row and they end up in HTML, headers and cookies.
	const isTag = (value: unknown): value is string =>
		typeof value === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(value);

	/**
	 * Points the locale set and the default locale at new values, any time after init — for
	 * configuration that only exists at runtime: a settings row, a tenant record, an env read at
	 * boot. Everything downstream reads the current values: negotiation, `setLocale`, the
	 * default-locale 308, `reroute`, `localizeHref`, `localizedEntries` and `%dialect.lang%`.
	 *
	 * Server: call it once from `hooks.server.ts` before the first request is served. Client: during
	 * app init, with the values the server put in page data. Both matter because `reroute` is
	 * synchronous and runs before any of it — see the README for what a prefix does in the window
	 * before `configure` has run.
	 *
	 * `locales` replaces the set outright rather than merging into it, and `defaultLocale` has to be
	 * a member of the resulting set. A call that isn't warns and changes nothing at all — same
	 * tolerance as `setLocale`, since an operator's typo shouldn't take the site down.
	 */
	const configure = ({ defaultLocale: nextDefault, locales: nextLocales }: DialectConfig = {}) => {
		const reject = (reason: string) =>
			console.warn(`svelte-dialect: ignoring configure(), ${reason}`);

		if (nextLocales !== undefined && (!Array.isArray(nextLocales) || !nextLocales.every(isTag))) {
			return reject('locales must be an array of locale tags');
		}
		if (nextDefault !== undefined && !isTag(nextDefault)) {
			return reject('defaultLocale must be a locale tag');
		}

		// deduped: the same list may well come from a table with no unique index on it, and a repeat
		// would show up twice in a language switcher and twice in localizedEntries
		const next = nextLocales ? nextLocales.filter((l, i, all) => all.indexOf(l) === i) : locales;
		const fallback = nextDefault ?? defaultLocale;
		// An empty list keeps meaning "no list configured", exactly as at init — an app that loads
		// its locales later still has a usable default in the meantime.
		if (next.length && !next.includes(fallback)) {
			return reject(`defaultLocale "${fallback}" is not one of [${next.join(', ')}]`);
		}

		defaultLocale = fallback;
		if (nextLocales) locales.splice(0, locales.length, ...next);

		// The locale resolved at init may have just been configured away; leaving it in place would
		// strand t() and getLocale() on a locale the app no longer offers.
		if (locale !== defaultLocale && next.length && !next.includes(locale)) {
			locale = defaultLocale;
			syncDocument(defaultLocale);
		}
	};

	/**
	 * Strips the locale prefix so SvelteKit matches `/about` for `/de-DE/about`. Goes in
	 * `src/hooks.ts`; without it a prefixed URL is simply a route that doesn't exist.
	 *
	 * Reads the current locale set, like everything else — so a prefix `configure` removed stops
	 * being a route at all (404), exactly as a prefix nobody ever configured. That is why
	 * `configure` belongs at server boot and in app init: it is the one entry point that cannot
	 * wait for data, being synchronous and running before load functions.
	 */
	const reroute: Reroute = ({ url }) =>
		// The returned path must still carry the base: SvelteKit checks `startsWith(base)` before
		// slicing it off, and answers 404 when it doesn't match.
		routing ? withBase(splitPath(url.pathname).path) : url.pathname;

	/**
	 * The address of `path` in a locale — the current one unless you name another. The default
	 * locale lives at the bare path, every other one under its own prefix. Use it for every
	 * internal link once routing is on, or navigation will silently drop the locale.
	 */
	const localizeHref = (path: string, target?: string): string => {
		target ??= requestLocale() ?? locale;
		// Only root-relative paths carry a locale prefix. External URLs, relative paths, hashes and
		// mailto:s pass through untouched — prefixing them would corrupt them (`/ru` + `about` would
		// even glue into `/ruabout`). A path starting with `//` (or `/\`) is protocol-relative — it
		// names a host, not a route — so it's external too, not a root-relative path with an empty
		// first segment.
		if (!routing || !path.startsWith('/') || /^\/[/\\]/.test(path)) return path;
		// the locale goes into the path only, so a query or a hash rides along untouched
		const end = path.search(/[?#]/);
		const [pathname, suffix] = end === -1 ? [path, ''] : [path.slice(0, end), path.slice(end)];
		// Strip first, so the function is idempotent: the usual locale switcher is
		// `localizeHref(page.url.pathname, …)`, and `page.url` carries the current prefix — without
		// this, switching from /ru/about to German would produce `/de/ru/about`.
		return withBase(withLocale(splitPath(pathname).path, target)) + suffix;
	};

	/**
	 * Multiplies prerender entry paths across locales: `['/about']` becomes `['/about',
	 * '/ru/about', …]` for every non-default locale. Hand it to `kit.prerender.entries` so a static
	 * build renders the prefixed addresses too — the crawler can't discover them on its own.
	 * Identity when `routing` is off.
	 */
	// Every header the resolved locale can depend on — not just Accept-Language: a strategy that
	// includes `cookie` means two requests with the same URL and header but a different cookie can
	// get different bodies, and a shared cache keying only on the URL would serve one visitor's
	// language to another.
	const varyOn = [
		...(strategy.includes('header') ? ['accept-language'] : []),
		...(strategy.includes('cookie') ? ['cookie'] : [])
	];

	// route-relative on purpose: SvelteKit prepends `paths.base` to every prerender entry.
	// Delegates to the standalone twin (svelte-dialect/entries), so the two cannot drift.
	const localizedEntries = (paths: string[]) =>
		routing
			? staticEntries(
					paths.map((path) => splitPath(path).path),
					{ locales, defaultLocale }
				)
			: staticEntries(paths, { locales: [], defaultLocale });

	const handle: Handle = async ({ event, resolve }) => {
		const fromUrl = routing ? splitPath(event.url.pathname) : undefined;

		// The default locale has exactly one address, so /de-DE/about is a detour back to /about —
		// but only for browser navigations (and clients that don't send Sec-Fetch-Dest, like bots
		// and curl). A programmatic fetch or an asset request gets the content instead of a redirect
		// it never asked to follow.
		const dest = event.request.headers.get('sec-fetch-dest');
		const isDocument = dest === null || dest === 'document';
		if (fromUrl?.locale === defaultLocale && isDocument) {
			const location = withBase(fromUrl.path) + event.url.search;
			const headers = new Headers({ location });
			// With bare-path detection on, a prefix refreshes the cookie (below) — this one too, or a
			// `ru` cookie would bounce the bare address straight on to /ru. Written by hand: Kit only
			// adds `event.cookies` to responses that went through resolve().
			if (detectOnBarePath && event.cookies.get(cookie) !== defaultLocale) {
				headers.append('set-cookie', `${cookie}=${defaultLocale};${cookieAttributes}`);
			}
			return new Response(null, { status: 308, headers });
		}

		// The opt-in bare-path detection: an unprefixed document visit whose resolved locale isn't
		// the default is sent to its own prefix. 307, not 308 — the preference is a cookie away
		// from changing. Vary because the answer may hinge on Accept-Language.
		if (detectOnBarePath && fromUrl && !fromUrl.locale && isDocument) {
			const detected = resolveLocale({
				cookie: event.cookies.get(cookie),
				header: event.request.headers.get('accept-language')
			});
			if (detected !== defaultLocale) {
				const location = localizeHref(fromUrl.path, detected) + event.url.search;
				const headers: Record<string, string> = { location };
				if (varyOn.length) headers.vary = varyOn.join(', ');
				return new Response(null, { status: 307, headers });
			}
		}

		// The other half of the same contract: a prefixed URL is the stronger signal, so it
		// refreshes the cookie — otherwise the very next bare-path visit would bounce the visitor
		// back to the cookie's old language.
		if (detectOnBarePath && fromUrl?.locale && fromUrl.locale !== event.cookies.get(cookie)) {
			event.cookies.set(cookie, fromUrl.locale, {
				path: '/',
				maxAge: cookieMaxAge,
				httpOnly: false, // the client-side resolver reads document.cookie
				sameSite: 'lax',
				...(cookieConfig.domain ? { domain: cookieConfig.domain } : {}),
				secure: cookieConfig.secure ?? false
			});
		}

		const loc = resolveLocale({
			// only the `url` source reads this, and it is inert without routing
			pathname: routing ? event.url.pathname : undefined,
			cookie: event.cookies.get(cookie),
			header: event.request.headers.get('accept-language')
		});
		// Not written to the shared `locale`: on a server that is one value for every request, so
		// whatever runs outside this request's context (another hook, handleError) would read some
		// other visitor's language. Inside the request, requestLocale() answers.

		const dir = direction(loc);
		// Serve the request inside its own locale context, so t()/getLocale() during this render see
		// THIS request's locale even while other requests with other languages run concurrently.
		const store = storage ?? (await ensureStorage());
		const response = (await store.run({ locale: loc }, () =>
			resolve(event, {
				// computed once, not per streamed chunk
				transformPageChunk: ({ html }) =>
					// functions, not strings: a string replacement would expand `$&` and friends
					html.replaceAll('%dialect.lang%', () => loc).replaceAll('%dialect.dir%', () => dir)
			})
		)) as Response;

		if (!varyOn.length) return response;

		// tokens the response doesn't already vary on — an endpoint may have set some itself
		const addVary = (headers: Headers) => {
			const present = (headers.get('vary') ?? '')
				.toLowerCase()
				.split(',')
				.map((t) => t.trim());
			if (present.includes('*')) return;
			for (const token of varyOn) if (!present.includes(token)) headers.append('vary', token);
		};
		try {
			addVary(response.headers);
			return response;
		} catch {
			// `resolve()` can hand back a Response with immutable headers — `Response.redirect()`
			// from an endpoint is one. A fresh Response with copied headers keeps status, statusText,
			// body and existing headers (including repeated Set-Cookie) and makes them mutable.
			const headers = new Headers(response.headers);
			addVary(headers);
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers
			});
		}
	};

	return {
		t,
		formatParts,
		formatNumber,
		formatDate,
		loadTranslations,
		getLocale: () => requestLocale() ?? locale,
		/** `'rtl'` or `'ltr'` for a locale — the current one unless you name another. */
		getTextDirection: (target?: string) => direction(target ?? requestLocale() ?? locale),
		setLocale,
		configure,
		/** The selectable locales. A live view: `configure` rewrites this array in place. */
		locales,
		handle,
		reroute,
		localizeHref,
		localizedEntries
	};
}
