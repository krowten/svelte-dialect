<script lang="ts">
	import type { PageProps } from './$types.js';

	import Callout from '../Callout.svelte';
	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import Toc from '../Toc.svelte';
	import { t, loadTranslations, locales } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	// Both patterns run live: billing is fetched in +page.ts, and dashboard is awaited right here,
	// which takes compilerOptions.experimental.async (on for this site).
	const { t: td } = await loadTranslations('dashboard');
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('sources:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('sources:lead')}</p>
<Toc
	items={[
		{ id: 'build', title: t('sources:build_title') },
		{ id: 'demand', title: t('sources:demand_title') },
		{ id: 'api', title: t('sources:api_title') },
		{ id: 'dedupe', title: t('sources:dedupe_title') }
	]}
/>

<section class="mt-10">
	<Heading level={2} id="build" text={t('sources:build_title')} />
	<CodeBlock class="mt-3" sample={data.buildCode} />
	<p class="mt-3 text-sm text-gray-600 dark:text-gray-300">{t('sources:build_eager_text')}</p>
	<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('sources:build_lazy_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="demand" text={t('sources:demand_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('sources:demand_lead')}</p>

	<div class="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
		<div class="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
			<Heading level={3} id="load" text={t('sources:load_title')} class="uppercase" />
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('sources:load_text')}</p>
			<p class="mt-4 font-medium" data-testid="load-title">{data.t('billing:title')}</p>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300" data-testid="load-intro">
				{data.t('billing:intro')}
			</p>
		</div>

		<div class="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
			<Heading level={3} id="component" text={t('sources:component_title')} class="uppercase" />
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('sources:component_text')}</p>
			<p class="mt-4 font-medium" data-testid="component-title">{td('dashboard:title')}</p>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300" data-testid="component-intro">
				{td('dashboard:intro')}
			</p>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400" data-testid="component-stats">
				{td('dashboard:stats', { count: locales.length })}
			</p>
			<Callout class="mt-3" tone="note" title={t('common:callout.note')}>
				{t('sources:component_note')}
			</Callout>
		</div>
	</div>

	<div class="mt-4 space-y-4">
		<CodeBlock sample={data.loadFnCode} />
		<CodeBlock sample={data.loadFnPageCode} />
		<CodeBlock sample={data.componentCode} />
	</div>
</section>

<section class="mt-10">
	<Heading level={2} id="api" text={t('sources:api_title')} />

	<Heading level={3} id="remote" text={t('sources:remote_title')} class="mt-4" />
	<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('sources:remote_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.remoteCode} />
		<CodeBlock sample={data.remoteDialectCode} />
	</div>

	<Heading level={3} id="fetch" text={t('sources:fetch_title')} class="mt-6" />
	<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('sources:fetch_text')}</p>
	<CodeBlock class="mt-3" sample={data.fetchCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="dedupe" text={t('sources:dedupe_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('sources:dedupe_text')}</p>
</section>
