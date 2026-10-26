<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Loading messages

Three ways to get messages in, and two patterns for asking a page to wait for them. They compose: bundle what every page needs, fetch the rest.

## 1\. At build time

```ts
createDialect({
	messages: {
		// eager: inlined at build time
		...import.meta.glob('./messages/**/*.json', { eager: true }),
		// not eager: fetched the first time a page asks for it
		...import.meta.glob('./messages-lazy/**/*.json')
	},
	defaultLocale: 'en'
});
```

The default. import.meta.glob reads the files during compilation and inlines them — no request at runtime, nothing to configure.

Drop eager: true from the same glob and each namespace becomes its own chunk, fetched the first time a page asks for it. Both forms can sit in the same messages object.

## 2\. On demand

Two patterns for waiting on a namespace before rendering. Below, one page uses each — reload to see both run.

### In a load function

A universal load may return anything, including the t function itself. Works on stable SvelteKit, no compiler flags.

Loaded in a load function

This namespace was fetched in a universal load function, which returned the t function itself. No experimental compiler options involved — this is the pattern for stable SvelteKit.

### In the component

Awaited straight in <script>.

Loaded on demand

This namespace is not in the page bundle. It arrives through the loader you configure — here a dynamic import, in your app just as easily a fetch to an API.

Available in 3 languages

Note

This needs Svelte 5.36+ with compilerOptions.experimental.async.

+page.ts 

```ts
export const load: PageLoad = async () => await loadTranslations('billing');
```

+page.svelte 

```svelte
const { data }: PageProps = $props();
<h1>{data.t('billing:title')}</h1>
```

```ts
// in the component's script, with experimental.async on
import { loadTranslations } from '#lib/i18n.js';

const { t } = await loadTranslations('dashboard');

// then in the markup
{t('dashboard:title')}
```

## 3\. From your own API

### SvelteKit remote functions

A query() called like a local function, run inside your loader — no endpoint to write, no fetch to get wrong. Needs kit.experimental.remoteFunctions and compilerOptions.experimental.async.

messages.remote.ts 

```ts
import * as v from 'valibot';
import { query } from '$app/server';

export const getMessages = query(
	v.object({ locale: v.picklist(['en', 'ru']), namespace: v.picklist(['dashboard']) }),
	async ({ locale, namespace }) => db.loadMessages(locale, namespace)
);
```

lib/i18n.ts 

```ts
createDialect({
	defaultLocale: 'en',
	locales: ['en', 'ru'],
	loader: async ({ locale, namespace }) => getMessages({ locale, namespace })
});
```

### Plain fetch

The portable option: no experimental flags, works during SSR provided the URL is absolute — there is no page to be relative to on the server.

```ts
createDialect({
	defaultLocale: 'en',
	locales: ['en', 'ru'],
	loader: async ({ locale, namespace }) => {
		const res = await fetch(`https://example.com/i18n/${locale}/${namespace}.json`);
		return res.json();
	}
});
```

## One call, however many requests

Concurrent callers for the same locale and namespace share one in-flight loader call, so a hundred simultaneous SSR requests trigger one fetch, not a hundred.
