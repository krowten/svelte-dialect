# Changelog

All notable, user-visible changes to `svelte-dialect`.

## 0.1.1

- `npx sv add svelte-dialect` imports `#lib/i18n.ts` in the hooks of a
  TypeScript project, the file it actually wrote (`#lib/i18n.js` in a
  JavaScript one). The README and docs examples import `.ts` too.
- The README shows how to pass the `sv add` answers inline.

## 0.1.0

First public release.

- `createDialect` from `svelte-dialect/kit` for SvelteKit 3 and from `svelte-dialect`
  for Svelte without Kit. The locale is a rune; `t()`, `formatParts()`,
  `formatNumber()` and `formatDate()` re-render when it changes.
- Messages in [MessageFormat 2](https://messageformat.unicode.org/): plurals and
  selectors, number, currency and date formatting, custom functions. A broken
  message renders its fallback instead of throwing.
- `handle` negotiates the locale on the server for each request, from the URL
  prefix, a cookie and `Accept-Language`, and fills `%dialect.lang%` and
  `%dialect.dir%` in `app.html`. Concurrent requests never share a locale.
- `routing: true` puts the locale in the URL (`/de/about`) through `reroute`,
  with no `[locale]` route folder; `localizeHref` builds links and
  `localizedEntries` (also `svelte-dialect/entries`) lists every page in every
  locale for prerendering.
- Namespaces bundled at build time or loaded on demand with
  `loadTranslations`, from dynamic imports, `fetch` or remote functions.
- `Rich` renders markup in messages (`{#link}…{/link}`) through your snippets.
- The `svelte-dialect` CLI: `typegen` writes a key union with parameter
  types, `check` finds keys missing from a locale, `migrate` converts i18next
  and ICU MessageFormat JSON to MF2.
- `npx sv add svelte-dialect` sets a project up: `src/lib/i18n.ts`, a
  `common.json` per locale, both hooks and the `app.html` attributes.
