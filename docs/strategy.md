<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Choosing the locale

The locale is resolved by walking a list of sources, first match winning. Sources that don't apply to the current side are skipped, so the same list works on the server and in the browser.

## The default order

```ts
strategy: ['url', 'cookie', 'lang', 'header', 'navigator', 'default'];
```

url only does anything with routing on. header (Accept-Language) only exists on the server. lang (<html lang>) and navigator only exist in the browser, and lang is ignored when it equals defaultLocale — a prerendered page always says the default, so that value carries no decision.

## Reordering it

Shorten or reorder the list to suit — never guess from the browser, just the cookie or the default:

```ts
createDialect({
	strategy: ['cookie', 'default'],
	// …
});
```

## Caching

When header participates, responses carry Vary: Accept-Language, and when cookie does, Vary: Cookie — so a shared cache never serves one visitor's language to another.

## Request isolation

On the server every request resolves inside its own AsyncLocalStorage context, so concurrent requests with different languages can't bleed into each other — t() and getLocale() inside a render always see that request's locale. Runtimes without async\_hooks fall back to a single shared slot instead.

## Locales decided at runtime

createDialect runs at module import, before an operator's settings table or a boot-time env read can be reached. configure replaces the locale set and the default locale afterwards, and every downstream reader — negotiation, setLocale, reroute, localizeHref — follows the new values.

Call it once on the server at boot, before the first request, and again on the client during app init with whatever the server delivered through page data — configure is idempotent, so re-running it on every navigation costs nothing.

src/hooks.server.ts — top-level await runs before the first request 

```ts
import { configure, handle as dialect } from '#lib/i18n.ts';

const settings = await loadLocaleSettings();
configure({ defaultLocale: settings.defaultLocale, locales: settings.locales });

export const handle = dialect;
```

src/routes/+layout.ts 

```ts
import { configure } from '#lib/i18n.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	configure(data.i18n);
	return data;
};
```

locales replaces the set outright rather than merging into it, and defaultLocale has to belong to the resulting set; a call that breaks either rule warns and changes nothing. reroute is the one piece that can't wait for it — SvelteKit calls it synchronously before any load function — so a prefix configure removes stops being a route at all.
