<script lang="ts">
	import type { PageProps } from './$types.js';

	import Heading from '../Heading.svelte';
	import Toc from '../Toc.svelte';
	import { table, thead, th, tr, td, code } from '../table.js';
	import { t } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	// every row is an anchor target; the name links to itself so the address is easy to copy
	const rowLink = 'hover:underline';
	const row = 'scroll-mt-4 target:bg-amber-50 dark:target:bg-amber-950/40';
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('api:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('api:lead')}</p>
<Toc
	items={[
		{ id: 'package', title: t('api:package_title') },
		{ id: 'exports', title: t('api:exports_title') },
		{ id: 'options', title: t('api:options_title') }
	]}
/>

<section class="mt-10">
	<Heading level={2} id="package" text={t('api:package_title')} />
	<table class={table}>
		<thead>
			<tr class={thead}>
				<th class={th}>{t('api:col_export')}</th>
				<th class={th}>{t('api:col_signature')}</th>
				<th class={th}>{t('api:col_description')}</th>
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each data.packageExports as item (item.id)}
				<tr id={item.id} class="{tr} {row}">
					<td class="{td} font-mono">
						<a class={rowLink} href="#{item.id}">{item.name}</a>
						<span class="block text-xs text-gray-500 dark:text-gray-400">{item.from}</span>
					</td>
					<td class="{td} {code} text-gray-500 dark:text-gray-400">{item.signature}</td>
					<td class="{td} text-gray-600 max-lg:mt-1 dark:text-gray-300"
						>{t(`api:row_${item.key}`)}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="mt-10">
	<Heading level={2} id="exports" text={t('api:exports_title')} />
	<table class={table}>
		<thead>
			<tr class={thead}>
				<th class={th}>{t('api:col_export')}</th>
				<th class={th}>{t('api:col_signature')}</th>
				<th class={th}>{t('api:col_description')}</th>
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each data.exports as item (item.name)}
				<tr id={item.name} class="{tr} {row}">
					<td class="{td} font-mono"><a class={rowLink} href="#{item.name}">{item.name}</a></td>
					<td class="{td} {code} text-gray-500 dark:text-gray-400">{item.signature}</td>
					<td class="{td} text-gray-600 max-lg:mt-1 dark:text-gray-300"
						>{t(`api:row_${item.name}`)}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="mt-10">
	<Heading level={2} id="options" text={t('api:options_title')} />
	<table class={table}>
		<thead>
			<tr class={thead}>
				<th class={th}>{t('api:col_option')}</th>
				<th class={th}>{t('api:col_default')}</th>
				<th class={th}>{t('api:col_description')}</th>
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each data.options as item (item.name)}
				<tr id="opt-{item.name}" class="{tr} {row}">
					<td class="{td} font-mono"><a class={rowLink} href="#opt-{item.name}">{item.name}</a></td>
					<td class="{td} {code} text-gray-500 dark:text-gray-400">{item.default}</td>
					<td class="{td} text-gray-600 max-lg:mt-1 dark:text-gray-300"
						>{t(`api:row_opt_${item.name}`)}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
</section>
