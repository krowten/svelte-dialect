import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const MESSAGE = `{ "cta": "Read {#link to=|/docs|}the docs{/link} before you ship" }`;

const COMPONENT = `<script lang="ts">
	import { Rich } from 'svelte-dialect';
	import { formatParts } from '#lib/i18n.js';

	// options come from the translation: let only a path on this site through
	const internal = (to: unknown) => (/^\\/(?![/\\\\])/.test(String(to)) ? String(to) : undefined);
</script>

<Rich parts={formatParts('home:cta')}>
	{#snippet link(children, options)}<a href={internal(options.to)}>{@render children()}</a>{/snippet}
</Rich>`;

export const load: PageServerLoad = async () => ({
	messageCode: await highlight(MESSAGE, 'json'),
	componentCode: await highlight(COMPONENT, 'svelte')
});
