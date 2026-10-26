import { localizeHref } from '#lib/i18n.js';

/**
 * The absolute address of a page in a locale, as canonical, hreflang and the sitemap need it. The
 * site root under a base path gets its trailing slash: GitHub Pages answers `/svelte-dialect` with a
 * redirect to `/svelte-dialect/`, and a canonical URL should be the one that is actually served.
 */
export const absoluteUrl = (origin: string, path: string, locale: string) => {
	const href = localizeHref(path, locale);
	return origin + (href !== '/' && href === localizeHref('/', 'en') ? `${href}/` : href);
};
