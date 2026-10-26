<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import { t } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	const dueDate = new Date(Date.UTC(2026, 8, 30));
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('messages:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('messages:lead')}</p>

<section class="mt-10">
	<Heading level={2} id="layout" text={t('messages:layout_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('messages:layout_text')}</p>
	<CodeBlock class="mt-3" sample={data.layoutCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="params" text={t('messages:params_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('messages:params_text')}</p>
	<CodeBlock class="mt-3" sample={data.paramsCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="plurals" text={t('messages:plurals_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('messages:plurals_text')}</p>
	<CodeBlock class="mt-3" sample={data.pluralsCode} />
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400" data-testid="plural-demo">
		{t('messages:demo_items', { count: 1 })} · {t('messages:demo_items', { count: 3 })} · {t(
			'messages:demo_items',
			{ count: 5 }
		)}
	</p>
</section>

<section class="mt-10">
	<Heading level={2} id="numbers" text={t('messages:numbers_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('messages:numbers_text')}</p>
	<CodeBlock class="mt-3" sample={data.numbersCode} />
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400" data-testid="numbers-demo">
		{t('messages:demo_price', { amount: 1234.5 })} · {t('messages:demo_due', { when: dueDate })}
	</p>
</section>

<section class="mt-10">
	<Heading level={2} id="errors" text={t('messages:errors_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('messages:errors_text')}</p>
	<CodeBlock class="mt-3" sample={data.errorsCode} />
</section>
