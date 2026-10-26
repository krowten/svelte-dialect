<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Locale in the URL

By default the locale lives in a cookie and the URL never changes. Set routing: true and every locale except the default gets its own path prefix instead.

## The prefix

Spelled exactly like the locale, so locales: \['en-US', 'de-DE'\] gives you /en-US/some/url. If you'd rather have /de/, name the locale de — there is no second mapping to keep in sync.

## Three pieces to wire up

handle from Setup doesn't change: it already reads the URL prefix once routing is on. reroute goes in a separate, universal src/hooks.ts (not hooks.server.ts) — it strips the prefix before SvelteKit matches routes, so your route files need no \[locale\] directory.

src/lib/i18n.ts 

```ts
export const { t, handle, reroute, localizeHref, localizedEntries } = createDialect({
	// …messages as in Setup
	locales: ['en-US', 'de-DE'],
	defaultLocale: 'de-DE',
	routing: true
});
```

src/hooks.ts — universal, not hooks.server.ts 

```ts
import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.js';

export const reroute: Reroute = dialect;
```

Note

reroute only decides which route a request matches; the URL itself keeps its prefix. So event.url, the url of a load function and page.url all read /de-DE/about, exactly what the browser shows. To compare against a route, use route.id (/about), which never carries the locale. That goes double for access checks in hooks: /de-DE/admin renders the same route as /admin, so a guard on event.url.pathname lets it through.

## Served from a subdirectory

Set paths.base as usual: svelte-dialect/kit reads it on its own, and the locale prefix is looked for after the base rather than instead of it.

vite.config.ts — svelte-dialect/kit reads it, nothing to pass to createDialect 

```ts
sveltekit({ paths: { base: '/docs' } });
```

## Linking

Use localizeHref for internal links — a bare href would drop the locale on navigation. It prefixes with the current locale, and the default locale always gets the bare path. This is ordinary same-locale navigation, so it never needs a full page reload.

```svelte
<a href={localizeHref('/about')}>About</a>
```

### Switching locale

setLocale already knows whether routing is on: with it, switching navigates to the same page under the new prefix — a full navigation on purpose, so the served document, the URL and the runtime agree.

### Try it

This page in every locale:

[en](https://krowten.github.io/svelte-dialect/routing.md)[ru](https://krowten.github.io/svelte-dialect/ru/routing)[de](https://krowten.github.io/svelte-dialect/de/routing)

## Prerendering the prefixed addresses

A static build only renders what the crawler can reach, and nothing links to /ru/... from the default-locale pages it starts from. localizedEntries multiplies your entry paths across locales for prerender.entries — see the demo's own vite.config.ts for a working example.

vite.config.ts 

```ts
import { localizedEntries } from 'svelte-dialect/entries';

localizedEntries(['/', '/about'], { locales: ['en', 'ru'], defaultLocale: 'en' });
// → ['/', '/ru', '/about', '/ru/about']
```

## What the URL means

The prefix outranks cookie and Accept-Language: a URL is an explicit request for a specific version of the page. The default locale has exactly one address — /de-DE/some/url when de-DE is the default answers 308 to /some/url. With detectOnBarePath: true, a document visit to /about whose cookie or Accept-Language says ru answers 307 to /ru/about instead — off by default, since without it the bare path simply IS the default locale.
