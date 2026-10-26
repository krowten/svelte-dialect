# svelte-dialect

Svelte 5 i18n on [MessageFormat 2](https://messageformat.unicode.org/), for SvelteKit and for plain Svelte. The locale is a rune instead of a store, and a small CLI types your message keys. In SvelteKit the locale is negotiated on the server for each request, so concurrent visitors never get each other's language, and it can live in the URL (`/de/about`). Translations load per namespace when a page asks for them, and markup inside a message renders through your own snippets. MF2 is the only message syntax to learn. Changes are in the [changelog](CHANGELOG.md).

This README covers the minimal setup: URL routing plus cookie persistence, the combination most apps want. For dynamic loading, rich text, locale strategy, typed keys, the CLI and the full API, see the [docs site](https://krowten.github.io/svelte-dialect/) (in English, German and Russian), where every example is live, working code. (Building it locally works too: `npm install && npm run dev`.)

## Install

```sh
npm install svelte-dialect
```

Requires Svelte 5 (`svelte@^5`). SvelteKit 3 is an optional peer dependency, and the package has an
entry point for each case:

- **`svelte-dialect/kit`** for SvelteKit apps, which is what the rest of this README uses. Locale
  routing, server-side negotiation and `%dialect.lang%` go through Kit's `handle`/`reroute`; this
  entry also picks up `paths.base` and keeps the locale in step with client-side navigation.
- **`svelte-dialect`** for Svelte without Kit: a Vite SPA, Astro islands, a widget. See
  [Without SvelteKit](#without-sveltekit).

Everything below works without any experimental flags.

The locale is a rune, so the package ships uncompiled Svelte and resolves only under the `svelte`
export condition. Tooling that reads the package without that condition (a Vitest `node` environment
set up without the Svelte plugin, say) reports the package as unresolvable. That is the honest
error, and adding the plugin (or `resolve.conditions: ['svelte']`) is the fix. Type-only imports
need nothing.

## Quickstart

In a SvelteKit 3 project, the Svelte CLI can do every step of this section for you:

```sh
npx sv add svelte-dialect
```

It asks for your locales and whether the locale goes in the URL, adds the package, writes
`src/lib/i18n.ts` and a `common.json` per locale, and wires `handle`, `reroute` and `app.html`. An
existing `handle` is wrapped in `sequence()`, and files you already have are left alone. The rest of
this section is what it writes, for doing it by hand.

Create the dialect once in **`src/lib/i18n.ts`**, from your message files, with the locale routed in
the URL and remembered in a cookie between visits:

```ts
import { createDialect } from 'svelte-dialect/kit';

export const { t, handle, reroute, localizeHref, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en',
	locales: ['en', 'ru'],
	routing: true
});
```

The locale lives in a `dialect` cookie by default (400-day max age). A URL prefix always wins. On an
unprefixed URL the cookie decides, and without one the server negotiates `Accept-Language` (on a
static site, the browser language), falling back to `defaultLocale`.

Wire up `handle` in **`src/hooks.server.ts`**, typed the way SvelteKit expects:

```ts
import type { Handle } from '@sveltejs/kit/hooks';
import { handle as dialect } from '#lib/i18n.js';

export const handle: Handle = dialect;
```

And `reroute` in a separate, **universal** **`src/hooks.ts`** — this is what strips the locale prefix
so your route files need no `[locale]` directory:

```ts
import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.js';

export const reroute: Reroute = dialect;
```

`reroute` only picks the route; the URL itself keeps its prefix. `event.url`, a load function's `url`
and `page.url` all read `/ru/about`, exactly what the browser shows. To compare against a route, use
`route.id` (`/about`), which never carries the locale. That goes double for access checks in hooks:
`/ru/admin` renders the same route as `/admin`, so a guard on `event.url.pathname` lets it through.

Finally, in **`src/app.html`**, add the two attributes `handle` fills in on every request; everything
else in the file stays as SvelteKit scaffolded it:

```html
<!-- src/app.html -->
<html lang="%dialect.lang%" dir="%dialect.dir%">
	<!-- ...unchanged: <head> with %sveltekit.head%, <body> with %sveltekit.body% -->
</html>
```

`%dialect.dir%` resolves to `ltr` or `rtl` for the locale from `Intl`, so right-to-left languages
work with no extra configuration.

Link internally with `localizeHref`, not a bare `href` — a bare one would drop the locale prefix on
navigation:

```svelte
<a href={localizeHref('/about')}>About</a>
```

## Message files

Messages live under `src/lib/messages/<locale>/<namespace>.json`, one flat or nested JSON object per
namespace:

```
src/lib/messages/
  en/
    common.json
    home.json
  ru/
    common.json
    home.json
```

Keys are looked up as `t('namespace:dot.path', params)`; nested objects flatten into dot paths, e.g.
`{ "nav": { "home": "Home" } }` → `t('common:nav.home')`. A message is just MF2, so plurals, dates,
currencies and markup all work with the same one syntax to learn:

```svelte
<script lang="ts">
	import { t } from '#lib/i18n.js';

	let name = $state('Kat');
</script>

<p>{t('home:greeting', { name })}</p>
```

See the demo's **Message files** page for plurals and selectors, number/date/currency formatting,
custom MF2 functions and how a broken message degrades instead of throwing, and the **Loading
messages** page for fetching namespaces from a database or an API instead of bundling them.

## Without SvelteKit

Import from the root entry and skip the hooks and `app.html` placeholders — there is nothing else to
wire up:

```ts
import { createDialect } from 'svelte-dialect';

export const { t, setLocale, getLocale, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en'
});
```

Messages, `t`, `Rich`, lazy namespaces and typed keys work exactly as in a Kit app. The locale comes
from the cookie `setLocale` writes, then the browser language; switching re-renders every `t()` and
updates `<html lang dir>`. What needs a server stays Kit-only: locale routing in the URL,
negotiation from `Accept-Language`, and server-rendered output in the visitor's language.

## More

The [docs site](https://krowten.github.io/svelte-dialect/) is the rest of the documentation — each
page is real, working code, not prose about code:

- **Loading messages** — build-time bundling, lazy per-namespace chunks, remote functions, `fetch`
- **Locale in the URL** — the routing setup above, in full, plus prerendering and what a URL means
- **Choosing the locale** — the lookup order, request isolation, locales decided at runtime
- **Rich text** — markup in translations, rendered through the `Rich` component
- **Typed keys & CLI** — generating a key union, strict parameters, `typegen` / `check` / `migrate`
- **API reference** — every export and every `createDialect` option, in one table

## License

MIT © [Vladimir Kraikovskii](https://github.com/krowten)
