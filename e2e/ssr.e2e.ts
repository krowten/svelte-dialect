import { expect, test } from '@playwright/test';

// Runs against the adapter-node build with prerendering off, so every request reaches `handle`.
// The negotiation assertions deliberately use `request` rather than `page`: they check what the
// server put on the wire, before any JavaScript could have corrected it.

test('the server renders the cookie locale', async ({ request }) => {
	const html = await (await request.get('/', { headers: { cookie: 'dialect=ru' } })).text();

	expect(html).toContain('<html lang="ru"');
	expect(html).toContain('Крошечный');
});

test('the server negotiates Accept-Language when there is no cookie', async ({ request }) => {
	const html = await (
		await request.get('/', { headers: { 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8' } })
	).text();

	expect(html).toContain('<html lang="ru"');
	expect(html).toContain('Крошечный');
});

test('the cookie outranks Accept-Language', async ({ request }) => {
	const html = await (
		await request.get('/', { headers: { cookie: 'dialect=en', 'accept-language': 'ru' } })
	).text();

	expect(html).toContain('<html lang="en"');
});

test('the server falls back to the default with no signal at all', async ({ request }) => {
	const html = await (
		await request.get('/', { headers: { 'accept-language': 'ja,fr;q=0.8' } })
	).text();

	expect(html).toContain('<html lang="en"');
});

test('a tampered locale cookie is not trusted', async ({ request }) => {
	const html = await (await request.get('/', { headers: { cookie: 'dialect=ja' } })).text();

	expect(html).toContain('<html lang="en"');
});

test('hydration keeps the language the server chose', async ({ page, context }) => {
	// the browser asks for en-US, so if the client ignored the server it would flip back
	await context.addCookies([{ name: 'dialect', value: 'ru', url: 'http://localhost:4174' }]);
	await page.goto('/');

	await expect(page.getByTestId('tagline')).toContainText('Крошечный');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

	// and it stays put once the client has had a chance to re-render
	await page.getByTestId('counter-button').click();
	await expect(page.getByTestId('counter')).toContainText('Вы кликнули');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});

test('concurrent requests with different languages each get their own', async ({ request }) => {
	// fire both language variants together, repeatedly, so their renders interleave on the server —
	// under shared locale state one of these bleeds into the other
	const rounds = await Promise.all(
		Array.from({ length: 8 }, (_, i) =>
			request
				.get('/', { headers: { 'accept-language': i % 2 ? 'ru' : 'en' } })
				.then(async (r) => ({ asked: i % 2 ? 'ru' : 'en', html: await r.text() }))
		)
	);

	for (const { asked, html } of rounds) {
		expect(html).toContain(`<html lang="${asked}"`);
		expect(html).toContain(asked === 'ru' ? 'Крошечный' : 'Tiny MessageFormat 2');
	}
});

test('dynamic namespaces are server-rendered in the negotiated locale', async ({ request }) => {
	// /sources carries both patterns at once: a namespace loaded in a load function, and one
	// awaited straight in the component script (experimental.async) — both must render server-side
	const html = await (await request.get('/sources', { headers: { cookie: 'dialect=ru' } })).text();

	expect(html).toContain('<html lang="ru"');
	expect(html).toContain('Загружено в load-функции');
	expect(html).toContain('Загружено по требованию');
});

test('an unknown address answers 404 with the site, in the visitor language', async ({
	request
}) => {
	const en = await request.get('/no-such-page');
	expect(en.status()).toBe(404);
	expect(await en.text()).toContain("This page doesn't exist");

	const ru = await request.get('/ru/no-such-page');
	expect(ru.status()).toBe(404);
	expect(await ru.text()).toContain('Такой страницы нет');
});
