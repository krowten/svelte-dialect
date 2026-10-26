<script lang="ts">
	import { page } from '$app/state';
	import { t, localizeHref } from '#lib/i18n.js';
</script>

<svelte:head>
	<title>{page.status} · svelte-dialect</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1 class="text-3xl font-bold tracking-tight" data-testid="error-title">
	{page.status === 404 ? t('common:error.not_found') : t('common:error.failed')}
</h1>
<p class="mt-3 text-gray-600 dark:text-gray-300">
	<a class="text-gray-900 underline dark:text-gray-100" href={localizeHref('/')}
		>{t('common:error.home')}</a
	>
</p>
