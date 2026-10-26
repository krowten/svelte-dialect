<script lang="ts">
	import { t } from '#lib/i18n.js';

	// `id` comes from the message key (`routing:prefix_title` → `prefix`), not from the translated
	// text, so /de/routing#prefix is the same link in every language.
	const {
		level,
		id,
		text,
		class: className
	}: { level: 2 | 3; id: string; text: string; class?: string } = $props();

	const base = $derived(
		level === 2 ? 'text-xl font-semibold' : 'text-sm font-semibold text-gray-500 dark:text-gray-400'
	);
</script>

<svelte:element this={`h${level}`} {id} class={['group scroll-mt-4', base, className]}>
	{text}
	<a
		href="#{id}"
		class="ml-1 rounded px-1 text-gray-500 no-underline opacity-0 group-hover:opacity-100 hover:text-gray-900 focus-visible:opacity-100 dark:text-gray-400 dark:hover:text-gray-100 pointer-coarse:opacity-100"
		aria-label={t('common:heading.permalink', { title: text })}>#</a
	>
</svelte:element>
