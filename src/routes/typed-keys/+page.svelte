<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import { Rich } from '#lib/index.js';
	import { t, formatParts, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('typed-keys:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('typed-keys:lead')}</p>

<section class="mt-10">
	<Heading level={2} id="generate" text={t('typed-keys:generate_title')} />
	<CodeBlock class="mt-3" sample={data.generateCode} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('typed-keys:generate_text')}</p>
	<CodeBlock class="mt-3" sample={data.keysCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="params" text={t('typed-keys:params_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('typed-keys:params_text')}</p>
	<CodeBlock class="mt-3" sample={data.paramsCode} />
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('typed-keys:params_note')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="snapshot" text={t('typed-keys:snapshot_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('typed-keys:snapshot_text')}</p>
	<CodeBlock class="mt-3" sample={data.snapshotCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="cli" text={t('typed-keys:cli_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">
		<Rich parts={formatParts('typed-keys:cli_lead')}>
			{#snippet cli(children)}<a
					class="text-gray-900 underline dark:text-gray-100"
					href={localizeHref('/cli')}>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
	<CodeBlock class="mt-3" sample={data.cliCode} />

	<Heading level={3} id="check" text={t('typed-keys:check_title')} class="mt-6" />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('typed-keys:check_text')}</p>

	<Heading level={3} id="migrate" text={t('typed-keys:migrate_title')} class="mt-6" />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('typed-keys:migrate_text')}</p>
</section>
