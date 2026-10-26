<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import Toc from '../Toc.svelte';
	import { table, thead, th, tr, td, code } from '../table.js';
	import { Rich } from '#lib/index.js';
	import { t, formatParts, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	const linkClass = 'text-gray-900 underline dark:text-gray-100';
	const p = 'mt-2 text-gray-600 dark:text-gray-300';
	const row = 'scroll-mt-4 target:bg-amber-50 dark:target:bg-amber-950/40';

	const commands = [
		{ name: 'typegen', sample: 'typegenCode' },
		{ name: 'check', sample: 'checkCode' },
		{ name: 'migrate', sample: 'migrateCode' }
	] as const;
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('cli:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('cli:lead')}</p>
<Toc
	items={[
		{ id: 'usage', title: t('cli:usage_title') },
		{ id: 'typegen', title: 'typegen' },
		{ id: 'check', title: 'check' },
		{ id: 'migrate', title: 'migrate' }
	]}
/>

<section class="mt-10">
	<Heading level={2} id="usage" text={t('cli:usage_title')} />
	<p class={p}>{t('cli:usage_text')}</p>
	<CodeBlock class="mt-3" sample={data.usageCode} />
</section>

{#each commands as { name, sample } (name)}
	{const spec = $derived(data.commands[name])}
	<section class="mt-10">
		<Heading level={2} id={name} text={name} class="font-mono" />
		<p class={p}>
			{#if name === 'typegen'}
				<Rich parts={formatParts('cli:typegen_lead')}>
					{#snippet typed(children)}<a class={linkClass} href={localizeHref('/typed-keys')}
							>{@render children()}</a
						>{/snippet}
				</Rich>
			{:else if name === 'check'}
				{t('cli:check_lead')}
			{:else}
				<Rich parts={formatParts('cli:migrate_lead')}>
					{#snippet guide(children)}<a class={linkClass} href={localizeHref('/migrate')}
							>{@render children()}</a
						>{/snippet}
				</Rich>
			{/if}
		</p>
		<CodeBlock class="mt-3" sample={data[sample]} />
		{#if name === 'check'}
			<p class={p}>{t('cli:check_note')}</p>
		{:else if name === 'migrate'}
			<p class={p}>{t('cli:migrate_note')}</p>
		{/if}

		<Heading level={3} id="{name}-flags" text={t('cli:flags_title')} class="mt-6" />
		<table class={table}>
			<thead>
				<tr class={thead}>
					<th class={th}>{t('cli:col_flag')}</th>
					<th class={th}>{t('cli:col_default')}</th>
					<th class={th}>{t('cli:col_description')}</th>
				</tr>
			</thead>
			<tbody class="max-lg:block">
				{#each spec.flags as flag (flag.id)}
					<tr id="{name}-{flag.id.replaceAll('_', '-')}" class="{tr} {row}">
						<td class="{td} font-mono whitespace-nowrap">
							<a class="hover:underline" href="#{name}-{flag.id.replaceAll('_', '-')}"
								>{flag.flag}</a
							>
						</td>
						<td class="{td} {code} text-gray-500 dark:text-gray-400">{flag.default}</td>
						<td class="{td} text-gray-600 max-lg:mt-1 dark:text-gray-300"
							>{t(`cli:${name}_flag_${flag.id}`)}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>

		<Heading level={3} id="{name}-exit" text={t('cli:exit_title')} class="mt-6" />
		<table class={table}>
			<thead>
				<tr class={thead}>
					<th class={th}>{t('cli:col_code')}</th>
					<th class={th}>{t('cli:col_when')}</th>
				</tr>
			</thead>
			<tbody class="max-lg:block">
				{#each spec.exits as exit (exit.id)}
					<tr class={tr}>
						<td class="{td} {code} w-16">{exit.code}</td>
						<td class="{td} text-gray-600 max-lg:mt-1 dark:text-gray-300"
							>{t(`cli:${name}_exit_${exit.id}`)}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/each}
