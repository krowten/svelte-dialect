<script lang="ts">
	import type { Snippet } from 'svelte';

	// `warning` is for a requirement that breaks the setup when skipped, `note` for everything else
	const {
		tone = 'warning',
		title,
		class: className,
		children
	}: { tone?: 'warning' | 'note'; title: string; class?: string; children: Snippet } = $props();
</script>

<div
	role="note"
	class={[
		'rounded-lg border-l-4 px-4 py-3 text-sm',
		tone === 'warning'
			? 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40'
			: 'border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/40',
		className
	]}
>
	<p class="font-semibold text-gray-900 dark:text-gray-100">{title}</p>
	<p class="mt-1 text-gray-700 dark:text-gray-300">{@render children()}</p>
</div>
