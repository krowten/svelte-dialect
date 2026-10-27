<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Rich text

A link inside a translated sentence is the classic i18n headache: split the string into three keys and the translator loses word order. MF2 has markup for exactly this, and the Rich component renders it through snippets — the markup name in the message decides which snippet wraps the text.

## Try it

The link and its target both live in the translation, not in the component:

Read [the docs](https://krowten.github.io/svelte-dialect/setup.md) before you ship

```json
{ "cta": "Read {#link to=|/docs|}the docs{/link} before you ship" }
```

```svelte
<script lang="ts">
	import { Rich } from 'svelte-dialect';
	import { formatParts } from '#lib/i18n.ts';

	// options come from the translation: let only a path on this site through
	const internal = (to: unknown) => (/^\/(?![/\\])/.test(String(to)) ? String(to) : undefined);
</script>

<Rich parts={formatParts('home:cta')}>
	{#snippet link(children, options)}<a href={internal(options.to)}>{@render children()}</a>{/snippet}
</Rich>
```

## Options and nesting

A snippet receives a snippet for the markup's contents and the markup's MF2 options — {#link to=|/x|} becomes { to: '/x' } — so a translation can carry per-locale attributes. They are input like any other, so check them before they reach an attribute: the snippets on this page only let a path on this site through. Nesting works to any depth; each level goes through its own snippet:

**bold with a [link](https://krowten.github.io/svelte-dialect/setup.md) inside it**

## Missing snippets don't break the page

Markup with no matching snippet still renders its contents — so an outdated translation, or one written before a snippet existed, degrades gracefully instead of vanishing:

This sentence has unwired markup in the middle

## Below Rich

formatParts(key, params) is the primitive underneath — it returns text / open / close / standalone parts. Reach for it directly if you'd rather render markup with machinery of your own.

## Naming markup

Markup names become snippet names, so keep them valid identifiers — {#my-link} has no writable snippet.
