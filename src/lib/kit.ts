import { resolve } from '$app/paths';
import { page } from '$app/state';

import { createDialect as createCoreDialect } from './core.svelte.js';

export * from './index.js';

/**
 * `createDialect` for SvelteKit apps: the same dialect, plus what only SvelteKit knows — the base
 * path (`paths.base`) and the locale resync after client-side navigation, which reads `page.url`
 * from `$app/state`. The root entry stays free of `$app/*` so it can run outside SvelteKit.
 */
export const createDialect = ((options) =>
	createCoreDialect({
		currentUrl: () => page.url,
		// SvelteKit 3 no longer exports `base`. `resolve('/')` is `base + '/'` (the core strips the
		// trailing slash): '/' is the root route ID, which every Kit 3 version accepts — a bare
		// pathname like '' throws in the 3.0 prereleases, which wanted a leading slash. Called at
		// module init, which Kit runs outside the request store (hooks load at server init, page
		// nodes before `handle`), so the default `paths.relative` can't make it relative.
		base: resolve('/'),
		...options
	})) as typeof createCoreDialect;
