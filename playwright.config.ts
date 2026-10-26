import { defineConfig } from '@playwright/test';

// The same site, built twice on purpose: translations have to work both when a server negotiates
// the locale and when nothing but the browser does, so both artifacts get driven by the suite.
export default defineConfig({
	// only the suites in e2e/ — copies under .scratch/ must not be picked up
	testDir: 'e2e',
	// Both builds happen in `test:e2e` before playwright starts: run concurrently as webServer
	// commands they would race on the shared .svelte-kit directory and corrupt each other.
	webServer: [
		{ command: 'npm run preview', port: 4173 },
		{ command: 'PORT=4174 node build-node/index.js', port: 4174 }
	],
	// Pin the browser language: it is the last resort in locale resolution, so without this the
	// suite would pass or fail depending on the language of the machine running it.
	use: { locale: 'en-US' },
	projects: [
		{
			name: 'static',
			testMatch: /(i18n|fuzz)\.e2e\.ts/,
			use: { baseURL: 'http://localhost:4173' }
		},
		{
			name: 'ssr',
			testMatch: /(ssr|fuzz)\.e2e\.ts/,
			use: { baseURL: 'http://localhost:4174' }
		}
	]
});
