<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Typed keys & CLI

t('home:titel') compiles and renders the key, because TypeScript can't know your catalog on its own. Generate a union from the same files the runtime reads, and it does.

## Generating the types

```sh
npx svelte-dialect typegen --messages src/lib/messages --out src/lib/i18n-keys.d.ts
```

Run the CLI against your message files and hand the result to createDialect. Known keys now autocomplete, while any plain string still compiles, so keys that only exist at runtime, such as one coming from a database, keep working. The flip side: a misspelled key compiles too. svelte-dialect check is what catches it (see below).

```ts
import type { MessageKey } from './i18n-keys';

export const { t, loadTranslations } = createDialect<MessageKey>({ … });
```

## Strict parameters

The generated file also exports MessageParams. Pass it as the second generic and the parameters a message names become part of t's signature — a call missing one, or misspelling one, is now a type error instead of silent fallback text at runtime.

```ts
import type { MessageKey, MessageParams } from './i18n-keys';

export const { t } = createDialect<MessageKey, MessageParams>({ … });

t('home:greeting', { name: 'Kat' }); // ✅
t('home:greeting'); // ✗ Expected 2 arguments, but got 1
t('home:greeting', { nmae: 'Kat' }); // ✗ 'nmae' does not exist
t('cms:hero'); // ✅ nothing is known about a runtime-only key, so anything goes
```

Both generics are additive: omit either and every call stays exactly as permissive as it was.

## Keys from a database

Types are a snapshot of what generation saw. For a catalog that lives elsewhere, export a {locale: {namespace: {…}}} dump and point typegen --from-json at it, then regenerate whenever the dump changes.

```sh
npx svelte-dialect typegen --from-json dump.json --out src/lib/i18n-keys.d.ts
```

## The CLI

Three commands, configured entirely by flags rather than a config file. --messages may repeat on all three, for when bundled and lazy trees live apart. Every flag and exit code is in the [CLI reference](https://krowten.github.io/svelte-dialect/cli.md).

```sh
npx svelte-dialect typegen   # the .d.ts above
npx svelte-dialect check     # compare t('…') calls in code against the catalogs
npx svelte-dialect migrate   # convert i18next / ICU MessageFormat JSON to MF2, in place
```

### check

Scans your source for t('ns:key') literals and reports keys missing from any locale (exit 1, so it belongs in CI) and, with --unused, catalog keys nothing references. Keys built from variables are invisible to a static scan, so it reports honestly on what it can see.

### migrate

Rewrites {{name}}-style i18next interpolations, collapses key\_one/key\_other plural suffixes into MF2 .match, and parses the common ICU MessageFormat constructs. Every produced string is validated against the real MF2 parser before it is written; anything it can't convert is left untouched and reported. Run with --dry-run first to see the before/after pairs.
