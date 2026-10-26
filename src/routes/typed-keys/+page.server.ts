import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const GENERATE = `npx svelte-dialect typegen --messages src/lib/messages --out src/lib/i18n-keys.d.ts`;

const KEYS = `import type { MessageKey } from './i18n-keys.js';

export const { t, loadTranslations } = createDialect<MessageKey>({ … });`;

const PARAMS = `import type { MessageKey, MessageParams } from './i18n-keys.js';

export const { t } = createDialect<MessageKey, MessageParams>({ … });

t('home:greeting', { name: 'Kat' }); // ✅
t('home:greeting'); // ✗ Expected 2 arguments, but got 1
t('home:greeting', { nmae: 'Kat' }); // ✗ 'nmae' does not exist
t('cms:hero'); // ✅ nothing is known about a runtime-only key, so anything goes`;

const SNAPSHOT = `npx svelte-dialect typegen --from-json dump.json --out src/lib/i18n-keys.d.ts`;

const CLI = `npx svelte-dialect typegen   # the .d.ts above
npx svelte-dialect check     # compare t('…') calls in code against the catalogs
npx svelte-dialect migrate   # convert i18next / ICU MessageFormat JSON to MF2, in place`;

export const load: PageServerLoad = async () => ({
	generateCode: await highlight(GENERATE, 'sh'),
	keysCode: await highlight(KEYS, 'ts'),
	paramsCode: await highlight(PARAMS, 'ts'),
	snapshotCode: await highlight(SNAPSHOT, 'sh'),
	cliCode: await highlight(CLI, 'sh')
});
