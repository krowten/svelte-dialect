<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import { Rich } from '#lib/index.js';
	import { t, formatParts, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	const steps = $derived([
		{ key: 'messages', sample: data.messagesCode },
		{ key: 'dialect', sample: data.dialectCode },
		{ key: 'handle', sample: data.handleCode },
		{ key: 'reroute', sample: data.rerouteCode },
		{ key: 'apphtml', sample: data.apphtmlCode },
		{ key: 'use', sample: data.useCode }
	] as const);

	// what `npx sv add svelte-dialect` does, one list item each: `setup:cli_<key>`
	const cliSteps = ['deps', 'dialect', 'messages', 'hooks', 'html'] as const;

	const linkClass = 'text-gray-900 underline dark:text-gray-100';
	const text = 'mt-4 text-gray-600 dark:text-gray-300';
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('setup:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('setup:lead')}</p>

<section class="mt-10">
	<Heading level={2} id="cli" text={t('setup:cli_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('setup:cli_lead')}</p>
	<CodeBlock class="mt-3" sample={data.svAddCode} />
	<p class={text}>{t('setup:cli_then')}</p>
	<ul class="mt-2 list-disc space-y-1 pl-5 text-gray-600 dark:text-gray-300">
		{#each cliSteps as key (key)}
			<li>{t(`setup:cli_${key}`)}</li>
		{/each}
	</ul>
	<p class={text}>{t('setup:cli_skip')}</p>
	<CodeBlock class="mt-3" sample={data.svAddArgsCode} />
	<p class={text}>{t('setup:cli_manual')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="install" text={t('setup:install_title')} />
	<CodeBlock class="mt-3" sample={data.installCode} />
	<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('setup:requires_text')}</p>
</section>

{#each steps as { key, sample }, i (key)}
	<section class="mt-10">
		<Heading level={2} id={key} text={`${i + 1}. ${t(`setup:${key}_title`)}`} />
		<p class="mt-2 text-gray-600 dark:text-gray-300">{t(`setup:${key}_text`)}</p>
		<CodeBlock class="mt-3" {sample} />
	</section>
{/each}

<section class="mt-10">
	<Heading level={2} id="next" text={t('setup:next_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">
		<Rich parts={formatParts('setup:next_text')}>
			{#snippet messages(children)}<a class={linkClass} href={localizeHref('/messages')}
					>{@render children()}</a
				>{/snippet}
			{#snippet routing(children)}<a class={linkClass} href={localizeHref('/routing')}
					>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
</section>
