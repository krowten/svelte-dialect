<script lang="ts">
	/**
	 * Renders `formatParts()` output, mapping MF2 markup to snippets passed by name:
	 *
	 *     <Rich parts={formatParts('home:cta')}>
	 *         {#snippet link(children, options)}<a href="/docs">{@render children()}</a>{/snippet}
	 *     </Rich>
	 *
	 * for a message like `Read {#link}the docs{/link} now`. A snippet receives a snippet rendering
	 * the markup's contents and its MF2 options (`{#link to=|/x|}` → `{ to: '/x' }`); standalone
	 * markup (`{#img/}`) gets a snippet that renders nothing. Nesting works to any depth — the flat
	 * parts are rebuilt into a tree and every level goes through its own snippet. Markup without a
	 * matching snippet still renders its contents, so an outdated translation never blanks the page.
	 */
	import type { Snippet } from 'svelte';
	import type { RichPart } from './core.svelte.js';

	type MarkupSnippet = Snippet<[Snippet, Record<string, unknown>]>;
	type Props = { parts: RichPart[] } & Record<string, MarkupSnippet | RichPart[]>;

	const { parts, ...snippets }: Props = $props();

	// Svelte's own `$props()` rest object answers `Object.hasOwn`/`getOwnPropertyDescriptor` for an
	// Object.prototype member name (`toString`, `valueOf`, …) as if it were a real bound prop, even
	// when none was passed — a quirk of how it proxies the rest, not something this component can
	// rely on. `Object.keys` doesn't have that problem: it reflects exactly the props actually bound.
	const snippetNames = $derived(new Set(Object.keys(snippets)));

	type MarkupNode = {
		kind: 'markup';
		name: string;
		options: Record<string, unknown>;
		children: Node[];
	};
	type Node = { kind: 'text'; value: string } | MarkupNode;

	const tree = $derived.by(() => {
		const root: Node[] = [];
		// markup still open, innermost last; a node joins its parent as soon as it opens and its
		// children are filled in afterwards, so an unclosed open simply runs to the end of the message
		const open: MarkupNode[] = [];
		for (const part of parts) {
			const siblings = open[open.length - 1]?.children ?? root;
			if (part.type === 'text') {
				siblings.push({ kind: 'text', value: part.value });
			} else if (part.type === 'standalone') {
				siblings.push({
					kind: 'markup',
					name: part.name,
					options: part.options ?? {},
					children: []
				});
			} else if (part.type === 'open') {
				const node: MarkupNode = {
					kind: 'markup',
					name: part.name,
					options: part.options ?? {},
					children: []
				};
				siblings.push(node);
				open.push(node);
			} else {
				// a close with nothing to close is dropped rather than thrown: hand-edited translations
				// do go out of balance, and a blank page is a worse answer than slightly wrong markup
				let at = open.length - 1;
				while (at >= 0 && open[at].name !== part.name) at--;
				if (at >= 0) open.length = at;
			}
		}
		return root;
	});

	const snippetFor = (name: string): MarkupSnippet | undefined => {
		// Bound-prop check only — otherwise unknown markup named after an inherited Object.prototype
		// member (`{#toString}`, `{#__defineGetter__}`) would call that function instead of falling
		// through to "no matching snippet", either eating the markup's contents or throwing mid-render.
		if (!snippetNames.has(name)) return undefined;
		const candidate = snippets[name];
		return typeof candidate === 'function' ? candidate : undefined;
	};
</script>

{#snippet render(
	nodes: Node[]
)}{#each nodes as node, i (i)}{#if node.kind === 'text'}{node.value}{:else}{@const snippet =
				snippetFor(node.name)}{#snippet children()}{@render render(
					node.children
				)}{/snippet}{#if snippet}{@render snippet(
					children,
					node.options
				)}{:else}{@render children()}{/if}{/if}{/each}{/snippet}{@render render(tree)}
