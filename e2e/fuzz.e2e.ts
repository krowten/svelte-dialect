import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { NAV } from '../src/routes/nav.ts';

// Fuzz test: random chains of user actions (open a page, switch language, arrive by a direct link
// in another language, click around, reload, go back/forward), with the locale state checked after
// every step against a small model. Runs in both Playwright projects (static and SSR).
//
// Replay a failure: FUZZ_SEED=<seed> FUZZ_RUNS=<runs> bunx playwright test fuzz --grep "seq <i>".
// Every failure message carries the seed, the sequence index and the full action log.
//
// The model (taken from README "Quickstart", the locale-negotiation docs and core.svelte.ts, not
// guessed; `detectOnBarePath` is off on this site):
//  - A prefixed URL (/ru/..., /de/...) always wins: the locale is the prefix, on a direct visit,
//    reload, back and forward alike. Nothing writes the cookie for it (only the opt-in
//    `detectOnBarePath` does that on the server) - the cookie stays whatever it was.
//  - An unprefixed URL is NOT "always the default locale". It walks the same strategy as any request:
//    url (no signal) -> cookie -> html lang -> Accept-Language / navigator -> default. So with a
//    `dialect` cookie the bare address serves the cookie locale at the same URL, with no redirect:
//    the SSR build renders it on the server, the static build hydrates the prerendered English page
//    and the client resolves the cookie. Without a cookie it is English (the browser is pinned to
//    en-US). Hence: L = prefix ?? cookie ?? 'en'.
//  - Only the language combobox writes the cookie (setLocale) and then navigates, with a full page
//    load, to the same page under the new prefix; if that is the URL it is already on (e.g. bare
//    URL, cookie ru, switching to en), only the content changes in place.
//  - Site links (sidebar, pager) are built with the current locale, so they carry its prefix even
//    from a bare URL; a link to the very URL we are on replaces the history entry instead of pushing.

const { FUZZ_SEED = '20261015', FUZZ_RUNS = '6', FUZZ_STEPS = '10' } = process.env;
const seed = Number(FUZZ_SEED);
const runs = Number(FUZZ_RUNS);
const steps = Number(FUZZ_STEPS);

const LOCALES = ['en', 'ru', 'de'] as const;
type Loc = (typeof LOCALES)[number];

const flat = NAV.flatMap((g): readonly { path: string; label: string }[] => g.items);
const PAGES = ['/', ...flat.map((i) => i.path)];

const common = Object.fromEntries(
	LOCALES.map((l) => [
		l,
		JSON.parse(
			readFileSync(new URL(`../src/lib/messages/${l}/common.json`, import.meta.url), 'utf8')
		) as { nav: Record<string, string> }
	])
);
/** `common:nav.setup` / `nav.setup` in a locale. */
const label = (l: Loc, key: string) =>
	common[l].nav[key.replace(/^common:nav\./, '').replace(/^nav\./, '')];

/** mulberry32: tiny seeded PRNG, so a failing sequence can be replayed exactly. */
const mulberry32 = (a: number) => () => {
	a = (a + 0x6d2b79f5) | 0;
	let t = Math.imul(a ^ (a >>> 15), 1 | a);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A history entry: the locale in the URL ('en' = no prefix) and the route-relative page. */
type Entry = { loc: Loc; path: string };

const urlPath = ({ loc, path }: Entry) =>
	loc === 'en' ? path : path === '/' ? `/${loc}` : `/${loc}${path}`;
const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);
const same = (a: Entry, b: Entry) => a.loc === b.loc && a.path === b.path;

test.describe.configure({ mode: 'parallel' });

for (let i = 0; i < runs; i++) {
	test(`fuzz seq ${i} (seed ${seed})`, async ({ page, context }) => {
		test.setTimeout(150_000);
		const rand = mulberry32(seed + i * 1_000_003);
		const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
		page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`));

		// model state
		let cookie: Loc | undefined;
		const hist: Entry[] = [];
		let idx = -1;
		const cur = () => hist[idx];
		const locale = (): Loc => (cur().loc !== 'en' ? cur().loc : (cookie ?? 'en'));
		/** Push a new entry, or replace the current one when the URL doesn't change. */
		const go = (e: Entry) => {
			if (idx >= 0 && same(cur(), e)) return;
			hist.splice(idx + 1, hist.length, e);
			idx = hist.length - 1;
		};
		const settle = () => page.waitForLoadState('networkidle');
		const arrive = async (e: Entry) => {
			await page.waitForURL((u) => norm(u.pathname) === norm(urlPath(e)), { timeout: 15_000 });
			await settle();
		};

		const log: string[] = [];
		const step = async (n: number) => {
			const loaded = idx >= 0;
			const L = loaded ? locale() : 'en';
			const here = loaded ? cur().path : '/';
			const at = flat.findIndex((it) => it.path === here);
			const prev = at > 0 ? flat[at - 1] : undefined;
			const next = at === -1 ? flat[0] : flat[at + 1];

			const options: Record<string, () => Promise<void>> = {
				goto: async () => {
					const e: Entry = { loc: pick(LOCALES), path: pick(PAGES) };
					log.push(`${n}. goto ${urlPath(e)}`);
					await page.goto(urlPath(e), { waitUntil: 'networkidle' });
					go(e);
				}
			};
			if (loaded) {
				options.switch = async () => {
					const to = pick(LOCALES);
					const e: Entry = { loc: to, path: here };
					log.push(`${n}. switch combobox ${L} -> ${to}`);
					await page.getByTestId('locale-switcher').selectOption(to);
					cookie = to;
					// a full navigation, unless the target is the very URL we are on
					if (!same(cur(), e)) {
						go(e);
						await arrive(e);
					}
				};
				options.reload = async () => {
					log.push(`${n}. reload`);
					await page.reload({ waitUntil: 'networkidle' });
				};
				options.sidebar = async () => {
					const item = pick(flat);
					const e: Entry = { loc: L, path: item.path };
					log.push(`${n}. click sidebar "${label(L, item.label)}" -> ${urlPath(e)}`);
					await page
						.locator('aside')
						.getByRole('link', { name: label(L, item.label), exact: true })
						.click();
					go(e);
					await arrive(e);
				};
				const pager = (dir: 'next' | 'previous', to: { path: string } | undefined) => {
					if (!to) return;
					options[`pager-${dir}`] = async () => {
						const e: Entry = { loc: L, path: to.path };
						log.push(`${n}. click pager ${dir} -> ${urlPath(e)}`);
						await page
							.getByRole('navigation', { name: label(L, 'nav.pager') })
							.getByRole('link')
							.filter({ hasText: label(L, `nav.${dir}`) })
							.click();
						go(e);
						await arrive(e);
					};
				};
				pager('previous', prev);
				pager('next', next);
			}
			if (idx > 0) {
				options.back = async () => {
					log.push(`${n}. history back`);
					await page.goBack({ waitUntil: 'networkidle' });
					idx--;
					await arrive(cur());
				};
			}
			if (idx >= 0 && idx < hist.length - 1) {
				options.forward = async () => {
					log.push(`${n}. history forward`);
					await page.goForward({ waitUntil: 'networkidle' });
					idx++;
					await arrive(cur());
				};
			}

			await options[pick(Object.keys(options))]();

			// invariants, against the model
			const want = locale();
			const where = `expected locale ${want}, model at ${urlPath(cur())}, cookie ${cookie}`;
			await expect
				.poll(() => norm(new URL(page.url()).pathname), { message: `URL: ${where}` })
				.toBe(norm(urlPath(cur())));
			await expect(page.locator('html'), `<html lang>: ${where}`).toHaveAttribute('lang', want);
			await expect(page.getByTestId('locale-switcher'), `combobox: ${where}`).toHaveValue(want);
			await expect(
				page.locator('aside').getByRole('link', { name: label(want, 'nav.setup'), exact: true }),
				`sidebar label: ${where}`
			).toBeVisible();
			// the sidebar highlights the page the URL is on (the layout works from the route id, which
			// Kit updates only once a navigation has finished - after the URL itself, on back/forward)
			const shown = flat.findIndex((it) => it.path === cur().path);
			const current = page.locator('aside a[aria-current="page"]');
			if (shown === -1) await expect(current, `current page highlight: ${where}`).toHaveCount(0);
			else
				await expect(
					page.locator('aside nav a').nth(shown),
					`current page highlight: ${where}`
				).toHaveAttribute('aria-current', 'page');
			// only the combobox ever writes the cookie
			const cookies = await context.cookies();
			expect(cookies.find((c) => c.name === 'dialect')?.value, `cookie: ${where}`).toBe(cookie);
			expect(errors, 'browser errors').toEqual([]);
		};

		try {
			for (let n = 1; n <= steps; n++) await step(n);
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			throw new Error(
				`fuzz FAILED  seed=${seed} seq=${i} (FUZZ_RUNS=${runs} FUZZ_STEPS=${steps})\n` +
					`action log:\n${log.join('\n')}\n\n${reason}`,
				{ cause: err }
			);
		}
	});
}
