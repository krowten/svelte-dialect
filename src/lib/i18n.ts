import { createDialect } from '#lib/kit.js';
import type { MessageKey, MessageParams } from './i18n-keys.js';

// The generics narrow t() to the generated key union and, for keys whose MF2 source names
// parameters, to those parameters — while any plain string still compiles, so runtime-only keys
// stay legal. Regenerate both with `bun run typegen` when messages change.
//
// routing: this site is deployed under a subdirectory (GitHub Pages), so the locale prefix has to be
// looked for after the base rather than instead of it — `svelte-dialect/kit` reads `paths.base`
// itself, nothing to pass. The default strategy already puts
// `url` before `cookie`, so a prefixed link always wins and an unprefixed visit still remembers the
// last locale a returning visitor picked — that combination is the whole point of this demo.
export const {
	t,
	formatParts,
	formatNumber,
	formatDate,
	loadTranslations,
	getLocale,
	setLocale,
	locales,
	handle,
	reroute,
	localizeHref,
	localizedEntries
} = createDialect<MessageKey, MessageParams>({
	messages: {
		// bundled: inlined at build time, no request at runtime
		...import.meta.glob('./messages/**/*.json', { eager: true }),
		// not eager: each namespace stays its own chunk, fetched the first time it's asked for —
		// swap this for a `loader` with a fetch(...) body and the namespaces come from an API
		// instead; the cache, the single call per namespace and the SSR dedupe work the same
		...import.meta.glob('./messages-lazy/**/*.json')
	},
	defaultLocale: 'en',
	locales: ['en', 'ru', 'de'],
	routing: true
});
