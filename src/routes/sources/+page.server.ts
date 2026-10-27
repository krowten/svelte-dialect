import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const BUILD = `createDialect({
	messages: {
		// eager: inlined at build time
		...import.meta.glob('./messages/**/*.json', { eager: true }),
		// not eager: fetched the first time a page asks for it
		...import.meta.glob('./messages-lazy/**/*.json')
	},
	defaultLocale: 'en'
});`;

const LOAD_FN = `// +page.ts
export const load: PageLoad = async () => await loadTranslations('billing');`;

const LOAD_FN_PAGE = `// +page.svelte
const { data }: PageProps = $props();
<h1>{data.t('billing:title')}</h1>`;

const COMPONENT = `// in the component's script, with experimental.async on
import { loadTranslations } from '#lib/i18n.ts';

const { t } = await loadTranslations('dashboard');

// then in the markup
{t('dashboard:title')}`;

const REMOTE = `// messages.remote.ts
import * as v from 'valibot';
import { query } from '$app/server';

export const getMessages = query(
	v.object({ locale: v.picklist(['en', 'ru']), namespace: v.picklist(['dashboard']) }),
	async ({ locale, namespace }) => db.loadMessages(locale, namespace)
);`;

const REMOTE_DIALECT = `// lib/i18n.ts
createDialect({
	defaultLocale: 'en',
	locales: ['en', 'ru'],
	loader: async ({ locale, namespace }) => getMessages({ locale, namespace })
});`;

const FETCH = `createDialect({
	defaultLocale: 'en',
	locales: ['en', 'ru'],
	loader: async ({ locale, namespace }) => {
		const res = await fetch(\`https://example.com/i18n/\${locale}/\${namespace}.json\`);
		return res.json();
	}
});`;

export const load: PageServerLoad = async () => ({
	buildCode: await highlight(BUILD, 'ts'),
	loadFnCode: await highlight(LOAD_FN, 'ts'),
	loadFnPageCode: await highlight(LOAD_FN_PAGE, 'svelte'),
	componentCode: await highlight(COMPONENT, 'ts'),
	remoteCode: await highlight(REMOTE, 'ts'),
	remoteDialectCode: await highlight(REMOTE_DIALECT, 'ts'),
	fetchCode: await highlight(FETCH, 'ts')
});
