<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import Toc from '../Toc.svelte';
	import { table, thead, th, tr, td, code } from '../table.js';
	import { Rich } from '#lib/index.js';
	import { t, formatParts, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	const note = 'text-gray-600 max-lg:mt-1 dark:text-gray-300';
	const linkClass = 'text-gray-900 underline dark:text-gray-100';
	const p = 'mt-2 text-gray-600 dark:text-gray-300';
</script>

{#snippet mapping(
	rows: readonly { id: string; from: string; to: string | null }[],
	prefix: string,
	fromCol: string,
	toCol: string
)}
	<table class={table}>
		<thead>
			<tr class={thead}>
				<th class={th}>{fromCol}</th>
				<th class={th}>{toCol}</th>
				<th class={th}>{t('migrate:col_note')}</th>
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each rows as row (row.id)}
				<tr class={tr}>
					<td class="{td} {code}">{row.from}</td>
					<td class="{td} {code} text-gray-500 dark:text-gray-400">{row.to ?? t('migrate:none')}</td
					>
					<td class="{td} {note}">{t(`migrate:${prefix}${row.id}`)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<h1 class="text-3xl font-bold tracking-tight">{t('migrate:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('migrate:lead')}</p>
<Toc
	items={[
		{ id: 'who', title: t('migrate:who_title') },
		{ id: 'install', title: `1. ${t('migrate:install_title')}` },
		{ id: 'run', title: `2. ${t('migrate:run_title')}` },
		{ id: 'fix', title: `3. ${t('migrate:fix_title')}` },
		{ id: 'api', title: `4. ${t('migrate:api_title')}` },
		{ id: 'verify', title: `5. ${t('migrate:verify_title')}` },
		{ id: 'next', title: t('migrate:next_title') }
	]}
/>

<section class="mt-10">
	<Heading level={2} id="who" text={t('migrate:who_title')} />
	<p class={p}>{t('migrate:who_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="install" text={`1. ${t('migrate:install_title')}`} />
	<p class={p}>{t('migrate:install_text')}</p>
	<CodeBlock class="mt-3" sample={data.installCode} />

	<Heading level={3} id="layout" text={t('migrate:layout_title')} class="mt-6" />
	<p class={p}>{t('migrate:layout_text')}</p>
	<CodeBlock class="mt-3" sample={data.layoutCode} />
	<p class={p}>{t('migrate:layout_flat')}</p>
	<CodeBlock class="mt-3" sample={data.flatRunCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="run" text={`2. ${t('migrate:run_title')}`} />
	<p class={p}>{t('migrate:run_text')}</p>
	<CodeBlock class="mt-3" sample={data.dryRunCode} />
	<p class={p}>
		<Rich parts={formatParts('migrate:run_flags')}>
			{#snippet cli(children)}<a class={linkClass} href={localizeHref('/cli')}
					>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
	<p class={p}>{t('migrate:run_safe')}</p>

	<Heading level={3} id="icu" text={t('migrate:icu_title')} class="mt-6" />
	<p class={p}>{t('migrate:icu_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.icuBeforeCode} />
		<CodeBlock sample={data.icuRunCode} />
	</div>
	<p class={p}>{t('migrate:icu_result')}</p>

	<Heading level={3} id="i18next" text={t('migrate:i18next_title')} class="mt-6" />
	<p class={p}>{t('migrate:i18next_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.i18nextBeforeCode} />
		<CodeBlock sample={data.i18nextBeforeRuCode} />
		<CodeBlock sample={data.i18nextRunCode} />
	</div>
	<p class={p}>{t('migrate:i18next_result')}</p>

	<Heading level={3} id="table" text={t('migrate:table_title')} class="mt-6" />
	<p class={p}>{t('migrate:table_text')}</p>
	{@render mapping(data.constructs, 'row_', t('migrate:col_before'), t('migrate:col_after'))}
</section>

<section class="mt-10">
	<Heading level={2} id="fix" text={`3. ${t('migrate:fix_title')}`} />
	<p class={p}>{t('migrate:fix_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.hardBeforeCode} />
		<CodeBlock sample={data.hardRunCode} />
	</div>
	<p class={p}>{t('migrate:fix_table_text')}</p>
	<table class={table}>
		<thead>
			<tr class={thead}>
				<th class={th}>{t('migrate:col_warning')}</th>
				<th class={th}>{t('migrate:col_fix')}</th>
			</tr>
		</thead>
		<tbody class="max-lg:block">
			{#each data.warnings as row (row.id)}
				<tr class={tr}>
					<td class="{td} {code}">{row.signal}</td>
					<td class="{td} {note}">{t(`migrate:warn_${row.id}`)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<Heading level={3} id="hand" text={t('migrate:hand_title')} class="mt-6" />
	<p class={p}>{t('migrate:hand_context')}</p>
	<CodeBlock class="mt-3" sample={data.contextCode} />
	<p class={p}>{t('migrate:hand_nesting')}</p>
	<CodeBlock class="mt-3" sample={data.nestingCode} />
	<p class={p}>
		<Rich parts={formatParts('migrate:hand_html')}>
			{#snippet rich(children)}<a class={linkClass} href={localizeHref('/rich-text')}
					>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>

	<Heading level={3} id="strict" text={t('migrate:strict_title')} class="mt-6" />
	<p class={p}>{t('migrate:strict_text')}</p>
	<CodeBlock class="mt-3" sample={data.strictRunCode} />
	<p class={p}>{t('migrate:strict_after')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="api" text={`4. ${t('migrate:api_title')}`} />
	<p class={p}>{t('migrate:api_text')}</p>
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('migrate:keys_note')}</p>

	<Heading level={3} id="si" text={t('migrate:si_title')} class="mt-6" />
	<p class={p}>{t('migrate:si_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.siModuleBeforeCode} />
		<CodeBlock sample={data.siModuleAfterCode} />
	</div>
	<p class={p}>
		<Rich parts={formatParts('migrate:si_hooks')}>
			{#snippet setup(children)}<a class={linkClass} href={localizeHref('/setup')}
					>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
	<p class={p}>{t('migrate:si_component_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.siComponentBeforeCode} />
		<CodeBlock sample={data.siComponentAfterCode} />
	</div>
	<p class={p}>{t('migrate:si_table_text')}</p>
	{@render mapping(data.siRows, 'si_row_', 'svelte-i18n', 'svelte-dialect')}

	<Heading level={3} id="i18next-api" text={t('migrate:i18next_api_title')} class="mt-6" />
	<p class={p}>{t('migrate:i18next_api_text')}</p>
	{@render mapping(data.i18nextRows, 'i18next_row_', 'i18next', 'svelte-dialect')}
</section>

<section class="mt-10">
	<Heading level={2} id="verify" text={`5. ${t('migrate:verify_title')}`} />
	<p class={p}>{t('migrate:verify_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.verifyCode} />
		<CodeBlock sample={data.paramsCode} />
	</div>
	<p class={p}>
		<Rich parts={formatParts('migrate:verify_after')}>
			{#snippet typed(children)}<a class={linkClass} href={localizeHref('/typed-keys')}
					>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
</section>

<section class="mt-10">
	<Heading level={2} id="next" text={t('migrate:next_title')} />
	<p class={p}>
		<Rich parts={formatParts('migrate:next_text')}>
			{#snippet messages(children)}<a class={linkClass} href={localizeHref('/messages')}
					>{@render children()}</a
				>{/snippet}
			{#snippet sources(children)}<a class={linkClass} href={localizeHref('/sources')}
					>{@render children()}</a
				>{/snippet}
			{#snippet routing(children)}<a class={linkClass} href={localizeHref('/routing')}
					>{@render children()}</a
				>{/snippet}
			{#snippet compare(children)}<a class={linkClass} href={localizeHref('/compare')}
					>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
</section>
