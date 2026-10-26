import type { PageServerLoad } from './$types.js';

// What a package import gives you, as opposed to what createDialect returns. `key` is the suffix
// of the `api:row_*` message; `id` is the anchor.
const PACKAGE = [
	{
		id: 'createDialect',
		key: 'createDialect',
		name: 'createDialect',
		from: 'svelte-dialect',
		signature: '(options: DialectOptions) => Dialect'
	},
	{
		id: 'createDialect-kit',
		key: 'createDialectKit',
		name: 'createDialect',
		from: 'svelte-dialect/kit',
		signature: '(options: DialectOptions) => Dialect'
	},
	{
		id: 'Rich',
		key: 'Rich',
		name: 'Rich',
		from: 'svelte-dialect',
		signature: '<Rich parts={RichPart[]} {...snippets} />'
	},
	{
		id: 'localizedEntries',
		key: 'localizedEntries',
		name: 'localizedEntries',
		from: 'svelte-dialect/entries',
		signature: "(paths: string[], { locales, defaultLocale }) => ('*' | `/${string}`)[]"
	}
] as const;

const EXPORTS = [
	{ name: 't', signature: '(key, params?) => string' },
	{ name: 'loadTranslations', signature: '(ns: string | string[], opts?) => Promise<{ t }>' },
	{ name: 'getLocale', signature: '() => string' },
	{ name: 'setLocale', signature: '(locale, opts?) => void' },
	{ name: 'configure', signature: '({ defaultLocale?, locales? }) => void' },
	{ name: 'locales', signature: 'string[]' },
	{ name: 'handle', signature: 'Handle' },
	{ name: 'reroute', signature: 'Reroute' },
	{ name: 'localizeHref', signature: '(path, locale?) => string' },
	{ name: 'formatParts', signature: '(key, params?) => RichPart[]' },
	{ name: 'formatNumber', signature: '(value, options?) => string' },
	{ name: 'formatDate', signature: '(value, options?) => string' },
	{ name: 'getTextDirection', signature: "(locale?) => 'ltr' | 'rtl'" },
	{ name: 'localizedEntries', signature: "(paths: string[]) => ('*' | `/${string}`)[]" }
] as const;

const OPTIONS = [
	{ name: 'messages', default: '{}' },
	{ name: 'defaultLocale', default: '—' },
	{ name: 'locales', default: 'from messages' },
	{ name: 'cookie', default: "'dialect'" },
	{ name: 'loader', default: '—' },
	{ name: 'routing', default: 'false' },
	{ name: 'base', default: "''" },
	{ name: 'currentUrl', default: '—' },
	{ name: 'detectOnBarePath', default: 'false' },
	{ name: 'strategy', default: "['url', 'cookie', 'lang', 'header', 'navigator', 'default']" },
	{ name: 'bidiIsolation', default: 'false' },
	{ name: 'functions', default: '{}' },
	{ name: 'onError', default: 'console.warn' }
] as const;

export const load: PageServerLoad = async () => ({
	packageExports: PACKAGE,
	exports: EXPORTS,
	options: OPTIONS
});
