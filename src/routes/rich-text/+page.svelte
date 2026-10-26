<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from '../CodeBlock.svelte';
	import Heading from '../Heading.svelte';
	import { Rich } from '#lib/index.js';
	import { t, formatParts, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	// A markup option comes from the translation, so it is input like any other: only a path on
	// this site becomes an href, never `javascript:` or another origin.
	const internal = (to: unknown) => {
		const path = String(to);
		return /^\/(?![/\\])/.test(path) ? localizeHref(path) : undefined;
	};
</script>

<h1 class="text-3xl font-bold tracking-tight">{t('rich-text:title')}</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">{t('rich-text:lead')}</p>

<section class="mt-10">
	<Heading level={2} id="demo" text={t('rich-text:demo_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('rich-text:demo_text')}</p>
	<p class="mt-3 text-lg" data-testid="rich-cta">
		<Rich parts={formatParts('rich-text:cta')}>
			{#snippet link(children, options)}<a
					class="text-gray-900 underline dark:text-gray-100"
					href={internal(options.to)}>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
	<CodeBlock class="mt-3" sample={data.messageCode} />
	<CodeBlock class="mt-3" sample={data.componentCode} />
</section>

<section class="mt-10">
	<Heading level={2} id="options" text={t('rich-text:options_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('rich-text:options_text')}</p>
	<p class="mt-3 text-lg" data-testid="rich-nested">
		<Rich parts={formatParts('rich-text:nested')}>
			{#snippet b(children)}<strong>{@render children()}</strong>{/snippet}
			{#snippet link(children, options)}<a
					class="text-gray-900 underline dark:text-gray-100"
					href={internal(options.to)}>{@render children()}</a
				>{/snippet}
		</Rich>
	</p>
</section>

<section class="mt-10">
	<Heading level={2} id="fallback" text={t('rich-text:fallback_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('rich-text:fallback_text')}</p>
	<p class="mt-3 text-lg" data-testid="rich-unwired">
		<Rich parts={formatParts('rich-text:unwired')} />
	</p>
</section>

<section class="mt-10">
	<Heading level={2} id="parts" text={t('rich-text:parts_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('rich-text:parts_text')}</p>
</section>

<section class="mt-10">
	<Heading level={2} id="names" text={t('rich-text:names_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('rich-text:names_text')}</p>
</section>
