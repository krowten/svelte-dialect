import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const INSTALL = `npm install svelte-dialect`;

const SV_ADD = `npx sv add svelte-dialect`;

const MESSAGES = `// src/lib/messages/en/common.json
{ "greeting": "Hello, {$name}!" }`;

const DIALECT = `// src/lib/i18n.ts
import { createDialect } from 'svelte-dialect/kit';

export const { t, handle, reroute, localizeHref, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en',
	routing: true
});`;

const HANDLE = `// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit/hooks';
import { handle as dialect } from '#lib/i18n.js';

export const handle: Handle = dialect;`;

const REROUTE = `// src/hooks.ts — universal, not hooks.server.ts
import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.js';

export const reroute: Reroute = dialect;`;

const APPHTML = `<!-- src/app.html -->
<html lang="%dialect.lang%" dir="%dialect.dir%">`;

const USE = `<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { t } from '#lib/i18n.js';
</script>

<p>{t('common:greeting', { name: 'world' })}</p>`;

export const load: PageServerLoad = async () => ({
	installCode: await highlight(INSTALL, 'sh'),
	svAddCode: await highlight(SV_ADD, 'sh'),
	messagesCode: await highlight(MESSAGES, 'jsonc'),
	dialectCode: await highlight(DIALECT, 'ts'),
	handleCode: await highlight(HANDLE, 'ts'),
	rerouteCode: await highlight(REROUTE, 'ts'),
	apphtmlCode: await highlight(APPHTML, 'svelte'),
	useCode: await highlight(USE, 'svelte')
});
