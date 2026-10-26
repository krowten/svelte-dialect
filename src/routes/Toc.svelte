<script lang="ts">
	import { t } from '#lib/i18n.js';

	const { items }: { items: { id: string; title: string }[] } = $props();
</script>

<nav
	aria-label={t('common:toc.title')}
	class="mt-6 rounded-xl border border-gray-200 px-5 py-4 dark:border-gray-800"
>
	<p class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
		{t('common:toc.title')}
	</p>
	<ul class="mt-2 columns-1 gap-8 text-sm sm:columns-2">
		{#each items as { id, title } (id)}
			<li class="py-0.5">
				<a class="text-gray-900 underline dark:text-gray-100" href="#{id}">{title}</a>
			</li>
		{/each}
	</ul>
</nav>
