<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { t, getLocale, setLocale, locales, localizeHref } from '#lib/i18n.js';
	import { NAV } from './nav.js';
	import { absoluteUrl } from './seo.js';
	import pkg from '../../package.json' with { type: 'json' };

	const { children } = $props();

	let mobileOpen = $state(false);
	let opener = $state<HTMLButtonElement>();

	// the drawer only exists below md; widening the window with it open must not leave the page inert
	const desktop = new MediaQuery('min-width: 48rem');
	const drawer = $derived(mobileOpen && !desktop.current);

	// the header is still inert until the DOM catches up, and an inert button can't take focus
	const closeDrawer = async () => {
		mobileOpen = false;
		await tick();
		opener?.focus();
	};

	$effect(() => {
		if (!drawer) return;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	});

	// the route id, not the URL: it is already free of both the base path and the locale prefix,
	// on the server and the client alike
	const routeId = $derived(page.route.id);

	// title and description per page, from the `meta` namespace; the error page has no route id
	const META: Record<string, string> = {
		'/': 'home',
		'/setup': 'setup',
		'/messages': 'messages',
		'/sources': 'sources',
		'/routing': 'routing',
		'/strategy': 'strategy',
		'/rich-text': 'rich',
		'/typed-keys': 'typed',
		'/api': 'api',
		'/cli': 'cli',
		'/migrate': 'migrate',
		'/compare': 'compare'
	};
	const meta = $derived(routeId ? META[routeId] : undefined);
	const OG_LOCALE: Record<string, string> = { en: 'en_US', ru: 'ru_RU', de: 'de_DE' };
	// absolute: canonical and hreflang must be. Prerendering sees `paths.origin` as the origin.
	const urlFor = (locale: string) => absoluteUrl(page.url.origin, routeId ?? '/', locale);

	// each language in its own name ("Deutsch", not "German"), so a visitor finds theirs whatever
	// the page is currently in
	const languageName = (locale: string) => {
		const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
		return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
	};

	type NavItem = (typeof NAV)[number]['items'][number];
	const flat = NAV.flatMap((g): readonly NavItem[] => g.items);
	const current = $derived(flat.findIndex((item) => item.path === routeId));
	const prev = $derived(current > 0 ? flat[current - 1] : undefined);
	const next = $derived(current === -1 ? flat[0] : flat[current + 1]);
	const pager = $derived([
		...(prev ? [{ ...prev, dir: 'prev' as const }] : []),
		...(next ? [{ ...next, dir: 'next' as const }] : [])
	]);

	const linkClass =
		'block rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 aria-[current=page]:bg-gray-900 aria-[current=page]:font-medium aria-[current=page]:text-white dark:text-gray-300 dark:hover:bg-gray-800 dark:aria-[current=page]:bg-gray-100 dark:aria-[current=page]:text-gray-900';
	const pagerClass =
		'block rounded-xl border border-gray-200 px-4 py-3 hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600';
</script>

<svelte:head>
	{#if meta}
		{const title = $derived(t(`meta:${meta}.title`))}
		{const description = $derived(t(`meta:${meta}.description`))}
		<title>{title}</title>
		<meta name="description" content={description} />
		<link rel="canonical" href={urlFor(getLocale())} />
		<!-- every language version, including this one, plus x-default for everyone else -->
		{#each locales as locale (locale)}
			<link rel="alternate" hreflang={locale} href={urlFor(locale)} />
		{/each}
		<link rel="alternate" hreflang="x-default" href={urlFor('en')} />
		<meta property="og:title" content={title} />
		<meta property="og:description" content={description} />
		<meta property="og:url" content={urlFor(getLocale())} />
		<meta property="og:locale" content={OG_LOCALE[getLocale()]} />
		{#each locales.filter((locale) => locale !== getLocale()) as locale (locale)}
			<meta property="og:locale:alternate" content={OG_LOCALE[locale]} />
		{/each}
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="svelte-dialect" />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && drawer) closeDrawer();
	}}
/>

<a
	href="#content"
	class="sr-only rounded-md bg-gray-900 px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-40 dark:bg-gray-100 dark:text-gray-900"
>
	{t('common:nav.skip')}
</a>

<div class="border-b border-gray-200 dark:border-gray-800" inert={drawer}>
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
		<div class="flex items-center gap-3">
			<button
				bind:this={opener}
				class="-ml-2 rounded-md p-2.5 text-gray-500 hover:bg-gray-100 md:hidden dark:hover:bg-gray-800"
				aria-label={t('common:nav.toggle')}
				aria-controls="sidebar"
				aria-expanded={mobileOpen}
				onclick={() => (mobileOpen = !mobileOpen)}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					class="size-5"
				>
					<path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<a href={localizeHref('/')} class="text-lg font-semibold tracking-tight">svelte-dialect</a>
		</div>

		<div class="flex items-center gap-3">
			<label class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
				<span class="sr-only sm:not-sr-only">{t('common:nav.language')}</span>
				<select
					data-testid="locale-switcher"
					class="rounded-md border-gray-300 py-1.5 pr-8 pl-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
					value={getLocale()}
					onchange={(e) => setLocale(e.currentTarget.value)}
				>
					{#each locales as locale (locale)}
						<option value={locale} lang={locale}>{languageName(locale)}</option>
					{/each}
				</select>
			</label>
			<a
				class="hidden text-sm text-gray-500 hover:text-gray-900 sm:inline dark:text-gray-400 dark:hover:text-gray-100"
				href="https://github.com/krowten/svelte-dialect/blob/main/CHANGELOG.md"
				title={t('common:nav.changelog')}
			>
				v{pkg.version}
			</a>
			<a
				class="hidden text-sm text-gray-500 hover:text-gray-900 sm:inline dark:text-gray-400 dark:hover:text-gray-100"
				href="https://github.com/krowten/svelte-dialect"
			>
				{t('common:nav.github')}
			</a>
		</div>
	</div>
</div>

{#if drawer}
	<button
		class="fixed inset-0 z-10 bg-gray-950/40 md:hidden"
		tabindex="-1"
		aria-hidden="true"
		onclick={closeDrawer}
	></button>
{/if}

<div class="mx-auto flex max-w-6xl gap-8 px-4 sm:px-6">
	<aside
		id="sidebar"
		class={[
			mobileOpen ? 'fixed inset-y-0 left-0 z-20 flex' : 'hidden md:flex',
			'w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4',
			'md:sticky md:top-0 md:h-screen md:w-56 md:bg-transparent md:p-0 md:py-8',
			'dark:border-gray-800 dark:bg-gray-950 md:dark:bg-transparent'
		]}
	>
		{#if mobileOpen}
			<button
				{@attach (el) => el.focus()}
				class="mb-4 self-start rounded-md px-2 py-1 text-sm text-gray-500 md:hidden dark:text-gray-400"
				onclick={closeDrawer}
			>
				✕ {t('common:nav.close')}
			</button>
		{/if}
		<nav class="space-y-6" aria-label={t('common:nav.sections')}>
			{#each NAV as { group, items } (group)}
				<div>
					<h2
						class="px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						{t(group)}
					</h2>
					<div class="mt-2 space-y-0.5">
						{#each items as item (item.path)}
							<a
								href={localizeHref(item.path)}
								aria-current={routeId === item.path ? 'page' : undefined}
								class={linkClass}
								onclick={() => (mobileOpen = false)}
							>
								{t(item.label)}
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</nav>
	</aside>

	<main id="content" tabindex="-1" class="min-w-0 flex-1 py-8 pb-24 outline-none" inert={drawer}>
		{@render children()}

		<!-- An each over a derived list, not {#if prev}…{prev.label}: navigating to a page that awaits
			 in its script (/sources) commits the layout asynchronously, and a branch could be created
			 for the new `prev` while the expressions inside it still read the old, undefined one. -->
		{#if pager.length}
			<nav
				aria-label={t('common:nav.pager')}
				class="mt-16 grid gap-3 border-t border-gray-200 pt-8 sm:grid-cols-2 dark:border-gray-800"
			>
				{#each pager as link (link.dir)}
					<a
						href={localizeHref(link.path)}
						class={link.dir === 'next' ? `${pagerClass} sm:col-start-2 sm:text-right` : pagerClass}
					>
						<span class="block text-xs text-gray-500 dark:text-gray-400">
							{link.dir === 'prev' ? `← ${t('common:nav.previous')}` : `${t('common:nav.next')} →`}
						</span>
						<span class="font-medium">{t(link.label)}</span>
					</a>
				{/each}
			</nav>
		{/if}
	</main>
</div>
