<script lang="ts">
	import type { PageProps } from './$types.js';

	import CodeBlock from './CodeBlock.svelte';
	import Heading from './Heading.svelte';
	import { Rich } from '#lib/index.js';
	import { t, formatParts, localizeHref } from '#lib/i18n.js';

	const { data }: PageProps = $props();

	let name = $state('Svelte');
	let count = $state(0);

	const card = 'rounded-xl border border-gray-200 p-5 dark:border-gray-800';

	// structured data for search engines; `<` is escaped so no message text can close the script tag,
	// and the closing tag is split so it doesn't end this component's own <script>
	const jsonLd = $derived(
		'<script type="application/ld+json">' +
			JSON.stringify({
				'@context': 'https://schema.org',
				'@type': 'SoftwareSourceCode',
				name: 'svelte-dialect',
				description: t('meta:home.description'),
				codeRepository: 'https://github.com/krowten/svelte-dialect',
				programmingLanguage: 'TypeScript',
				runtimePlatform: 'Svelte 5, SvelteKit',
				license: 'https://opensource.org/licenses/MIT'
			}).replaceAll('<', '\\u003c') +
			'</' +
			'script>'
	);
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static JSON, `<` escaped above -->
	{@html jsonLd}
</svelte:head>

<h1 class="text-4xl font-bold tracking-tight" data-testid="title">{t('home:title')}</h1>
<p class="mt-3 text-lg text-gray-600 dark:text-gray-300" data-testid="tagline">
	{t('home:tagline')}
</p>
<div class="mt-6 flex flex-wrap gap-3">
	<a
		class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
		href={localizeHref('/setup')}
		data-testid="cta-setup">{t('home:cta_setup')}</a
	>
	<a
		class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:border-gray-500 dark:border-gray-700 dark:hover:border-gray-500"
		href={localizeHref('/api')}
		data-testid="cta-api">{t('home:cta_api')}</a
	>
</div>
<p class="mt-6 text-gray-500 dark:text-gray-400">{t('home:lead')}</p>
<!-- MF2 markup rendered through snippets: the link and the emphasis live in the translation -->
<p class="mt-2 text-gray-500 dark:text-gray-400" data-testid="rich">
	<Rich parts={formatParts('home:rich')}>
		{#snippet mf2(children)}<em
				><a
					class="text-gray-900 underline dark:text-gray-100"
					href="https://messageformat.unicode.org/"
					target="_blank"
					rel="noopener noreferrer"
					>{@render children()}<span class="sr-only"> {t('common:new_tab')}</span></a
				></em
			>{/snippet}
		{#snippet link(children)}<a
				class="text-gray-900 underline dark:text-gray-100"
				href={localizeHref('/rich-text')}>{@render children()}</a
			>{/snippet}
	</Rich>
</p>

<section class="mt-12">
	<Heading level={2} id="quickstart" text={t('home:quickstart_title')} />
	<p class="mt-2 text-gray-600 dark:text-gray-300">{t('home:quickstart_lead')}</p>
	<div class="mt-4 space-y-4">
		<CodeBlock sample={data.i18nCode} />
		<CodeBlock sample={data.hooksServerCode} />
		<CodeBlock sample={data.hooksCode} />
	</div>
	<a
		class="mt-4 inline-block font-medium text-gray-900 underline dark:text-gray-100"
		href={localizeHref('/setup')}>{t('home:quickstart_more')} →</a
	>
</section>

<section class="mt-12">
	<Heading level={2} id="try" text={t('home:try_title')} />

	<div class="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
		<div class={card}>
			<label class="block text-sm text-gray-600 dark:text-gray-300">
				{t('home:name_label')}
				<input
					class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900"
					bind:value={name}
				/>
			</label>
			<p class="mt-3 text-lg" data-testid="greeting">{t('home:greeting', { name })}</p>
		</div>

		<div class={card}>
			<button
				class="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
				data-testid="counter-button"
				onclick={() => count++}
			>
				{t('home:click')}
			</button>
			<p class="mt-3 text-lg" data-testid="counter">{t('home:counter', { count })}</p>
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('home:counter_hint')}</p>
		</div>
	</div>
</section>

<section class="mt-12">
	<Heading level={2} id="browse" text={t('home:browse_title')} />

	<div class="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
		<a
			class="{card} block hover:border-gray-400 dark:hover:border-gray-600"
			href={localizeHref('/setup')}
		>
			<h3 class="font-medium">{t('home:card_setup_title')}</h3>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('home:card_setup_text')}</p>
			<span class="mt-2 inline-block text-sm text-gray-900 underline dark:text-gray-100"
				>{t('home:open')}</span
			>
		</a>

		<a
			class="{card} block hover:border-gray-400 dark:hover:border-gray-600"
			href={localizeHref('/messages')}
		>
			<h3 class="font-medium">{t('home:card_messages_title')}</h3>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('home:card_messages_text')}</p>
			<span class="mt-2 inline-block text-sm text-gray-900 underline dark:text-gray-100"
				>{t('home:open')}</span
			>
		</a>

		<a
			class="{card} block hover:border-gray-400 dark:hover:border-gray-600"
			href={localizeHref('/routing')}
		>
			<h3 class="font-medium">{t('home:card_routing_title')}</h3>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('home:card_routing_text')}</p>
			<span class="mt-2 inline-block text-sm text-gray-900 underline dark:text-gray-100"
				>{t('home:open')}</span
			>
		</a>
	</div>
</section>
