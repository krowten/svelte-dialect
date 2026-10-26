/**
 * Type-level tests. There is no runtime here and no test runner: every `@ts-expect-error` below
 * fails the build if the error it expects stops happening, so `bun run check` IS the assertion.
 * That keeps the checks in the tool that already runs on every commit rather than adding a
 * typecheck-only vitest project.
 */
import { createDialect } from './core.svelte.js';

type Key = 'home:title' | 'home:greeting' | 'cart:items';
type KeyParams = {
	'home:greeting': { name: string };
	'cart:items': { count: number | string };
};

const open = createDialect({ defaultLocale: 'en' });
const keyed = createDialect<Key>({ defaultLocale: 'en' });
const strict = createDialect<Key, KeyParams>({ defaultLocale: 'en' });

// --- no generics: everything stays permissive, exactly as before the generics existed ---
open.t('anything:at.all');
open.t('anything:at.all', { whatever: 1 });
open.loadTranslations('any-namespace');

// --- key union only: known keys autocomplete, unknown strings still compile ---
keyed.t('home:title');
keyed.t('cart:items', { count: 2 });
// a key that only exists at runtime — a loader hitting a database — must not be an error
keyed.t('cms:hero');
keyed.loadTranslations('home');
keyed.loadTranslations('cms');

// --- key union + params: params are checked for the keys typegen found them for ---
strict.t('home:title'); // no params known → still optional
strict.t('home:greeting', { name: 'Kat' });
strict.t('cart:items', { count: 2 });
strict.t('cart:items', { count: '2' }); // the union typegen emits for :number
strict.formatParts('home:greeting', { name: 'Kat' });

// @ts-expect-error a key with known params cannot be called without them
strict.t('home:greeting');
// @ts-expect-error the parameter is named in the message, so a typo in it is an error
strict.t('home:greeting', { nmae: 'Kat' });
// @ts-expect-error and its type is checked
strict.t('home:greeting', { name: 42 });
// @ts-expect-error formatParts is held to the same contract
strict.formatParts('home:greeting');

// A runtime-only key stays open even in strict mode: nothing is known about its parameters,
// so anything goes rather than nothing being allowed.
strict.t('cms:hero');
strict.t('cms:hero', { anything: true });

// --- the members that do not depend on the generics keep working ---
const locale: string = strict.getLocale();
const dir: 'ltr' | 'rtl' = strict.getTextDirection();
const href: string = strict.localizeHref('/about');
const entries: string[] = strict.localizedEntries(['/']);
const n: string = strict.formatNumber(1);
const d: string = strict.formatDate(new Date());
void [locale, dir, href, entries, n, d];
