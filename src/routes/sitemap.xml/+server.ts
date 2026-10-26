import { locales } from '#lib/i18n.js';
import { PAGES as DOCS } from '../nav.js';
import { absoluteUrl } from '../seo.js';
import type { RequestHandler } from './$types.js';

export const prerender = true;

const PAGES = ['/', ...DOCS];

// Every page in every locale, each entry listing its translations (`xhtml:link`) so search engines
// pair the language versions up even before they have crawled the `hreflang` links in the pages.
export const GET: RequestHandler = ({ url }) => {
	const at = (path: string, locale: string) => absoluteUrl(url.origin, path, locale);
	const alternates = (path: string) =>
		[
			...locales.map(
				(locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${at(path, locale)}"/>`
			),
			`<xhtml:link rel="alternate" hreflang="x-default" href="${at(path, locales[0])}"/>`
		].join('');
	const entries = PAGES.flatMap((path) =>
		locales.map((locale) => `<url><loc>${at(path, locale)}</loc>${alternates(path)}</url>`)
	);

	return new Response(
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
			'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
			entries.join('') +
			'</urlset>\n',
		{ headers: { 'content-type': 'application/xml' } }
	);
};
