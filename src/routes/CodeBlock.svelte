<script lang="ts">
	import type { CodeSample } from './code.js';

	import { t } from '#lib/i18n.js';

	const { sample, class: className }: { sample: CodeSample; class?: string } = $props();

	let copied = $state(false);

	// "Copied" goes back to "Copy" on its own; the effect owns the timer so a second click restarts it
	$effect(() => {
		if (!copied) return;
		const timer = setTimeout(() => (copied = false), 1800);
		return () => clearTimeout(timer);
	});

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(sample.code);
			copied = true;
		} catch {
			// no clipboard access (insecure origin, denied permission): nothing was copied, so say nothing
		}
	};
</script>

<div
	class={[
		'code-block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800',
		className
	]}
>
	<div
		class="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 py-1 pr-1.5 pl-4 dark:border-gray-800 dark:bg-gray-900"
	>
		<span class="min-w-0 truncate font-mono text-xs text-gray-600 dark:text-gray-300">
			{#if sample.file}
				<span data-testid="code-file">{sample.file}</span>
				{#if sample.note}<span class="text-gray-500 dark:text-gray-400"> — {sample.note}</span>{/if}
			{/if}
		</span>
		<button
			type="button"
			class="grid shrink-0 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
			data-testid="code-copy"
			onclick={copy}
		>
			<!-- both labels sit in the same grid cell, so the button keeps the wider width either way -->
			<span class={['col-start-1 row-start-1', copied && 'invisible']} aria-hidden={copied}>
				{t('common:code.copy')}
			</span>
			<span class={['col-start-1 row-start-1', !copied && 'invisible']} aria-hidden={!copied}>
				{t('common:code.copied')}
			</span>
		</button>
		<span class="sr-only" role="status">{copied ? t('common:code.copied') : ''}</span>
	</div>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- our own snippet, highlighted server-side -->
	{@html sample.html}
</div>
