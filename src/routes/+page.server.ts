import type { PageServerLoad } from './$types.js';

import { highlight } from './highlight.server.js';

const I18N = `// src/lib/i18n.ts
import { createDialect } from 'svelte-dialect/kit';

export const { t, handle, reroute, localizeHref, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en',
	routing: true
});`;

const HOOKS_SERVER = `// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit/hooks';
import { handle as dialect } from '#lib/i18n.ts';

export const handle: Handle = dialect;`;

const HOOKS = `// src/hooks.ts — universal, not hooks.server.ts
import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.ts';

export const reroute: Reroute = dialect;`;

export const load: PageServerLoad = async () => ({
	i18nCode: await highlight(I18N, 'ts'),
	hooksServerCode: await highlight(HOOKS_SERVER, 'ts'),
	hooksCode: await highlight(HOOKS, 'ts')
});
