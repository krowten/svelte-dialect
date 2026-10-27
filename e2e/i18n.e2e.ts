import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The locale switcher is a plain <select>: a pick made before hydration has wired it up does
// nothing, and how long hydration takes varies by page (/sources waits on a lazy namespace chunk
// first). Letting the network settle before interacting keeps the suite from racing it.
const visit = (page: Page, path: string) => page.goto(path, { waitUntil: 'networkidle' });

test('MF2 markup renders through snippets, not as stringified functions', async ({ page }) => {
	await visit(page, '/');
	const rich = page.getByTestId('rich');

	// the emphasis and the link live in the translation, so both must become real elements
	await expect(rich.locator('em')).toContainText('MessageFormat 2');
	await expect(rich.locator('em a')).toHaveAttribute('href', 'https://messageformat.unicode.org/');
	// an external link opens in a new tab, and says so to a screen reader
	await expect(rich.locator('em a')).toHaveAttribute('target', '_blank');
	await expect(rich.locator('em a')).toContainText('(opens in a new tab)');
	await expect(rich.locator('a').last()).toHaveAttribute('href', '/rich-text');
	// a snippet leaking into the page as source text is the failure this guards against
	await expect(rich).not.toContainText('function');
});

test('renders english by default on the bare path', async ({ page }) => {
	await visit(page, '/');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByTestId('tagline')).toContainText('Tiny MessageFormat 2');
});

test('MF2 params and plurals work', async ({ page }) => {
	await visit(page, '/');
	await expect(page.getByTestId('greeting')).toHaveText('Hello, Svelte!');
	await page.getByTestId('counter-button').click();
	await expect(page.getByTestId('counter')).toHaveText('You clicked 1 time');
	await page.getByTestId('counter-button').click();
	await expect(page.getByTestId('counter')).toHaveText('You clicked 2 times');
});

test('switching to ru navigates to the /ru prefix and persists via cookie', async ({ page }) => {
	await visit(page, '/');
	await page.getByTestId('locale-switcher').selectOption('ru');

	await expect(page).toHaveURL(/\/ru\/?$/);
	await expect(page.getByTestId('tagline')).toContainText('Крошечный');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

	// the prefix alone would be enough, but the cookie is what keeps a *bare* revisit in Russian too
	await visit(page, '/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});

test('the /ru prefix works as a direct, prerendered address', async ({ page }) => {
	await visit(page, '/ru');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	await expect(page.getByTestId('tagline')).toContainText('Крошечный');
});

test('the /de prefix renders German', async ({ page }) => {
	await visit(page, '/de/routing');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
	await expect(page.locator('h1')).toHaveText('Locale in der URL');
	await expect(page.getByRole('link', { name: 'Einrichtung', exact: true })).toBeVisible();
});

test('a prefixed page loads its scripts and hydrates under the default relative paths', async ({
	page
}) => {
	// SvelteKit computes relative asset paths from event.url, so this breaks (scripts requested
	// from /ru/_app/…, no hydration) if handle ever hands resolve() a de-localised URL again
	const failed: string[] = [];
	page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
	await visit(page, '/ru/setup');
	await page.getByTestId('locale-switcher').selectOption('de');
	await expect(page).toHaveURL(/\/de\/setup$/);
	expect(failed).toEqual([]);
});

test('the default locale has exactly one address', async ({ page }) => {
	// /en is never linked to, but if visited it must not become a second URL for the same content
	const response = await visit(page, '/en/setup');
	expect(response?.status()).toBe(200); // playwright already followed the 308
	await expect(page).toHaveURL(/\/setup\/?$/);
});

test('client-side navigation between pages keeps the switched locale', async ({ page }) => {
	await visit(page, '/');
	await page.getByTestId('locale-switcher').selectOption('ru');
	await expect(page).toHaveURL(/\/ru\/?$/);

	await page.getByRole('link', { name: 'Установка', exact: true }).click();
	await expect(page).toHaveURL(/\/ru\/setup$/);
	await expect(page.locator('h1')).toHaveText('Установка');
});

test('a plain in-page link to another locale updates url, html lang and content without a full reload', async ({
	page
}) => {
	await visit(page, '/routing');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	// a document reload would replace `window`, dropping this marker
	await page.evaluate(() => {
		(window as unknown as { __marker: string }).__marker = 'same-document';
	});

	// no data-sveltekit-reload on this link: the client router has to switch the locale on its own
	await page.getByTestId('routing-try-link-ru').click();

	await expect(page).toHaveURL(/\/ru\/routing$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	await expect(page.locator('h1')).toHaveText('Локаль в URL');
	expect(await page.evaluate(() => (window as unknown as { __marker?: string }).__marker)).toBe(
		'same-document'
	);
});

test('back navigation after a plain cross-locale link resyncs the locale too', async ({ page }) => {
	await visit(page, '/routing');
	await page.getByTestId('routing-try-link-ru').click();
	await expect(page).toHaveURL(/\/ru\/routing$/);

	await page.goBack();

	await expect(page).toHaveURL(/\/routing$/);
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.locator('h1')).toHaveText('Locale in the URL');
});

test('a sidebar label follows the locale', async ({ page }) => {
	await visit(page, '/');
	await expect(page.getByRole('link', { name: 'Setup', exact: true })).toBeVisible();

	await page.getByTestId('locale-switcher').selectOption('ru');
	await expect(page.getByRole('link', { name: 'Установка', exact: true })).toBeVisible();
});

test('both loading patterns render on the sources page and follow the locale', async ({ page }) => {
	await visit(page, '/sources');
	await expect(page.getByTestId('load-title')).toHaveText('Loaded in a load function');
	await expect(page.getByTestId('component-title')).toHaveText('Loaded on demand');

	await page.getByTestId('locale-switcher').selectOption('ru');
	await expect(page).toHaveURL(/\/ru\/sources$/);
	await expect(page.getByTestId('load-title')).toHaveText('Загружено в load-функции');
	await expect(page.getByTestId('component-title')).toHaveText('Загружено по требованию');
});

test('a load-function namespace survives a full reload in the switched locale', async ({
	page
}) => {
	await visit(page, '/sources');
	await page.getByTestId('locale-switcher').selectOption('ru');
	await expect(page.getByTestId('load-title')).toHaveText('Загружено в load-функции');

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	await expect(page.getByTestId('load-title')).toHaveText('Загружено в load-функции');
	await expect(page.getByTestId('component-title')).toHaveText('Загружено по требованию');
});

test('plurals on the messages page pick the right category', async ({ page }) => {
	await visit(page, '/messages');
	await expect(page.getByTestId('plural-demo')).toHaveText('1 item · 3 items · 5 items');
});

test('number and date formatting renders on the messages page', async ({ page }) => {
	await visit(page, '/messages');
	await expect(page.getByTestId('numbers-demo')).toContainText('Total:');
	await expect(page.getByTestId('numbers-demo')).toContainText('September 30, 2026');
});

test('rich markup with options and nesting renders on the rich-text page', async ({ page }) => {
	await visit(page, '/rich-text');
	await expect(page.getByTestId('rich-cta').locator('a')).toHaveAttribute('href', '/setup');
	await expect(page.getByTestId('rich-nested').locator('strong')).toContainText('bold with a');
	await expect(page.getByTestId('rich-nested').locator('strong a')).toHaveAttribute(
		'href',
		'/setup'
	);
});

test('markup with no matching snippet still renders its contents', async ({ page }) => {
	await visit(page, '/rich-text');
	await expect(page.getByTestId('rich-unwired')).toContainText('unwired markup');
});

test('an unknown locale cookie is ignored rather than trusted', async ({ browser }) => {
	const ctx = await browser.newContext({ locale: 'en-US' });
	await ctx.addCookies([{ name: 'dialect', value: 'ja', url: 'http://localhost:4173' }]);
	const page = await ctx.newPage();

	await visit(page, '/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByTestId('tagline')).toContainText('Tiny MessageFormat 2');
	await ctx.close();
});

test('a russian browser gets russian without a cookie', async ({ browser }) => {
	const ctx = await browser.newContext({ locale: 'ru-RU' });
	const page = await ctx.newPage();
	await visit(page, '/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
	await ctx.close();
});

test('client-side navigation updates the layout: sidebar highlight and title', async ({ page }) => {
	// /sources awaits loadTranslations in its script under experimental.async; on Svelte 5.57 that
	// left both stale until loadTranslations learned to join the navigation's batch
	await visit(page, '/setup');
	await page.getByRole('link', { name: 'Loading messages', exact: true }).first().click();
	await expect(page).toHaveURL(/\/sources$/);
	await expect(page.locator('aside a[aria-current="page"]')).toHaveText('Loading messages');
	await expect(page).toHaveTitle('Lazy-loading translations in SvelteKit');
});

test('heading anchors are stable across languages', async ({ page }) => {
	await visit(page, '/de/routing#prefix');
	const heading = page.locator('h2#prefix');
	await expect(heading).toContainText('Das Präfix');
	await expect(heading.getByRole('link', { name: /Link zum Abschnitt/ })).toHaveAttribute(
		'href',
		'#prefix'
	);
	// the "On this page" list points at ids that exist
	for (const href of await page
		.locator('nav[aria-label="Auf dieser Seite"] a')
		.evaluateAll((as) => as.map((a) => a.getAttribute('href')!))) {
		await expect(page.locator(href)).toHaveCount(1);
	}
});

test('code blocks show the file name and copy the plain source', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await visit(page, '/setup');
	const block = page.locator('.code-block', { hasText: 'src/hooks.ts' });
	await expect(block.getByTestId('code-file')).toHaveText('src/hooks.ts');
	const copy = block.getByTestId('code-copy');
	await copy.focus();
	await page.keyboard.press('Enter');
	await expect(copy).toHaveText(/Copied/);
	const text = await page.evaluate(() => navigator.clipboard.readText());
	expect(text.startsWith('import type { Reroute }')).toBe(true);
});

test('the home page has localized entry buttons', async ({ page }) => {
	await visit(page, '/de');
	await expect(page.getByTestId('cta-setup')).toHaveAttribute('href', '/de/setup');
	await expect(page.getByTestId('cta-api')).toHaveAttribute('href', '/de/api');
});

test('the CLI reference lists every command with its flags', async ({ page }) => {
	await visit(page, '/cli');
	await expect(page.locator('h1')).toHaveText('CLI reference');
	for (const id of ['typegen', 'check', 'migrate'])
		await expect(page.locator(`h2#${id}`)).toBeVisible();
	await expect(page.locator('#migrate-strict')).toContainText('--strict');
});

// Files from scripts/markdown.ts, which runs after vite build; `vite preview` only serves the
// prerendered output, so these are read from build/ instead of fetched.
test('every docs page has a Markdown version, and llms-full.txt joins them', () => {
	const md = readFileSync('build/setup.md', 'utf8');
	expect(md).toMatch(/^# Setup\n/);
	expect(md).toContain('```ts\nimport { createDialect }');
	expect(md).not.toContain('[#](#');
	// /compare repeats its column labels in every cell for narrow screens; not in Markdown
	expect(readFileSync('build/compare.md', 'utf8')).not.toContain('Svelte API:');

	const full = readFileSync('build/llms-full.txt', 'utf8');
	expect(full).toMatch(/^# svelte-dialect\n\n> /);
	for (const title of ['# Setup', '# API reference', '# Svelte i18n libraries compared (2026)'])
		expect(full).toContain(`\n${title}\n`);
});
