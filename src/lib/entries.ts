/**
 * The standalone twin of `createDialect().localizedEntries`, importable from `vite.config.ts`.
 *
 * It has to exist separately because of where prerender entries are configured: the Vite config is
 * loaded bare, before the Svelte plugin and its aliases exist — so it cannot import the runes
 * module the dialect lives in. This module is plain TypeScript with zero imports, published under its
 * own export condition-free subpath (`svelte-dialect/entries`) for exactly that consumer.
 *
 * Entries are returned base-free on purpose: SvelteKit prepends `paths.base` to every prerender
 * entry itself.
 */
export const localizedEntries = (
	paths: string[],
	{ locales, defaultLocale }: { locales: string[]; defaultLocale: string }
): ('*' | `/${string}`)[] => {
	const out: ('*' | `/${string}`)[] = [];
	for (const path of paths) {
		// the shape `kit.prerender.entries` accepts: '*' (every unparameterised route) or a path
		const entry = path === '*' ? '*' : (`/${path.replace(/^\//, '')}` as const);
		out.push(entry);
		for (const locale of locales) {
			if (locale === defaultLocale) continue;
			// '*' expands to bare routes only; the locale root seeds the crawler for the rest
			out.push(entry === '*' || entry === '/' ? `/${locale}` : `/${locale}${entry}`);
		}
	}
	return out;
};
