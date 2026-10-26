<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Setup

Every step below is required for the configuration this site runs — locale in the URL, remembered in a cookie between visits. Follow them in order and the last one puts a translated line on the page.

## Set up with the Svelte CLI

In an existing SvelteKit 3 project, one command does steps 1–5 below:

```sh
npx sv add svelte-dialect   # or: bunx sv add svelte-dialect / pnpm dlx sv add svelte-dialect
```

It asks for your locales (the first one is the default) and whether the locale goes in the URL, then:

* adds svelte-dialect to dependencies;
* writes src/lib/i18n.ts with createDialect;
* writes src/lib/messages/<locale>/common.json for every locale, with one greeting to translate;
* exports handle from src/hooks.server.ts, wrapping a handle you already have in sequence(), and, with the locale in the URL, reroute from src/hooks.ts;
* adds the lang and dir placeholders to the <html> tag in src/app.html.

Files you already have are left as they are. To skip the prompts, pass the answers inline:

```sh
npx sv add svelte-dialect=locales:en,de+routing:yes
```

Then render a message as in step 6\. The sections below are the same setup done by hand.

## Install

```sh
npm install svelte-dialect   # or: bun add svelte-dialect / pnpm add svelte-dialect
```

Requires Svelte 5 and, for this setup, SvelteKit 3\. Without SvelteKit, import createDialect from svelte-dialect instead and skip the hooks: messages, t() and lazy namespaces work the same, while URL routing and server-side negotiation need Kit.

## 1\. Write a message

One JSON file per locale and namespace, under src/lib/messages/<locale>/<namespace>.json. The value is MessageFormat 2; add a ru/common.json with the same key for a second language.

src/lib/messages/en/common.json 

```jsonc
{ "greeting": "Hello, {$name}!" }
```

## 2\. Create the dialect

Once, in src/lib/i18n.ts. routing puts the locale in the URL; without it every export below still works, just against a cookie-only setup with no prefix.

src/lib/i18n.ts 

```ts
import { createDialect } from 'svelte-dialect/kit';

export const { t, handle, reroute, localizeHref, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en',
	routing: true
});
```

## 3\. The handle hook

SvelteKit calls this on every request. It negotiates the locale — the URL prefix first, then the cookie, then Accept-Language — and writes it into the response as the page streams out.

src/hooks.server.ts 

```ts
import type { Handle } from '@sveltejs/kit/hooks';
import { handle as dialect } from '#lib/i18n.js';

export const handle: Handle = dialect;
```

## 4\. The reroute hook

Goes in src/hooks.ts — universal, not hooks.server.ts. Strips the prefix before SvelteKit matches routes, so /ru/about renders src/routes/about with no \[locale\] directory to add.

src/hooks.ts — universal, not hooks.server.ts 

```ts
import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.js';

export const reroute: Reroute = dialect;
```

## 5\. The document

handle fills these two placeholders as the page renders.

src/app.html 

```svelte
<html lang="en" dir="ltr">
```

## 6\. Use it

Import t anywhere. Start the dev server: the page reads “Hello, world!”, and /ru reads the Russian line once ru/common.json exists.

src/routes/+page.svelte 

```svelte
<script lang="ts">
	import { t } from '#lib/i18n.js';
</script>

<p>{t('common:greeting', { name: 'world' })}</p>
```

## Next

With that in place: write more [message files](https://krowten.github.io/svelte-dialect/messages.md), then read how [the URL prefix and the cookie](https://krowten.github.io/svelte-dialect/routing.md) decide which locale a visitor sees.
