import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

// Every sample and every piece of command output below comes from a real run of
// `svelte-dialect migrate` / `typegen` / `check` on small projects, not from memory.

const INSTALL = `npm install svelte-dialect`;

const LAYOUT = `src/lib/messages/
  en/common.json   # was en.json
  ru/common.json   # was ru.json`;

const FLAT_RUN = `$ npx svelte-dialect migrate
  src/lib/messages/en.json: skipped — it sits directly in the messages directory. Move it to en/common.json (any namespace name works)
  src/lib/messages/ru.json: skipped — it sits directly in the messages directory. Move it to ru/common.json (any namespace name works)
svelte-dialect migrate: 0 messages converted, 2 warnings
svelte-dialect migrate: nothing was migrated — move each <locale>.json into <locale>/<namespace>.json
$ echo $?
1`;

const DRY_RUN = `npx svelte-dialect migrate --dry-run`;

const ICU_BEFORE = `// src/lib/messages/en/common.json
{
	"greeting": "Hello, {name}!",
	"cart": {
		"items": "{count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}"
	},
	"invite": "{gender, select, female {She invited you} male {He invited you} other {They invited you}}"
}`;

const ICU_RUN = `$ npx svelte-dialect migrate --dry-run
svelte-dialect migrate: en/common.json — 3 converted, 0 unchanged, 0 warnings
  greeting
  - Hello, {name}!
  + Hello, {$name}!
  cart.items
  - {count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}
  + .input {$count :number}
  + .match $count
  + 0 {{Your cart is empty}}
  + one {{{$count} item in your cart}}
  + * {{{$count} items in your cart}}
  invite
  - {gender, select, female {She invited you} male {He invited you} other {They invited you}}
  + .input {$gender :string}
  + .match $gender
  + female {{She invited you}}
  + male {{He invited you}}
  + * {{They invited you}}
svelte-dialect migrate: 3 messages would change, 0 warnings (dry run, nothing written)`;

const I18NEXT_BEFORE = `// src/lib/messages/en/common.json
{
	"welcome": "Welcome, {{name}}!",
	"item_one": "{{count}} item",
	"item_other": "{{count}} items",
	"inbox_zero": "Inbox zero",
	"inbox_one": "One message",
	"inbox_other": "{{count}} messages",
	"rank_ordinal_one": "{{count}}st place",
	"rank_ordinal_two": "{{count}}nd place",
	"rank_ordinal_few": "{{count}}rd place",
	"rank_ordinal_other": "{{count}}th place"
}`;

const I18NEXT_BEFORE_RU = `// src/lib/messages/ru/common.json
{
	"welcome": "Добро пожаловать, {{name}}!",
	"item_one": "{{count}} товар",
	"item_few": "{{count}} товара",
	"item_many": "{{count}} товаров",
	"item_other": "{{count}} товара"
}`;

const I18NEXT_RUN = `$ npx svelte-dialect migrate --dry-run
svelte-dialect migrate: en/common.json — 4 converted, 0 unchanged, 1 warnings
  welcome
  - Welcome, {{name}}!
  + Welcome, {$name}!
  item
  - item_*
  + .input {$count :number}
  + .match $count
  + one {{{$count} item}}
  + * {{{$count} items}}
  inbox
  - inbox_*
  + .input {$count :number}
  + .match $count
  + 0 {{Inbox zero}}
  + one {{One message}}
  + * {{{$count} messages}}
  rank_ordinal
  - rank_ordinal_*
  + .input {$count :number select=ordinal}
  + .match $count
  + one {{{$count}st place}}
  + two {{{$count}nd place}}
  + few {{{$count}rd place}}
  + * {{{$count}th place}}
  common.json: rank_ordinal: i18next ordinal plural converted to ":number select=ordinal" — call t('common:rank_ordinal', { count }) instead of t('common:rank', { count, ordinal: true })
svelte-dialect migrate: ru/common.json — 2 converted, 0 unchanged, 0 warnings
  welcome
  - Добро пожаловать, {{name}}!
  + Добро пожаловать, {$name}!
  item
  - item_*
  + .input {$count :number}
  + .match $count
  + one {{{$count} товар}}
  + few {{{$count} товара}}
  + many {{{$count} товаров}}
  + * {{{$count} товара}}
svelte-dialect migrate: 6 messages would change, 1 warnings (dry run, nothing written)`;

const CONSTRUCTS = [
	{ id: 'placeholder', from: 'Hello, {name}!', to: 'Hello, {$name}!' },
	{ id: 'unescaped', from: '{{- html}}', to: '{$html}' },
	{ id: 'number', from: 'Score: {score, number, integer}', to: 'Score: {$score :integer}' },
	{ id: 'date', from: 'Due {d, date, short}', to: 'Due {$d :date length=short}' },
	{ id: 'time', from: 'At {d, time, medium}', to: 'At {$d :time precision=second}' },
	{ id: 'percent', from: '{n, number, ::percent} done', to: '{$n :percent} done' },
	{ id: 'html', from: 'Read <b>this</b> first', to: 'Read {#b}this{/b} first' },
	{
		id: 'quoted',
		from: "Type '{'name'}' to insert a name",
		to: 'Type \\{name\\} to insert a name'
	},
	{
		id: 'nested',
		from: '{count, plural, one {{gender, select, male {He has one hat} other {They have one hat}}} other {{gender, select, male {He has # hats} other {They have # hats}}}}',
		to: `.input {$count :number}
.input {$gender :string}
.match $count $gender
one male {{He has one hat}}
one * {{They have one hat}}
* male {{He has {$count} hats}}
* * {{They have {$count} hats}}`
	}
];

const HARD_BEFORE = `// src/lib/messages/en/common.json
{
	"total": "Total: {$total :currency}",
	"price": "Total: {$price :currency}",
	"place": ".input {$place :number select=ordinal}\\n.match $place\\none {{You finished {$place}st}}\\ntwo {{You finished {$place}nd}}\\nfew {{You finished {$place}rd}}\\n* {{You finished {$place}th}}",
	"views": "{$views :number} views",
	"spell": "{n, spellout} items",
	"people": "{n, plural, offset:1 =0 {Nobody} other {# people}}",
	"shout": "{$name}",
	"friend": "A friend",
	"friend_male": "A boyfriend",
	"friend_female": "A girlfriend",
	"back": "Back to $t(welcome)",
	"docs": "Read the <a href=\\"/docs\\">docs</a>"
}`;

const HARD_RUN = `$ npx svelte-dialect migrate
svelte-dialect migrate: en/common.json — 5 converted, 7 unchanged, 10 warnings
  common.json: total: "total" became :currency, which needs a code — write {$total :currency currency=EUR} or pass one at runtime
  common.json: price: "price" became :currency, which needs a code — write {$price :currency currency=EUR} or pass one at runtime
  common.json: place: "place" used ICU selectordinal — converted to ":number select=ordinal"; MF2 ordinal categories can differ, review the arms
  common.json: views: style "::compact-short" dropped from "{views, number, ::compact-short}"
  common.json: spell: unsupported ICU type "spellout"
  common.json: people: plural offset is not supported
  common.json: shout: format "uppercase" dropped from "{{name, uppercase}}" — "name" is now a plain {$name}
  common.json: back: i18next nesting "$t(…)" has no MF2 equivalent — pass the other translation in as a parameter, or split the message
  common.json: docs: HTML <a href="/docs"> left as text — markup carries no attributes. Write {#name}…{/name}, render it with the Rich component and set the attributes in its snippet
  common.json: friend: "friend_male", "friend_female" look like i18next context variants — MF2 handles context with a .match on a parameter; ignore this if they are separate messages
svelte-dialect migrate: 5 messages converted, 10 warnings`;

const STRICT_RUN = `$ npx svelte-dialect migrate --strict
svelte-dialect migrate: en/common.json — 0 converted, 12 unchanged, 5 warnings
  common.json: spell: unsupported ICU type "spellout"
  common.json: people: plural offset is not supported
  common.json: back: i18next nesting "$t(…)" has no MF2 equivalent — pass the other translation in as a parameter, or split the message
  common.json: docs: HTML <a href="/docs"> left as text — markup carries no attributes. Write {#name}…{/name}, render it with the Rich component and set the attributes in its snippet
  common.json: friend: "friend_male", "friend_female" look like i18next context variants — MF2 handles context with a .match on a parameter; ignore this if they are separate messages
svelte-dialect migrate: 0 messages converted, 5 warnings
svelte-dialect migrate: --strict: 5 warnings, exiting with 1
$ echo $?
1`;

const WARNINGS = [
	{ id: 'currency', signal: '"total" became :currency, which needs a code' },
	{ id: 'ordinal', signal: '"place" used ICU selectordinal' },
	{
		id: 'style',
		signal: 'style "::compact-short" dropped from "{views, number, ::compact-short}"'
	},
	{
		id: 'unsupported',
		signal: 'unsupported ICU type "spellout"\nplural offset is not supported'
	},
	{ id: 'format', signal: 'format "uppercase" dropped from "{{name, uppercase}}"' },
	{ id: 'nesting', signal: 'i18next nesting "$t(…)" has no MF2 equivalent' },
	{ id: 'html', signal: 'HTML <a href="/docs"> left as text' },
	{
		id: 'context',
		signal: '"friend_male", "friend_female" look like i18next context variants'
	},
	{
		id: 'ordinalkey',
		signal: 'i18next ordinal plural converted to ":number select=ordinal"'
	}
];

const CONTEXT = `// src/lib/messages/en/common.json
{
	"friend": ".input {$context :string}\\n.match $context\\nmale {{A boyfriend}}\\nfemale {{A girlfriend}}\\n* {{A friend}}"
}

t('common:friend', { context: 'male' }) // → "A boyfriend"`;

const NESTING = `// src/lib/messages/en/common.json
{ "back": "Back to {$welcome}" }

t('common:back', { welcome: t('common:welcome', { name }) })`;

const SI_MODULE_BEFORE = `// src/lib/i18n.ts
import { init, register, getLocaleFromNavigator } from 'svelte-i18n';

register('en', () => import('./locales/en.json'));
register('ru', () => import('./locales/ru.json'));

init({ fallbackLocale: 'en', initialLocale: getLocaleFromNavigator() });`;

const SI_MODULE_AFTER = `// src/lib/i18n.ts
import { createDialect } from 'svelte-dialect/kit';

export const { t, loadTranslations, getLocale, setLocale, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en',
	locales: ['en', 'ru']
});`;

const SI_COMPONENT_BEFORE = `<script>
	import { _, locale } from 'svelte-i18n';
</script>

<h1>{$_('cart.items', { values: { count: 3 } })}</h1>
<button onclick={() => locale.set('ru')}>RU</button>`;

const SI_COMPONENT_AFTER = `<script lang="ts">
	import { t, setLocale } from '#lib/i18n.js';
</script>

<h1>{t('common:cart.items', { count: 3 })}</h1>
<button onclick={() => setLocale('ru')}>RU</button>`;

const SI_ROWS = [
	{
		id: 'init',
		from: 'init({ fallbackLocale, initialLocale })',
		to: 'createDialect({ defaultLocale, locales })'
	},
	{
		id: 'add',
		from: "addMessages('en', dict)",
		to: "messages: import.meta.glob('./messages/**/*.json', { eager: true })"
	},
	{
		id: 'register',
		from: "register('en', () => import('./en.json'))",
		to: "messages: import.meta.glob('./messages/**/*.json')"
	},
	{ id: 'wait', from: 'await waitLocale()', to: "await loadTranslations('common')" },
	{ id: 'format', from: "$_('a.b', { values: { n } })", to: `t('common:a.b', { n })` },
	{ id: 'locale', from: '$locale', to: 'getLocale()' },
	{ id: 'set', from: "locale.set('de')", to: "setLocale('de')" },
	{ id: 'locales', from: '$locales', to: 'locales' },
	{
		id: 'formatters',
		from: '$number(n), $date(d), $time(d)',
		to: 'formatNumber(n, options), formatDate(d, options)'
	},
	{
		id: 'initial',
		from: 'getLocaleFromNavigator(), getLocaleFromPathname()',
		to: "strategy: ['url', 'cookie', 'navigator', 'default']"
	},
	{ id: 'loading', from: '$isLoading', to: null },
	{ id: 'json', from: "$json('list.items')", to: null },
	{ id: 'default', from: "$_('key', { default: '…' })", to: null }
];

const I18NEXT_ROWS = [
	{
		id: 'init',
		from: 'i18next.init({ lng, fallbackLng, resources })',
		to: 'createDialect({ defaultLocale, locales, messages })'
	},
	{ id: 't', from: `i18next.t('ns:key', { count })`, to: `t('ns:key', { count })` },
	{
		id: 'ordinal',
		from: `i18next.t('rank', { count, ordinal: true })`,
		to: `t('common:rank_ordinal', { count })`
	},
	{ id: 'ns', from: "i18next.t('key')", to: `t('translation:key')` },
	{ id: 'change', from: "await i18next.changeLanguage('de')", to: "setLocale('de')" },
	{ id: 'load', from: "i18next.loadNamespaces('ns')", to: "await loadTranslations('common')" },
	{
		id: 'context',
		from: "t('friend', { context: 'male' })",
		to: `t('common:friend', { context: 'male' })`
	},
	{ id: 'dir', from: 'i18next.dir()', to: 'getTextDirection()' },
	{ id: 'fixed', from: "i18next.getFixedT(null, 'ns')", to: null },
	{ id: 'escape', from: 'interpolation.escapeValue', to: null }
];

const VERIFY = `$ npx svelte-dialect typegen
svelte-dialect typegen: 3 keys → src/lib/i18n-keys.d.ts

$ npx svelte-dialect check
Missing:
  common:cart.items — missing in ru
  common:cart.itms — missing in en, ru
  common:invite — missing in ru
4 keys used, 3 missing`;

const PARAMS = `// src/lib/i18n-keys.d.ts (generated)
export type MessageParams = {
	'common:cart.items': { count: number | string };
	'common:greeting': { name: unknown };
	'common:invite': { gender: string };
};`;

export const load: PageServerLoad = async () => ({
	installCode: await highlight(INSTALL, 'sh'),
	layoutCode: await highlight(LAYOUT, 'sh'),
	flatRunCode: await highlight(FLAT_RUN, 'sh'),
	dryRunCode: await highlight(DRY_RUN, 'sh'),
	icuBeforeCode: await highlight(ICU_BEFORE, 'jsonc'),
	icuRunCode: await highlight(ICU_RUN, 'sh'),
	i18nextBeforeCode: await highlight(I18NEXT_BEFORE, 'jsonc'),
	i18nextBeforeRuCode: await highlight(I18NEXT_BEFORE_RU, 'jsonc'),
	i18nextRunCode: await highlight(I18NEXT_RUN, 'sh'),
	constructs: CONSTRUCTS,
	hardBeforeCode: await highlight(HARD_BEFORE, 'jsonc'),
	hardRunCode: await highlight(HARD_RUN, 'sh'),
	warnings: WARNINGS,
	contextCode: await highlight(CONTEXT, 'ts'),
	nestingCode: await highlight(NESTING, 'ts'),
	strictRunCode: await highlight(STRICT_RUN, 'sh'),
	siModuleBeforeCode: await highlight(SI_MODULE_BEFORE, 'ts'),
	siModuleAfterCode: await highlight(SI_MODULE_AFTER, 'ts'),
	siComponentBeforeCode: await highlight(SI_COMPONENT_BEFORE, 'svelte'),
	siComponentAfterCode: await highlight(SI_COMPONENT_AFTER, 'svelte'),
	siRows: SI_ROWS,
	i18nextRows: I18NEXT_ROWS,
	verifyCode: await highlight(VERIFY, 'sh'),
	paramsCode: await highlight(PARAMS, 'ts')
});
