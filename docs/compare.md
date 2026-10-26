<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Svelte i18n libraries compared (2026)

Svelte and SvelteKit apps have several i18n libraries to choose from, and they differ on real points: stores or runes, runtime lookup or compiled functions, ICU or MessageFormat 2\. This page compares svelte-dialect with svelte-i18n, Sveltia I18n, sveltekit-i18n, Paraglide JS, typesafe-i18n and wuchale.

svelte-dialect's author wrote this page. Every claim about the other libraries comes from their current READMEs, docs and npm pages, listed under Sources, and anything that could not be confirmed is left out.

For a new SvelteKit app, start with Paraglide JS. It is an official sv add-on, it compiles messages to tree-shakable functions, and it is released often. The other libraries earn their place when one of their strengths matches your project, as the sections below describe.

## How they work

| Library        | Svelte API                                                                                          | Message format                                                                                    | Type safety                                                                               | Bundle                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| svelte-dialect | Svelte 5\. The locale is a rune and t() is a plain function.                                        | MessageFormat 2 only.                                                                             | A CLI generates a key union and parameter types. Plain strings still compile.             | Runtime. Messages are parsed in the browser, with no per-message tree-shaking.                        |
| svelte-i18n    | Stores ($\_, $locale). The peer range covers Svelte 3, 4 and 5.                                     | ICU MessageFormat through formatjs.                                                               | Keys are plain strings. Its docs describe no key typing.                                  | Runtime, with intl-messageformat as a dependency.                                                     |
| Sveltia I18n   | Svelte 5\. locale is a reactive object and t() a plain function, with svelte-i18n's function names. | MessageFormat 2 only, through messageformat.                                                      | Keys are plain strings. Its README describes no key typing.                               | Runtime, with messageformat as its only dependency.                                                   |
| sveltekit-i18n | Svelte 5 only. A reactive instance with t(), and $t stores through an extension.                    | Curly format by default. ICU, MF2 and i18next parsers are separate packages.                      | A typegen Vite plugin writes a schema for typed keys and parameters.                      | Runtime. Loaders can be scoped to a route.                                                            |
| Paraglide JS   | Plain message functions such as m.greeting({ name }). Switching locale reloads the document.        | Inlang format by default, with MF2-style markup and selectors. ICU 1 and i18next through plugins. | The compiler emits typed message functions, so a wrong key or parameter fails to compile. | Compiled and tree-shaken per message. Its own benchmark claims up to 70% less than runtime libraries. |
| typesafe-i18n  | Generated Svelte stores ($LL).                                                                      | Its own syntax: {name}, {{one\|many}}, switch-case.                                               | A generator writes types from the base locale. JSDoc works for plain JavaScript.          | Runtime of about 1 kB, according to its README.                                                       |
| wuchale        | Svelte 5 adapter. Compiled code uses $derived.                                                      | Gettext PO catalogs. Plurals through a plural() helper.                                           | No keys: the source text is the key, so there is nothing to type.                         | Compiled. Catalogs are plain arrays without keys.                                                     |

## Server, routing and upkeep

| Library        | Locale detection and URLs                                                                                                                                                               | Lazy loading                                                                | Rich text                                                                        | Latest release                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| svelte-dialect | Cookie, Accept-Language or URL prefix (routing: true, no \[locale\] folder). Isolated per request.                                                                                      | Per namespace: dynamic import chunks, fetch or remote functions.            | MF2 markup, rendered by Rich through snippets.                                   | 0.1.0\. The project started in July 2026\. A community sv add-on (npx sv add svelte-dialect). |
| svelte-i18n    | The SvelteKit guide reads Accept-Language in handle and sets a global store. No URL routing in its docs.                                                                                | register(locale, loader) loads one locale at a time.                        | Not covered in its docs.                                                         | 4.0.1, October 2024.                                                                          |
| Sveltia I18n   | getLocaleFrom\* helpers for the browser, pathname or query. The locale is one module-level value, so its README calls SSR unsafe under load and recommends detecting it in the browser. | register(locale, loader) loads one locale at a time.                        | Not covered in its README.                                                       | 1.5.0, October 2026\. First published in April 2026.                                          |
| sveltekit-i18n | One instance per request: preferredLocale, then Accept-Language, then the default. URL locales appear as example apps.                                                                  | Loaders per route or namespace, including from an API.                      | The extension-html package adds a T component.                                   | 3.4.1, October 2026\. Nothing was released between July 2023 and September 2026.              |
| Paraglide JS   | Middleware with strategies: url, cookie, localStorage, browser language. Localized URLs are built in.                                                                                   | Every message carries all locales. Per-locale splitting is experimental.    | {#link}…{/link} markup, rendered with snippets from @inlang/paraglide-js-svelte. | 2.29.0, October 2026\. An official sv add-on.                                                 |
| typesafe-i18n  | Locale detectors for browser and server. Its README lists no URL routing.                                                                                                               | Optional async locale loading, plus namespaces.                             | Not covered in its README.                                                       | 5.27.1, February 2026.                                                                        |
| wuchale        | runWithLocale isolates requests, and you supply the locale. URL patterns are translated and localized.                                                                                  | Building blocks for any strategy. The server loads all catalogs at startup. | Nested markup in components is extracted without extra syntax.                   | 0.26.7, September 2026\. Pre-1.0.                                                             |

## svelte-dialect

A Svelte 5 library built on MessageFormat 2\. The locale is a rune, SvelteKit routing and negotiation are built in, and it also runs in plain Svelte without Kit.

Choose it if you want MessageFormat 2 with pages rendered on the server in each visitor's language, the locale in the URL without a \[locale\] route folder, and typed keys.

Look elsewhere if you need years of production use, per-message tree-shaking or a mature ecosystem around the library. It is young (0.1.x) and small, it parses messages at runtime, and MF2 is new to most translators.

## svelte-i18n

Store-based, with ICU messages through formatjs and one dictionary per locale. Version 4.0.1 came out in October 2024, and its README says a rework from a singleton to instances is waiting for time and priority.

Choose it if you already run it and it works, if your translators and tools expect ICU, or if your codebase still mixes Svelte 3, 4 and 5\. Its docs point to the i18n-ally VS Code extension for previewing messages.

Look elsewhere if you want runes, typed keys or a SvelteKit-first SSR setup. sveltekit-i18n's README warns that a module-level instance on the server is shared between concurrent requests, and svelte-i18n's SvelteKit guide sets the locale on a global store in handle, so test requests in different languages at the same time before relying on it.

## Sveltia I18n

A runes rewrite of svelte-i18n by the Sveltia CMS team: the same function names, MessageFormat 2 instead of ICU, and a locale that also keeps <html lang dir> in sync. Sveltia CMS and Sveltia UI run on it in production.

Choose it if you are leaving svelte-i18n and want MF2 behind the API you already know, or if the app renders in the browser (an SPA, or adapter-static with the locale picked on the client).

Look elsewhere if the server renders pages in the visitor's language: the locale is shared by every request on the server, and its README (issue #2) recommends client-side detection instead. Its docs also show no URL routing or key typing.

## sveltekit-i18n

Rewritten as 3.x in September 2026 after no releases since July 2023, and moving fast since: 3.4.1 shipped on 7 October. It requires Svelte 5, gives you a reactive per-request instance, loads translations by route and has a plugin for typed keys.

Choose it if you want route-scoped loading, typed keys through typegen, or a choice of message syntax. It is the closest to svelte-dialect in scope and has a larger extension system.

Look elsewhere if you need a long track record: the 3.x line is about a month old. URL locales are shown as example apps rather than a single option, and using the MF2 parser means building on the base package directly instead of the main one.

## Paraglide JS

Compiler-first. Messages become typed functions, and your bundler drops the ones you never call. It is one of the official sv add-ons (npx sv add paraglide), and 2.29.0 was published on 15 October 2026.

Choose it if bundle size matters, if you want compile-time errors for wrong keys and parameters, or if you want the integration the Svelte CLI offers. It has localized URLs and request-scoped SSR built in, and it works outside Svelte if you have other front ends.

Look elsewhere if most of your translations are only known at runtime, such as keys from a CMS or database (its FAQ says a runtime library may fit better). Switching locale reloads the document instead of updating a rune, and lazy loading per locale is still experimental.

## typesafe-i18n

Its own message syntax, a generator that writes types from your base locale, and Svelte stores through $LL. Version 5.27.1 appeared in February 2026, the first release since August 2023, and the repository now lives under the codingcommons organization.

Choose it if type safety on a very small runtime is the priority and you want one library for front end, back end and API code. Its generator covers typed keys and parameters, and JSDoc extends that to plain JavaScript.

Look elsewhere if you want runes, a standard message format that translation tools import, or built-in URL routing. Releases are rare: 5.26.2 in August 2023, then 5.27.1 in February 2026.

## wuchale

It takes a different approach: no keys and no t() calls. At build time it reads the plain markup in your components, extracts the text into PO files and replaces it with indexed lookups into compiled arrays. The Svelte 5 adapter is at 0.26.7, published in September 2026.

Choose it if you want to add i18n to an existing app without rewriting components, if you want gettext PO files that Weblate or Crowdin read, or if you want translated URL paths such as /about to /es/acerca-de.

Look elsewhere if you want explicit typed keys, which it leaves out by design, or a 1.0 API. SSR also leaves locale detection to you: its docs example reads the locale from a search parameter.

## i18next

i18next is a general-purpose runtime library, not a Svelte one. Version 26.4.7 appeared on 16 October 2026, while the Svelte wrapper svelte-i18next was last published in October 2023.

Choose it if the same translation files must also serve React, Node or mobile apps. You do not need the wrapper to keep your files: Paraglide reads i18next files through a plugin, sveltekit-i18n has an i18next parser, and svelte-dialect's migrate command converts {{name}} interpolation and plural suffixes to MF2.

## Sources

Checked in October 2026\. Version numbers and release dates come from the npm registry on that date.

* svelte-dialect: [github.com/krowten/svelte-dialect#readme](https://github.com/krowten/svelte-dialect#readme)
* svelte-i18n: [github.com/kaisermann/svelte-i18n](https://github.com/kaisermann/svelte-i18n),[github.com/kaisermann/svelte-i18n/blob/main/docs/Svelte-Kit.md](https://github.com/kaisermann/svelte-i18n/blob/main/docs/Svelte-Kit.md),[www.npmjs.com/package/svelte-i18n](https://www.npmjs.com/package/svelte-i18n)
* Sveltia I18n: [github.com/sveltia/sveltia-i18n](https://github.com/sveltia/sveltia-i18n),[github.com/sveltia/sveltia-i18n/issues/2](https://github.com/sveltia/sveltia-i18n/issues/2),[www.npmjs.com/package/@sveltia/i18n](https://www.npmjs.com/package/@sveltia/i18n)
* sveltekit-i18n: [github.com/sveltekit-i18n/lib](https://github.com/sveltekit-i18n/lib),[www.npmjs.com/package/sveltekit-i18n](https://www.npmjs.com/package/sveltekit-i18n)
* Paraglide JS: [paraglidejs.com/sveltekit](https://paraglidejs.com/sveltekit),[paraglidejs.com/basics](https://paraglidejs.com/basics),[paraglidejs.com/markup](https://paraglidejs.com/markup),[paraglidejs.com/comparison](https://paraglidejs.com/comparison),[svelte.dev/docs/cli/sv-add](https://svelte.dev/docs/cli/sv-add),[github.com/opral/paraglide-js](https://github.com/opral/paraglide-js),[www.npmjs.com/package/@inlang/paraglide-js](https://www.npmjs.com/package/@inlang/paraglide-js)
* typesafe-i18n: [github.com/codingcommons/typesafe-i18n](https://github.com/codingcommons/typesafe-i18n),[github.com/codingcommons/typesafe-i18n/tree/main/packages/adapter-svelte](https://github.com/codingcommons/typesafe-i18n/tree/main/packages/adapter-svelte),[www.npmjs.com/package/typesafe-i18n](https://www.npmjs.com/package/typesafe-i18n)
* wuchale: [wuchale.dev/intro/why](https://wuchale.dev/intro/why/),[wuchale.dev/adapters/svelte](https://wuchale.dev/adapters/svelte/),[wuchale.dev/guides/urls](https://wuchale.dev/guides/urls/),[wuchale.dev/guides/loading](https://wuchale.dev/guides/loading/),[github.com/wuchalejs/wuchale](https://github.com/wuchalejs/wuchale),[www.npmjs.com/package/wuchale](https://www.npmjs.com/package/wuchale)
* i18next: [www.npmjs.com/package/i18next](https://www.npmjs.com/package/i18next),[www.npmjs.com/package/svelte-i18next](https://www.npmjs.com/package/svelte-i18next)
