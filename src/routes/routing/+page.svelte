<script lang="ts">
	import type { PageProps } from './$types.js';

	import Callout from '../Callout.svelte';
	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import Toc from '../Toc.svelte';
	import { page } from '$app/state';
	import { t, locales, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('routing:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('routing:lead')}</p>
<Toc
	items={[
		{ id: 'prefix', title: t('routing:prefix_title') },
		{ id: 'wiring', title: t('routing:wiring_title') },
		{ id: 'base', title: t('routing:base_title') },
		{ id: 'linking', title: t('routing:linking_title') },
		{ id: 'prerender', title: t('routing:prerender_title') },
		{ id: 'meaning', title: t('routing:meaning_title') }
	]}
/>

<section class="mt-10">
	<Heading level={2} id="prefix" text={t('routing:prefix_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:prefix_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="wiring" text={t('routing:wiring_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:wiring_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.wiringCode} />
		<CodeBlock sample={data.rerouteCode} />
	</div>
	<Callout class="mt-3" tone="note" title={t('common:callout.note')}
		>{t('routing:url_text')}</Callout
	>
</section>

<section class="mt-10">
	<Heading level={2} id="base" text={t('routing:base_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:base_text')}</p>
	<CodeBlock class="mt-3" sample={data.baseCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="linking" text={t('routing:linking_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:linking_text')}</p>
	<CodeBlock class="mt-3" sample={data.linkingCode} />

	<Heading level={3} id="switch" text={t('routing:switch_title')} class="mt-6" />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:switch_text')}</p>

	<Heading level={3} id="try" text={t('routing:try_title')} class="mt-6" />
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('routing:try_text')}</p>
	<div class="mt-2 flex gap-3" data-testid="routing-try-links">
		{#each locales as locale (locale)}
			<a
				class="rounded-md border border-gray-200 px-3 py-1 text-sm hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
				href={localizeHref(page.url.pathname, locale)}
				data-testid="routing-try-link-{locale}"
			>
				{locale}
			</a>
		{/each}
	</div>
</section>

<section class="mt-10">
	<Heading level={2} id="prerender" text={t('routing:prerender_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:prerender_text')}</p>
	<CodeBlock class="mt-3" sample={data.prerenderCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="meaning" text={t('routing:meaning_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('routing:meaning_text')}</p>
</section>
