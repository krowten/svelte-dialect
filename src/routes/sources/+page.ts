import { loadTranslations } from '#lib/i18n.js';
import type { PageLoad } from './$types.js';

// A universal load function may return anything, including functions — only *server* load output
// has to survive devalue. So `t` can travel to the page as data, and no component-level `await`
// is needed for this pattern. What the server load produced (the highlighted snippets) arrives as
// `data` and has to be passed along, or it would be replaced.
export const load: PageLoad = async ({ data }) => ({
	...data,
	...(await loadTranslations('billing'))
});
