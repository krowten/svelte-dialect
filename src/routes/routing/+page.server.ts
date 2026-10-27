import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const WIRING = `// src/lib/i18n.ts
export const { t, handle, reroute, localizeHref, localizedEntries } = createDialect({
	// …messages as in Setup
	locales: ['en-US', 'de-DE'],
	defaultLocale: 'de-DE',
	routing: true
});`;

const REROUTE = `// src/hooks.ts — universal, not hooks.server.ts
import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.ts';

export const reroute: Reroute = dialect;`;

const BASE = `// vite.config.ts — svelte-dialect/kit reads it, nothing to pass to createDialect
sveltekit({ paths: { base: '/docs' } });`;

const LINKING = `<a href={localizeHref('/about')}>About</a>`;

const PRERENDER = `// vite.config.ts
import { localizedEntries } from 'svelte-dialect/entries';

localizedEntries(['/', '/about'], { locales: ['en', 'ru'], defaultLocale: 'en' });
// → ['/', '/ru', '/about', '/ru/about']`;

export const load: PageServerLoad = async () => ({
	wiringCode: await highlight(WIRING, 'ts'),
	rerouteCode: await highlight(REROUTE, 'ts'),
	baseCode: await highlight(BASE, 'ts'),
	linkingCode: await highlight(LINKING, 'svelte'),
	prerenderCode: await highlight(PRERENDER, 'ts')
});
