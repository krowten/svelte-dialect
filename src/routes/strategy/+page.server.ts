import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const DEFAULT = `strategy: ['url', 'cookie', 'lang', 'header', 'navigator', 'default'];`;

const CUSTOM = `createDialect({
	strategy: ['cookie', 'default'],
	// …
});`;

const CONFIGURE_SERVER = `// src/hooks.server.ts — top-level await runs before the first request
import { configure, handle as dialect } from '#lib/i18n.js';

const settings = await loadLocaleSettings();
configure({ defaultLocale: settings.defaultLocale, locales: settings.locales });

export const handle = dialect;`;

const CONFIGURE_CLIENT = `// src/routes/+layout.ts
import { configure } from '#lib/i18n.js';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	configure(data.i18n);
	return data;
};`;

export const load: PageServerLoad = async () => ({
	defaultCode: await highlight(DEFAULT, 'ts'),
	customCode: await highlight(CUSTOM, 'ts'),
	configureServerCode: await highlight(CONFIGURE_SERVER, 'ts'),
	configureClientCode: await highlight(CONFIGURE_CLIENT, 'ts')
});
