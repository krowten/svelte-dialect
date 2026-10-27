<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Migrate to MessageFormat 2 from svelte-i18n and i18next

Run svelte-dialect migrate on your translation files and they come out as MessageFormat 2\. Anything the converter can't turn into valid MF2 stays as it was, with a warning. This page follows one migration from start to finish, using real output from the command.

## Who this is for

Apps whose translations are ICU MessageFormat strings, which is what svelte-i18n and formatjs use, or i18next JSON with {{name}} placeholders and key\_one / key\_other plurals. MessageFormat 2 is the Unicode successor to ICU MessageFormat. Plurals, selects and number formatting carry over with a different syntax. The CLI rewrites the message files, and step 4 maps the runtime calls.

## 1\. Install

Install svelte-dialect next to your current library. The converter only reads and writes message files, so both can live in the project while you switch over.

```sh
npm install svelte-dialect
```

### File layout

The CLI expects src/lib/messages/<locale>/<namespace>.json, the same layout the runtime reads. i18next's locales/<lng>/<ns>.json already has that shape. svelte-i18n keeps one en.json per language, so move each into a folder and the file name becomes the namespace. Locale folders are BCP 47 tags, so pt-BR and zh-Hant work as they are. A folder named zh\_CN is skipped, and the command warns and tells you to rename it to zh-CN.

```sh
src/lib/messages/
  en/common.json   # was en.json
  ru/common.json   # was ru.json
```

A <locale>.json file left directly in the messages directory is skipped with a warning. If that leaves nothing to migrate, the command exits with 1:

```sh
$ npx svelte-dialect migrate
  src/lib/messages/en.json: skipped — it sits directly in the messages directory. Move it to en/common.json (any namespace name works)
  src/lib/messages/ru.json: skipped — it sits directly in the messages directory. Move it to ru/common.json (any namespace name works)
svelte-dialect migrate: 0 messages converted, 2 warnings
svelte-dialect migrate: nothing was migrated — move each <locale>.json into <locale>/<namespace>.json
$ echo $?
1
```

## 2\. Run the converter

Commit first, so the diff shows what changed. Then do a dry run, which prints every change as a before and after pair and writes nothing:

```sh
npx svelte-dialect migrate --dry-run
```

Without --dry-run the files are written. --messages <dir> sets another directory and can be repeated; the default is src/lib/messages. A file is rewritten, as tab-indented JSON, only when at least one of its messages changed. Warnings go to stderr. The exit code is 0, unless you pass --strict or the directory holds only flat <locale>.json files. A second run changes nothing, so you can run it again after fixing things by hand. Every flag and exit code is in the [CLI reference](https://krowten.github.io/svelte-dialect/cli.md).

The converter compiles every result with the MF2 parser before keeping it. If the result doesn't parse, or the source uses something the converter doesn't know, the original string stays in the file and a warning names the file and the key.

### ICU MessageFormat (svelte-i18n, formatjs)

svelte-i18n messages are ICU strings. Take this file:

src/lib/messages/en/common.json 

```jsonc
{
	"greeting": "Hello, {name}!",
	"cart": {
		"items": "{count, plural, =0 {Your cart is empty} one {# item in your cart} other {# items in your cart}}"
	},
	"invite": "{gender, select, female {She invited you} male {He invited you} other {They invited you}}"
}
```

```sh
$ npx svelte-dialect migrate --dry-run
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
svelte-dialect migrate: 3 messages would change, 0 warnings (dry run, nothing written)
```

The plural becomes one .match message. Arms turn into variants, =0 into the exact key 0, other into the catch-all \*, and # into {$count}. A select works the same way, with :string in place of :number.

### i18next

i18next spreads one plural across sibling keys. The converter gathers them into a single message per locale and keeps the plural categories you wrote, so the Russian file below gets four forms:

src/lib/messages/en/common.json 

```jsonc
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
}
```

src/lib/messages/ru/common.json 

```jsonc
{
	"welcome": "Добро пожаловать, {{name}}!",
	"item_one": "{{count}} товар",
	"item_few": "{{count}} товара",
	"item_many": "{{count}} товаров",
	"item_other": "{{count}} товара"
}
```

```sh
$ npx svelte-dialect migrate --dry-run
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
svelte-dialect migrate: 6 messages would change, 1 warnings (dry run, nothing written)
```

item\_one and item\_other became item. An \_zero key is i18next's special case for a count of exactly 0\. The converter follows that: inbox\_zero turns into the exact variant 0, not the zero category, which most languages don't have. Ordinal plurals are keyed differently. rank\_ordinal\_one, rank\_ordinal\_two and the rest become one message named rank\_ordinal that selects with select=ordinal, so 2 renders as 2nd. i18next found them with t('rank', {count, ordinal: true}); the new call is t('common:rank\_ordinal', {count}), and the warning says so. A cardinal rank\_one and rank\_other next to them still converts to rank.

### What gets converted

The converter has its own parser for the part of ICU and i18next that real catalogs use: arguments, number, date and time, plural, selectordinal, select, # and apostrophe escaping, i18next's double-brace placeholders, and HTML tags without attributes. It doesn't cover the whole ICU grammar.

| Before                                                                                                                                                           | After                                                                                                                                                                                              | Notes                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hello, {name}!                                                                                                                                                   | Hello, {$name}!                                                                                                                                                                                    | Plain placeholders. i18next's {{name}} converts the same way.                                                                                                                                               |
| {{- html}}                                                                                                                                                       | {$html}                                                                                                                                                                                            | i18next's unescaped placeholder. MF2 doesn't HTML-escape values, so there is nothing to opt out of.                                                                                                         |
| Score: {score, number, integer}                                                                                                                                  | Score: {$score :integer}                                                                                                                                                                           | The number styles integer and percent, the ::percent skeleton and currency map to the function of the same name. So do i18next's number, integer, currency, percent, date, time, datetime and unit formats. |
| Due {d, date, short}                                                                                                                                             | Due {$d :date length=short}                                                                                                                                                                        | The date styles short, medium and long become the length option. full has no length of its own, so it adds the weekday: fields=year-month-day-weekday together with length=long.                            |
| At {d, time, medium}                                                                                                                                             | At {$d :time precision=second}                                                                                                                                                                     | The :time function has no styles. short is its default, medium adds seconds with precision=second, and long and full add the time zone name with timeZoneStyle=short and timeZoneStyle=long.                |
| {n, number, ::percent} done                                                                                                                                      | {$n :percent} done                                                                                                                                                                                 | ::percent is the only number skeleton that :percent covers. Any other skeleton still gets a warning.                                                                                                        |
| Read <b>this</b> first                                                                                                                                           | Read {#b}this{/b} first                                                                                                                                                                            | Tags without attributes become MF2 markup, <br/> included, and a warning lists them. Tags with attributes stay as text; see step 3.                                                                         |
| Type '{'name'}' to insert a name                                                                                                                                 | Type \\{name\\} to insert a name                                                                                                                                                                   | ICU's apostrophe quoting becomes a backslash.                                                                                                                                                               |
| {count, plural, one {{gender, select, male {He has one hat} other {They have one hat}}} other {{gender, select, male {He has # hats} other {They have # hats}}}} | .input {$count :number} .input {$gender :string} .match $count $gender one male {{He has one hat}} one \* {{They have one hat}} \* male {{He has {$count} hats}} \* \* {{They have {$count} hats}} | A select nested inside a plural flattens into one .match over both variables, with a variant for every combination, up to 64 variants.                                                                      |

## 3\. Fix what the converter flagged

This file holds the problems the converter can't solve by itself. The output is from a real run:

src/lib/messages/en/common.json 

```jsonc
{
	"total": "Total: {$total :currency}",
	"price": "Total: {$price :currency}",
	"place": ".input {$place :number select=ordinal}\n.match $place\none {{You finished {$place}st}}\ntwo {{You finished {$place}nd}}\nfew {{You finished {$place}rd}}\n* {{You finished {$place}th}}",
	"views": "{$views :number} views",
	"spell": "{n, spellout} items",
	"people": "{n, plural, offset:1 =0 {Nobody} other {# people}}",
	"shout": "{$name}",
	"friend": "A friend",
	"friend_male": "A boyfriend",
	"friend_female": "A girlfriend",
	"back": "Back to $t(welcome)",
	"docs": "Read the <a href=\"/docs\">docs</a>"
}
```

```sh
$ npx svelte-dialect migrate
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
svelte-dialect migrate: 5 messages converted, 10 warnings
```

Each warning, and what to do about it:

| Warning                                                                 | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "total" became :currency, which needs a code                            | MF2 can't format a currency without a code, and neither ICU nor i18next supplied one. Put the code in the message, as in {$total :currency currency=EUR}. The same message then renders €1,234.50 in English and 1.234,50 € in German.                                                                                                                                                                                                                                                  |
| "place" used ICU selectordinal                                          | The message is converted, with the arms copied as written. Check them against the ordinal categories of every locale you ship. English uses one, two, few and the catch-all; other languages use different ones.                                                                                                                                                                                                                                                                        |
| style "::compact-short" dropped from "{views, number, ::compact-short}" | The converter maps the ICU date and time styles and the percent style. What it can't map is dropped, so the value formats with the defaults: custom date patterns such as dd/MM/yyyy, and number skeletons such as ::compact-short. For a date, put the fields back by hand, for example {$due :date fields=month-day}. The :number function in messageformat has no compact notation, so there is no option to add. Format the value in code with formatNumber and pass in the string. |
| unsupported ICU type "spellout" plural offset is not supported          | These strings stay in ICU form, which isn't valid MF2, so at runtime the key shows instead of the text. Rewrite them by hand. For an offset, work out the adjusted number in code and pass it as its own parameter.                                                                                                                                                                                                                                                                     |
| format "uppercase" dropped from "{{name, uppercase}}"                   | The format is dropped and the value stays as a plain variable, here {$name}. Transform the value in code before you pass it, or register a function through the functions option and call it in the message.                                                                                                                                                                                                                                                                            |
| i18next nesting "$t(…)" has no MF2 equivalent                           | MF2 messages can't include one another. The text stays as it was and prints the $t(…) call literally. Pass the other translation in as a parameter, or write the words out, as below.                                                                                                                                                                                                                                                                                                   |
| HTML <a href="/docs"> left as text                                      | MF2 markup has no attributes. Write {#a}docs{/a} in the message, render it with the Rich component, and set the href in the snippet. Tags without attributes were converted already, and the warning lists them.                                                                                                                                                                                                                                                                        |
| "friend\_male", "friend\_female" look like i18next context variants     | The variants are separate keys, and nothing looks them up, because MF2 has no context argument. Merge them into one message that matches on a parameter, as below. If the keys are unrelated messages that happen to share a prefix, ignore the warning.                                                                                                                                                                                                                                |
| i18next ordinal plural converted to ":number select=ordinal"            | Nothing to change in the file. Update the call sites from t('rank', {count, ordinal: true}) to t('common:rank\_ordinal', {count}). The arms are copied as written, so check them against the ordinal categories of each locale.                                                                                                                                                                                                                                                         |

### Context, nesting and links by hand

Context. friend\_male and friend\_female stay separate keys. In MF2 one message selects on a variable, so context becomes an ordinary parameter:

src/lib/messages/en/common.json 

```ts
{
	"friend": ".input {$context :string}\n.match $context\nmale {{A boyfriend}}\nfemale {{A girlfriend}}\n* {{A friend}}"
}

t('common:friend', { context: 'male' }) // → "A boyfriend"
```

Nesting. MF2 messages can't include one another, so pass the other translation in as a parameter, or write the words out:

src/lib/messages/en/common.json 

```ts
{ "back": "Back to {$welcome}" }

t('common:back', { welcome: t('common:welcome', { name }) })
```

Links. MF2 has its own markup, {#link}docs{/link}, which the [Rich component](https://krowten.github.io/svelte-dialect/rich-text.md) renders through snippets. That is where an href goes.

### Fail CI on warnings

By default warnings don't change the exit code. Add --strict and the command exits with 1 when it printed any warning, so it can gate a pipeline. Pair it with --dry-run to check a branch without writing files. This is a second run over the file above, after the first run converted what it could:

```sh
$ npx svelte-dialect migrate --strict
svelte-dialect migrate: en/common.json — 0 converted, 12 unchanged, 5 warnings
  common.json: spell: unsupported ICU type "spellout"
  common.json: people: plural offset is not supported
  common.json: back: i18next nesting "$t(…)" has no MF2 equivalent — pass the other translation in as a parameter, or split the message
  common.json: docs: HTML <a href="/docs"> left as text — markup carries no attributes. Write {#name}…{/name}, render it with the Rich component and set the attributes in its snippet
  common.json: friend: "friend_male", "friend_female" look like i18next context variants — MF2 handles context with a .match on a parameter; ignore this if they are separate messages
svelte-dialect migrate: 0 messages converted, 5 warnings
svelte-dialect migrate: --strict: 5 warnings, exiting with 1
$ echo $?
1
```

Warnings about strings that are still unconverted come back on every run. A warning about a conversion, such as the missing currency code, appears once, on the run that did it. To see everything, run --strict --dry-run before the first real run.

## 4\. Replace the runtime calls

The CLI only touches message files, so your components still call the old library. svelte-dialect has no stores. t, getLocale and the formatters are plain functions that follow a locale rune, so templates lose the $ prefix and still update when the locale changes.

Every key carries its namespace, as in t('common:cart.items'). The file name is the namespace, and nested objects flatten into dot paths. A key without a colon isn't looked up, and t returns it unchanged.

### From svelte-i18n

svelte-i18n configures a global store. svelte-dialect builds its functions once, in src/lib/i18n.ts, and you import them from there.

src/lib/i18n.ts 

```ts
import { init, register, getLocaleFromNavigator } from 'svelte-i18n';

register('en', () => import('./locales/en.json'));
register('ru', () => import('./locales/ru.json'));

init({ fallbackLocale: 'en', initialLocale: getLocaleFromNavigator() });
```

src/lib/i18n.ts 

```ts
import { createDialect } from 'svelte-dialect/kit';

export const { t, loadTranslations, getLocale, setLocale, locales } = createDialect({
	messages: import.meta.glob('./messages/**/*.json', { eager: true }),
	defaultLocale: 'en',
	locales: ['en', 'ru']
});
```

In SvelteKit, add the hooks from [Setup](https://krowten.github.io/svelte-dialect/setup.md). The handle hook negotiates the locale on the server.

In components, $\_ becomes t, the values wrapper disappears and the key gains its namespace:

```svelte
<script>
	import { _, locale } from 'svelte-i18n';
</script>

<h1>{$_('cart.items', { values: { count: 3 } })}</h1>
<button onclick={() => locale.set('ru')}>RU</button>
```

```svelte
<script lang="ts">
	import { t, setLocale } from '#lib/i18n.ts';
</script>

<h1>{t('common:cart.items', { count: 3 })}</h1>
<button onclick={() => setLocale('ru')}>RU</button>
```

The rest of the API:

| svelte-i18n                                       | svelte-dialect                                                         | Notes                                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| init({ fallbackLocale, initialLocale })           | createDialect({ defaultLocale, locales })                              | defaultLocale is the fallback. A key missing from the active locale falls back to same-language siblings, then to it.                                                              |
| addMessages('en', dict)                           | messages: import.meta.glob('./messages/\*\*/\*.json', { eager: true }) | Bundled at build time.                                                                                                                                                             |
| register('en', () => import('./en.json'))         | messages: import.meta.glob('./messages/\*\*/\*.json')                  | Without eager, each namespace is its own chunk. The loader option fetches from an API instead.                                                                                     |
| await waitLocale()                                | await loadTranslations('common')                                       | Only needed for lazy or fetched namespaces. It resolves with t, and refetches when the locale changes.                                                                             |
| $\_('a.b', { values: { n } })                     | t('common:a.b', { n })                                                 | $t and $format are the same function. The values are the second argument itself.                                                                                                   |
| $locale                                           | getLocale()                                                            | Reactive in templates and effects, no store needed.                                                                                                                                |
| locale.set('de')                                  | setLocale('de')                                                        | With URL routing on, setLocale navigates to the prefixed URL. Pass { reload: false } to handle navigation yourself.                                                                |
| $locales                                          | locales                                                                | The selectable locales.                                                                                                                                                            |
| $number(n), $date(d), $time(d)                    | formatNumber(n, options), formatDate(d, options)                       | Both use Intl. $time is formatDate with hour and minute options, and named formats like medium become options objects or MF2 options such as length=long.                          |
| getLocaleFromNavigator(), getLocaleFromPathname() | strategy: \['url', 'cookie', 'navigator', 'default'\]                  | Sources are tried in order. There is no built-in counterpart for getLocaleFromHostname, getLocaleFromQueryString or getLocaleFromHash: read the value yourself and call setLocale. |
| $isLoading                                        | (none)                                                                 | loadTranslations returns a promise. Await it in a load function instead of showing a spinner.                                                                                      |
| $json('list.items')                               | (none)                                                                 | Messages are strings. Arrays and other non-string values are dropped when the catalog loads, so keep list data in code or use one key per item.                                    |
| $\_('key', { default: '…' })                      | (none)                                                                 | A missing key falls back along the locale chain and finally renders as the key. check catches static keys before that.                                                             |

### From i18next

The calls are closer, because t('ns:key', params) already looks the same. Rewrite the setup, then the places that go around t:

| i18next                                       | svelte-dialect                                      | Notes                                                                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| i18next.init({ lng, fallbackLng, resources }) | createDialect({ defaultLocale, locales, messages }) | messages takes the same files you already have, laid out as in step 1.                                                                                                                    |
| i18next.t('ns:key', { count })                | t('ns:key', { count })                              | Same ns:key and dot-path conventions.                                                                                                                                                     |
| i18next.t('rank', { count, ordinal: true })   | t('common:rank\_ordinal', { count })                | The ordinal flag becomes a key suffix. The migration warns for every ordinal group it converts.                                                                                           |
| i18next.t('key')                              | t('translation:key')                                | There is no default namespace. i18next calls its default namespace translation, so write the namespace in every key, or rename the file.                                                  |
| await i18next.changeLanguage('de')            | setLocale('de')                                     | Synchronous. Lazy namespaces refetch on their own.                                                                                                                                        |
| i18next.loadNamespaces('ns')                  | await loadTranslations('common')                    | Only needed for lazy or fetched namespaces.                                                                                                                                               |
| t('friend', { context: 'male' })              | t('common:friend', { context: 'male' })             | After the hand conversion in step 3, context is an ordinary parameter. Name it whatever the message selects on.                                                                           |
| i18next.dir()                                 | getTextDirection()                                  | Returns ltr or rtl.                                                                                                                                                                       |
| i18next.getFixedT(null, 'ns')                 | (none)                                              | Keys always carry their namespace. Wrap t in your own function if you want a shortcut.                                                                                                    |
| interpolation.escapeValue                     | (none)                                              | i18next HTML-escapes interpolated values by default. svelte-dialect doesn't, because Svelte escapes the text it renders. Escape the values yourself before passing t() output to {@html}. |

## 5\. Check the result

Generate the key types from the migrated files and the parameter shapes come with them: the MF2 source says count is a number and gender a string. Then run check, which compares every t('…') call in your source with the catalogs. Here the source contains a typo, common:cart.itms, and the Russian file has only one of the three messages:

```sh
$ npx svelte-dialect typegen
svelte-dialect typegen: 3 keys → src/lib/i18n-keys.d.ts

$ npx svelte-dialect check
Missing:
  common:cart.items — missing in ru
  common:cart.itms — missing in en, ru
  common:invite — missing in ru
4 keys used, 3 missing
```

```ts
// src/lib/i18n-keys.d.ts (generated)
export type MessageParams = {
	'common:cart.items': { count: number | string };
	'common:greeting': { name: unknown };
	'common:invite': { gender: string };
};
```

check exits with 1 when a key you use is missing from any locale, so it fits a CI step. Both commands are covered in [Typed keys & CLI](https://krowten.github.io/svelte-dialect/typed-keys.md). Also read a few converted plurals in each language by eye. The converter keeps the categories you wrote, and it can't know which ones your language needs.

## Next

[Message files](https://krowten.github.io/svelte-dialect/messages.md) covers the MF2 syntax the converted files now use. [Loading messages](https://krowten.github.io/svelte-dialect/sources.md) replaces register and loaders, and [Locale in the URL](https://krowten.github.io/svelte-dialect/routing.md) replaces getLocaleFromPathname. [Compared to others](https://krowten.github.io/svelte-dialect/compare.md) puts svelte-dialect next to the other Svelte i18n libraries.
