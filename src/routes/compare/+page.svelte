<script lang="ts">
	import Heading from '../Heading.svelte';
	import Toc from '../Toc.svelte';
	import { t } from '#lib/i18n.js';
	import pkg from '../../../package.json' with { type: 'json' };

	// Message keys are `compare:t1_<id>_<column>` and `compare:t2_<id>_<column>`; the names stay
	// verbatim in every language. Below lg the table stacks each library into a card, like /api.
	const libs = [
		{ id: 'dialect', name: 'svelte-dialect' },
		{ id: 'svelte_i18n', name: 'svelte-i18n' },
		{ id: 'sveltia', name: 'Sveltia I18n' },
		{ id: 'sveltekit_i18n', name: 'sveltekit-i18n' },
		{ id: 'paraglide', name: 'Paraglide JS' },
		{ id: 'typesafe', name: 'typesafe-i18n' },
		{ id: 'wuchale', name: 'wuchale' }
	] as const;

	const sectionLibs = [...libs, { id: 'i18next', name: 'i18next' }] as const;

	const table1 = ['api', 'format', 'types', 'bundle'] as const;
	const table2 = ['server', 'lazy', 'rich', 'release'] as const;

	const sources = [
		{
			name: 'svelte-dialect',
			links: ['https://github.com/krowten/svelte-dialect#readme']
		},
		{
			name: 'svelte-i18n',
			links: [
				'https://github.com/kaisermann/svelte-i18n',
				'https://github.com/kaisermann/svelte-i18n/blob/main/docs/Svelte-Kit.md',
				'https://www.npmjs.com/package/svelte-i18n'
			]
		},
		{
			name: 'Sveltia I18n',
			links: [
				'https://github.com/sveltia/sveltia-i18n',
				'https://github.com/sveltia/sveltia-i18n/issues/2',
				'https://www.npmjs.com/package/@sveltia/i18n'
			]
		},
		{
			name: 'sveltekit-i18n',
			links: [
				'https://github.com/sveltekit-i18n/lib',
				'https://www.npmjs.com/package/sveltekit-i18n'
			]
		},
		{
			name: 'Paraglide JS',
			links: [
				'https://paraglidejs.com/sveltekit',
				'https://paraglidejs.com/basics',
				'https://paraglidejs.com/markup',
				'https://paraglidejs.com/comparison',
				'https://svelte.dev/docs/cli/sv-add',
				'https://github.com/opral/paraglide-js',
				'https://www.npmjs.com/package/@inlang/paraglide-js'
			]
		},
		{
			name: 'typesafe-i18n',
			links: [
				'https://github.com/codingcommons/typesafe-i18n',
				'https://github.com/codingcommons/typesafe-i18n/tree/main/packages/adapter-svelte',
				'https://www.npmjs.com/package/typesafe-i18n'
			]
		},
		{
			name: 'wuchale',
			links: [
				'https://wuchale.dev/intro/why/',
				'https://wuchale.dev/adapters/svelte/',
				'https://wuchale.dev/guides/urls/',
				'https://wuchale.dev/guides/loading/',
				'https://github.com/wuchalejs/wuchale',
				'https://www.npmjs.com/package/wuchale'
			]
		},
		{
			name: 'i18next',
			links: [
				'https://www.npmjs.com/package/i18next',
				'https://www.npmjs.com/package/svelte-i18next'
			]
		}
	];

	const table = 'mt-3 w-full border-collapse text-sm max-lg:block';
	const thead = 'border-b border-gray-200 max-lg:sr-only dark:border-gray-800';
	const th = 'py-2 pr-4 text-left font-medium text-gray-500 dark:text-gray-400';
	const tr = 'border-b border-gray-100 max-lg:block max-lg:py-3 dark:border-gray-900';
	const td =
		'py-2 pr-4 align-top text-gray-600 max-lg:block max-lg:p-0 max-lg:pt-1 dark:text-gray-300';
	const label = 'font-medium text-gray-500 lg:hidden dark:text-gray-400';
	const link = 'text-gray-900 underline dark:text-gray-100 break-all';
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('compare:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('compare:lead')}</p>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('compare:honest')}</p>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('compare:short')}</p>
<Toc
	items={[
		{ id: 'table1', title: t('compare:table1_title') },
		{ id: 'table2', title: t('compare:table2_title') },
		...sectionLibs.map((lib) => ({ id: lib.id.replaceAll('_', '-'), title: lib.name })),
		{ id: 'sources', title: t('compare:sources_title') }
	]}
/>

<section class="mt-10">
	<Heading level={2} id="table1" text={t('compare:table1_title')} />
	<table class={table} data-testid="compare-table-1">
		<thead class={thead}>
			<tr>
				<th class={th}>{t('compare:col_library')}</th>
				{#each table1 as col (col)}
					<th class={th}>{t(`compare:col_${col}`)}</th>
				{/each}
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each libs as lib (lib.id)}
				<tr class={tr}>
					<td class="{td} font-mono font-medium whitespace-nowrap text-gray-900 dark:text-gray-100"
						>{lib.name}</td
					>
					{#each table1 as col (col)}
						<td class={td}
							><span class={label}>{t(`compare:col_${col}`)}: </span>{t(
								`compare:t1_${lib.id}_${col}`
							)}</td
						>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<section class="mt-10">
	<Heading level={2} id="table2" text={t('compare:table2_title')} />
	<table class={table} data-testid="compare-table-2">
		<thead class={thead}>
			<tr>
				<th class={th}>{t('compare:col_library')}</th>
				{#each table2 as col (col)}
					<th class={th}>{t(`compare:col_${col}`)}</th>
				{/each}
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each libs as lib (lib.id)}
				<tr class={tr}>
					<td class="{td} font-mono font-medium whitespace-nowrap text-gray-900 dark:text-gray-100"
						>{lib.name}</td
					>
					{#each table2 as col (col)}
						<td class={td}
							><span class={label}>{t(`compare:col_${col}`)}: </span>{t(
								`compare:t2_${lib.id}_${col}`,
								// only the release cell has a placeholder; the others ignore it
								{ version: pkg.version }
							)}</td
						>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</section>

{#each sectionLibs as lib (lib.id)}
	<section class="mt-10">
		<Heading level={2} id={lib.id.replaceAll('_', '-')} text={lib.name} class="font-mono" />
		<p class="mt-2 text-gray-600 dark:text-gray-300">{t(`compare:${lib.id}_about`)}</p>
		<p class="mt-2 text-gray-600 dark:text-gray-300">{t(`compare:${lib.id}_pick`)}</p>
		{#if lib.id !== 'i18next'}
			<p class="mt-2 text-gray-600 dark:text-gray-300">{t(`compare:${lib.id}_skip`)}</p>
		{/if}
	</section>
{/each}

<section class="mt-10">
	<Heading level={2} id="sources" text={t('compare:sources_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('compare:sources_text')}</p>
	<ul class="mt-3 space-y-2 text-sm" data-testid="compare-sources">
		{#each sources as source (source.name)}
			<li class="text-gray-600 dark:text-gray-300">
				<span class="font-mono">{source.name}</span>:
				{#each source.links as href, i (href)}
					{#if i > 0},
					{/if}<a class={link} {href} rel="noopener"
						>{href.replace('https://', '').replace(/\/$/, '')}</a
					>
				{/each}
			</li>
		{/each}
	</ul>
</section>
