import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { localizedEntries } from './src/lib/entries.js';
import { PAGES as DOCS } from './src/routes/nav.js';

// Vite config is loaded before any plugin runs — hence the relative import above instead of the
// package's own `svelte-dialect/entries` subpath (which points into dist/, not built yet), and the
// literal locale list here instead of deriving it from the message glob (which the config loader
// cannot see). The pages come from the sidebar, as the sitemap's do, so a new page can't be left
// out of the prerender.
const PAGES = ['/', ...DOCS];

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				// On so /sources can await loadTranslations straight in its script, the way an app
				// with the flag would. The e2e suite navigating onto that page guards the library's
				// workaround for the stale-layout bug in Svelte 5.57 (see loadTranslations).
				experimental: { async: true }
			},

			// The site ships as static files (GitHub Pages at the public release, hence BASE_PATH
			// for being served from /<repo>/). It is *also* built with adapter-node, unprerendered,
			// so the e2e suite can drive locale negotiation through a real server — translations
			// have to work both ways, and only a running server exercises `handle`.
			adapter:
				process.env.ADAPTER === 'node'
					? adapterNode({ out: 'build-node' })
					: // GitHub Pages serves 404.html for any path it has no file for
						adapterStatic({ fallback: '404.html' }),
			paths: {
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}`,
				// `relative` stays at its default (true) on purpose: routing has to work with it, and
				// the e2e suite loading prefixed pages is what proves that it does.
				// The public origin of the GitHub Pages build: prerendering sees it as `url.origin`, which
				// the canonical, hreflang and sitemap URLs are built from. Left out of the adapter-node
				// build, which the e2e suite serves on localhost.
				...(process.env.ADAPTER === 'node' ? {} : { origin: 'https://krowten.github.io' })
			},
			// The crawler only finds /ru/... by following a link from the default-locale pages it
			// starts from, and nothing links there from outside the site — so every page needs both
			// its bare and its /ru address seeded explicitly. Base-free on purpose: SvelteKit prepends
			// `paths.base` to prerender entries itself.
			prerender: {
				entries: [
					...localizedEntries(PAGES, { locales: ['en', 'ru', 'de'], defaultLocale: 'en' }),
					// nothing links to it, so the crawler would never find it on its own
					'/sitemap.xml'
				]
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
