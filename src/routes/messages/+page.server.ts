import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

const LAYOUT = `// src/lib/messages/en/common.json
{ "nav": { "home": "Home" } }

t('common:nav.home') // → "Home"`;

const PARAMS = `// message
{ "greeting": "Hello, {$name}!" }

t('home:greeting', { name: 'Kat' }) // → "Hello, Kat!"`;

const PLURALS = `{
	"items": ".input {$count :number}\\n.match $count\\none {{{$count} item}}\\n* {{{$count} items}}"
}`;

const NUMBERS = `{
	"price": "Total: {$amount :currency currency=EUR}",
	"due": "Due {$when :date length=long}"
}`;

const ERRORS = `createDialect({
	defaultLocale: 'en',
	onError: (error, { key, locale }) => report(error, { key, locale })
});`;

export const load: PageServerLoad = async () => ({
	layoutCode: await highlight(LAYOUT, 'ts'),
	paramsCode: await highlight(PARAMS, 'ts'),
	pluralsCode: await highlight(PLURALS, 'json'),
	numbersCode: await highlight(NUMBERS, 'json'),
	errorsCode: await highlight(ERRORS, 'ts')
});
