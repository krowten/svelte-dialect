<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import { t } from '#lib/i18n.js';

	const { data }: PageProps = $props();
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('strategy:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('strategy:lead')}</p>

<section class="mt-10">
	<Heading level={2} id="default" text={t('strategy:default_title')} />
	<CodeBlock class="mt-3" sample={data.defaultCode} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('strategy:default_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="custom" text={t('strategy:custom_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('strategy:custom_text')}</p>
	<CodeBlock class="mt-3" sample={data.customCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="vary" text={t('strategy:vary_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('strategy:vary_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="isolation" text={t('strategy:isolation_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('strategy:isolation_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="configure" text={t('strategy:configure_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('strategy:configure_text')}</p>
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('strategy:configure_when_text')}</p>
	<div class="mt-3 space-y-4">
		<CodeBlock sample={data.configureServerCode} />
		<CodeBlock sample={data.configureClientCode} />
	</div>
	<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('strategy:configure_caveat_text')}</p>
</section>
