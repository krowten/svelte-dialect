<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# Message files

One flat or nested JSON object per namespace, one file per locale. Keys are namespace:dot.path; nested objects flatten into dot paths.

## Layout and keys

src/lib/messages/<locale>/<namespace>.json. { "nav": { "home": "Home" } } becomes t('common:nav.home').

src/lib/messages/en/common.json 

```ts
{ "nav": { "home": "Home" } }

t('common:nav.home') // → "Home"
```

## Parameters

{$name} interpolates a value passed as the second argument to t.

```ts
// message
{ "greeting": "Hello, {$name}!" }

t('home:greeting', { name: 'Kat' }) // → "Hello, Kat!"
```

## Plurals and selectors

MF2's .match picks a branch from the value — plural categories, not just one/other, and they come from the locale's own rules, not from the library.

```json
{
	"items": ".input {$count :number}\n.match $count\none {{{$count} item}}\n* {{{$count} items}}"
}
```

1 item · 3 items · 5 items

## Numbers, dates and money

Formatting is Intl under an MF2 spelling: the same message renders €1,234.50 in English and 1.234,50 € in German with nothing locale-specific in your code. Available in every message: :number, :integer, :offset, :string (required), plus :currency, :date, :datetime, :time, :percent, :unit (draft).

```json
{
	"price": "Total: {$amount :currency currency=EUR}",
	"due": "Due {$when :date length=long}"
}
```

Total: €1,234.50 · Due September 30, 2026

## When a message misbehaves

Nothing throws. A source that doesn't compile renders as its own key; a missing parameter leaves MF2's fallback text. A key missing from the active locale walks a chain: same-language siblings, then defaultLocale, then the key itself.

```ts
createDialect({
	defaultLocale: 'en',
	onError: (error, { key, locale }) => report(error, { key, locale })
});
```
