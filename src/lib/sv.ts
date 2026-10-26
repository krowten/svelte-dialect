// The `sv add svelte-dialect` add-on. `sv` loads it from `svelte-dialect/sv` and provides both
// imports at runtime, so this file must not import anything else.
import { defineAddon, defineAddonOptions } from 'sv';
import { color, isKit3, transforms } from '@sveltejs/sv-utils';

import pkg from 'svelte-dialect/package.json' with { type: 'json' };

/** `'en, de-ch'` → `['en', 'de-CH']`; throws a `RangeError` on a tag that is not BCP 47. */
export const parseLocales = (input: string) =>
	Intl.getCanonicalLocales(input.split(/[\s,]+/).filter(Boolean));

const options = defineAddonOptions()
	.add('locales', {
		question: `Which locales? ${color.optional('(the first one is the default, e.g. en, de)')}`,
		type: 'string',
		default: 'en, de',
		validate: (input) => {
			try {
				if (parseLocales(input ?? '').length === 0) return 'Enter at least one locale, e.g. en';
			} catch {
				return `"${input}" contains a tag that is not a valid BCP 47 locale`;
			}
		}
	})
	.add('routing', {
		question: `Put the locale in the URL? ${color.optional('(/de/about)')}`,
		type: 'boolean',
		default: true
	})
	.build();

const dialectFile = (entry: string, locales: string[], exports: string, routing: boolean) =>
	`import { createDialect } from '${entry}';

export const { ${exports} } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: '${locales[0]}',
	locales: [${locales.map((locale) => `'${locale}'`).join(', ')}]${routing ? ',\n\trouting: true' : ''}
});
`;

/** Leaves an existing file alone: re-running the add-on must not wipe the user's edits. */
const createOnly = (path: string, text: string) =>
	transforms.text(({ content }) => {
		if (!content.trim()) return text;
		console.warn(`svelte-dialect: ${path} already exists, left unchanged`);
		return false;
	});

/** The hook file the README shows, for a project that has none yet. */
const hookFile = (name: string, type: string, ts: boolean) =>
	ts
		? `import type { ${type} } from '@sveltejs/kit/hooks';\nimport { ${name} as dialect } from '#lib/i18n.js';\n\nexport const ${name}: ${type} = dialect;\n`
		: `import { ${name} as dialect } from '#lib/i18n.js';\n\n/** @type {import('@sveltejs/kit/hooks').${type}} */\nexport const ${name} = dialect;\n`;

/** Writes `text` into an empty or missing file and hands an existing one to `edit`. */
const orEmpty = (text: string, edit: (content: string) => string | false) => (content: string) =>
	content.trim() ? edit(content) : text;

export default defineAddon({
	id: 'svelte-dialect',
	shortDescription: 'i18n on MessageFormat 2',
	homepage: 'https://krowten.github.io/svelte-dialect/',
	options,

	setup: ({ isKit, dependencyVersion, unsupported }) => {
		if (isKit && !isKit3(dependencyVersion('@sveltejs/kit'))) unsupported('Requires SvelteKit 3');
	},

	run: ({ sv, options, isKit, language, directory }) => {
		const locales = parseLocales(options.locales);
		const routing = isKit && options.routing;
		const ts = language === 'ts';

		sv.dependency('svelte-dialect', `^${pkg.version}`);

		const i18n = `${directory.lib}/i18n.${language}`;
		sv.file(
			i18n,
			createOnly(
				i18n,
				!isKit
					? dialectFile('svelte-dialect', locales, 't, setLocale, getLocale, locales', false)
					: dialectFile(
							'svelte-dialect/kit',
							locales,
							routing
								? 't, handle, reroute, localizeHref, locales'
								: 't, handle, setLocale, locales',
							routing
						)
			)
		);

		for (const locale of locales) {
			sv.file(
				`${directory.lib}/messages/${locale}/common.json`,
				transforms.json(({ data }) => {
					if (Object.keys(data).length > 0) return false;
					data.greeting = 'Hello, {$name}!';
				})
			);
		}

		if (!isKit) return;

		sv.file(
			`src/hooks.server.${language}`,
			orEmpty(
				hookFile('handle', 'Handle', ts),
				transforms.script(({ ast, comments, js }) => {
					// Wraps an existing `handle` in `sequence()`. It skips the whole edit when `dialect` is
					// already in the file, so the import goes in afterwards.
					js.kit.addHooksHandle(ast, {
						language,
						newHandleName: 'handleDialect',
						handleContent: 'dialect',
						comments
					});
					js.imports.addNamed(ast, { from: '#lib/i18n.js', imports: { handle: 'dialect' } });
				})
			)
		);

		if (routing) {
			const hooks = `src/hooks.${language}`;
			sv.file(
				hooks,
				orEmpty(
					hookFile('reroute', 'Reroute', ts),
					transforms.script(({ ast, comments, js }) => {
						const declaration = js.variables.declaration(ast, {
							kind: 'const',
							name: ts ? 'reroute: Reroute' : 'reroute',
							value: js.variables.createIdentifier('dialect')
						});
						const exported = js.exports.createNamed(ast, {
							name: 'reroute',
							fallback: declaration
						});
						if (exported.declaration !== declaration) {
							console.warn(
								`svelte-dialect: ${hooks} already exports reroute, left unchanged; it must call the one from #lib/i18n.js`
							);
							return false;
						}
						js.imports.addNamed(ast, { from: '#lib/i18n.js', imports: { reroute: 'dialect' } });
						if (ts)
							js.imports.addNamed(ast, {
								from: '@sveltejs/kit/hooks',
								imports: ['Reroute'],
								isType: true
							});
						else
							js.common.addJsDocTypeComment(exported, comments, {
								type: "import('@sveltejs/kit/hooks').Reroute"
							});
					})
				)
			);
		}

		sv.file(
			'src/app.html',
			transforms.html(({ ast, html }) => {
				const root = ast.nodes.find(
					(node): node is Extract<typeof node, { type: 'RegularElement' }> =>
						node.type === 'RegularElement' && node.name === 'html'
				);
				if (!root) {
					console.warn(
						'svelte-dialect: no <html> element in src/app.html; add lang="%dialect.lang%" dir="%dialect.dir%" to it'
					);
					return false;
				}
				html.addAttribute(root, 'lang', '%dialect.lang%');
				html.addAttribute(root, 'dir', '%dialect.dir%');
			})
		);
	},

	nextSteps: ({ isKit, options }) =>
		[
			`Translate ${color.path('src/lib/messages/<locale>/common.json')} and render a message: ${color.command("{t('common:greeting', { name: 'world' })}")}`,
			isKit &&
				options.routing &&
				`Link with ${color.command("localizeHref('/about')")} so links keep the locale prefix`,
			`Docs: ${color.website('https://krowten.github.io/svelte-dialect/')}`
		].filter((line): line is string => typeof line === 'string')
});
