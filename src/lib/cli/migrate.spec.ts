import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageFormat } from 'messageformat';
import { DraftFunctions } from 'messageformat/functions';
import { runMigrate } from './migrate.js';

const FIXTURES: Record<string, unknown> = {
	plain: 'Just a sentence.',
	greeting: 'Hello {{name}}!',
	price: 'Total: {{price, currency}}',
	when: 'Sent {{sentAt, datetime}}',
	item_one: 'You have {{count}} item',
	item_other: 'You have {{count}} items',
	icuPlural: 'You have {count, plural, =0 {no items} one {# item} other {# items}}',
	icuSelect: '{gender, select, male {He} female {She} other {They}} replied',
	icuNumber: 'Score: {score, number, integer}',
	icuDate: 'Due {due, date, short}',
	icuOrdinal: 'You came {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
	nested: {
		combined:
			'{count, plural, one {{gender, select, male {He has one hat} other {They have one hat}}} other {{gender, select, male {He has # hats} other {They have # hats}}}}'
	},
	mf2Match: '.input {$count :number}\n.match $count\none {{One}}\n* {{Many}}',
	mf2Simple: 'Hi {$name}',
	quoted: "Use '{'braces'}' literally",
	malformed: 'Broken {count, plural, one {x}',
	exotic: 'Spelled {n, spellout}',
	notAMessage: 42
};

let dir: string;
let logs: string[];
let errors: string[];

const write = (path: string, data: unknown) =>
	writeFile(path, `${JSON.stringify(data, null, '\t')}\n`);

const read = async (locale: string, file: string) =>
	JSON.parse(await readFile(join(dir, locale, file), 'utf-8')) as Record<string, unknown>;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), 'svelte-dialect-migrate-'));
	await mkdir(join(dir, 'en'), { recursive: true });
	await mkdir(join(dir, 'assets'), { recursive: true });
	await write(join(dir, 'en', 'home.json'), FIXTURES);
	await write(join(dir, 'assets', 'home.json'), { greeting: 'Hello {{name}}!' });

	logs = [];
	errors = [];
	vi.spyOn(console, 'log').mockImplementation(
		(...args: unknown[]) => void logs.push(args.join(' '))
	);
	vi.spyOn(console, 'error').mockImplementation(
		(...args: unknown[]) => void errors.push(args.join(' '))
	);
});

afterEach(async () => {
	vi.restoreAllMocks();
	await rm(dir, { recursive: true, force: true });
});

/** Every string leaf of a migrated file, as `key → source`. */
const leaves = (obj: Record<string, unknown>, prefix = ''): [string, string][] =>
	Object.entries(obj).flatMap(([key, value]) =>
		typeof value === 'string'
			? [[prefix + key, value] as [string, string]]
			: value && typeof value === 'object'
				? leaves(value as Record<string, unknown>, `${prefix}${key}.`)
				: []
	);

describe('runMigrate', () => {
	it('converts i18next interpolation, with and without a format', async () => {
		expect(await runMigrate(['--messages', dir])).toBe(0);
		const home = await read('en', 'home.json');
		expect(home.greeting).toBe('Hello {$name}!');
		expect(home.price).toBe('Total: {$price :currency}');
		expect(home.when).toBe('Sent {$sentAt :datetime}');
		// :currency cannot format without a code, so the migration has to say so
		expect(errors.join('\n')).toMatch(/price: "price" became :currency, which needs a code/);
	});

	it('collapses i18next plural suffix siblings into one key', async () => {
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.item).toBe(
			'.input {$count :number}\n.match $count\none {{You have {$count} item}}\n* {{You have {$count} items}}'
		);
		expect(home).not.toHaveProperty('item_one');
		expect(home).not.toHaveProperty('item_other');
	});

	it('leaves a plural group without "_other" alone', async () => {
		await write(join(dir, 'en', 'partial.json'), { cat_one: 'A cat', cat_few: 'Some cats' });
		await runMigrate(['--messages', dir]);
		expect(await read('en', 'partial.json')).toEqual({ cat_one: 'A cat', cat_few: 'Some cats' });
	});

	it('converts an ICU plural, including "#" and an exact "=0" arm', async () => {
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.icuPlural).toBe(
			'.input {$count :number}\n.match $count\n0 {{You have no items}}\none {{You have {$count} item}}\n* {{You have {$count} items}}'
		);
	});

	it('converts an ICU select, mapping "other" to the catch-all', async () => {
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.icuSelect).toBe(
			'.input {$gender :string}\n.match $gender\nmale {{He replied}}\nfemale {{She replied}}\n* {{They replied}}'
		);
	});

	it('flattens a nested select inside a plural into one .match over both', async () => {
		await runMigrate(['--messages', dir]);
		const nested = (await read('en', 'home.json')).nested as Record<string, string>;
		expect(nested.combined).toBe(
			[
				'.input {$count :number}',
				'.input {$gender :string}',
				'.match $count $gender',
				'one male {{He has one hat}}',
				'one * {{They have one hat}}',
				'* male {{He has {$count} hats}}',
				'* * {{They have {$count} hats}}'
			].join('\n')
		);
	});

	it('converts selectordinal with a warning that the categories need review', async () => {
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.icuOrdinal).toContain('.input {$place :number select=ordinal}');
		expect(errors.join('\n')).toMatch(/icuOrdinal: .*selectordinal/);
	});

	it('maps the ICU styles it knows and drops the ones it does not, with a warning', async () => {
		await write(join(dir, 'en', 'styles.json'), {
			compact: '{n, number, ::compact-short} views',
			custom: 'Due {due, date, dd/MM/yyyy}'
		});
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.icuNumber).toBe('Score: {$score :integer}');
		expect(home.icuDate).toBe('Due {$due :date length=short}');
		expect(errors.join('\n')).toContain('compact: style "::compact-short" dropped');
		expect(errors.join('\n')).toContain('custom: style "dd/MM/yyyy" dropped');
		expect((await read('en', 'styles.json')).compact).toBe('{$n :number} views');
	});

	it('unquotes ICU apostrophe escaping into MF2 backslash escaping', async () => {
		await runMigrate(['--messages', dir]);
		expect((await read('en', 'home.json')).quoted).toBe('Use \\{braces\\} literally');
	});

	it('leaves plain strings, MF2 sources and non-strings untouched', async () => {
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.plain).toBe(FIXTURES.plain);
		expect(home.mf2Match).toBe(FIXTURES.mf2Match);
		expect(home.mf2Simple).toBe(FIXTURES.mf2Simple);
		expect(home.notAMessage).toBe(42);
	});

	it('leaves what it cannot parse as it was and reports it as file: key: reason', async () => {
		await runMigrate(['--messages', dir]);
		const home = await read('en', 'home.json');
		expect(home.malformed).toBe(FIXTURES.malformed);
		expect(home.exotic).toBe(FIXTURES.exotic);
		expect(errors).toContain('  home.json: malformed: unterminated arms');
		expect(errors).toContain('  home.json: exotic: unsupported ICU type "spellout"');
	});

	it('skips directories that do not look like a language tag', async () => {
		await runMigrate(['--messages', dir]);
		expect((await read('assets', 'home.json')).greeting).toBe('Hello {{name}}!');
	});

	it('is idempotent: a second run converts nothing', async () => {
		await runMigrate(['--messages', dir]);
		const first = await readFile(join(dir, 'en', 'home.json'), 'utf-8');
		logs = [];
		await runMigrate(['--messages', dir]);
		expect(await readFile(join(dir, 'en', 'home.json'), 'utf-8')).toBe(first);
		expect(logs.at(-1)).toContain('0 messages converted');
	});

	it('writes tab-indented JSON with a trailing newline', async () => {
		await runMigrate(['--messages', dir]);
		const raw = await readFile(join(dir, 'en', 'home.json'), 'utf-8');
		expect(raw).toMatch(/^\{\n\t"plain"/);
		expect(raw.endsWith('\n')).toBe(true);
	});

	it('prints a before/after diff and writes nothing with --dry-run', async () => {
		const before = await readFile(join(dir, 'en', 'home.json'), 'utf-8');
		expect(await runMigrate(['--messages', dir, '--dry-run'])).toBe(0);
		expect(await readFile(join(dir, 'en', 'home.json'), 'utf-8')).toBe(before);
		const out = logs.join('\n');
		expect(out).toContain('  - Hello {{name}}!');
		expect(out).toContain('  + Hello {$name}!');
		expect(out).toContain('dry run, nothing written');
	});

	it('reports converted, unchanged and warning counts per file', async () => {
		await runMigrate(['--messages', dir]);
		expect(logs).toContain(
			'svelte-dialect migrate: en/home.json — 11 converted, 5 unchanged, 4 warnings'
		);
		expect(logs.at(-1)).toBe('svelte-dialect migrate: 11 messages converted, 4 warnings');
	});

	it('fails loudly on an unreadable messages directory', async () => {
		await expect(runMigrate(['--messages', join(dir, 'nope')])).rejects.toThrow(
			'cannot read messages directory'
		);
	});

	it('converts i18next "_zero" to an exact-zero variant, not the "zero" plural category', async () => {
		await write(join(dir, 'en', 'zero.json'), {
			cart_zero: 'No items',
			cart_one: 'One item',
			cart_other: '{{count}} items'
		});
		await runMigrate(['--messages', dir]);
		const zero = await read('en', 'zero.json');
		const mf = new MessageFormat('en', zero.cart as string);
		expect(mf.format({ count: 0 })).toBe('No items');
		expect(mf.format({ count: 1 })).toBe('One item');
		expect(mf.format({ count: 5 })).toBe('5 items');
	});

	it('is idempotent for a literal backslash with no parameters', async () => {
		await write(join(dir, 'en', 'paths.json'), { winPath: 'C:\\temp' });
		await runMigrate(['--messages', dir]);
		const first = await read('en', 'paths.json');
		const firstMf = new MessageFormat('en', first.winPath as string);
		expect(firstMf.format()).toBe('C:\\temp');

		logs = [];
		await runMigrate(['--messages', dir]);
		expect(await read('en', 'paths.json')).toEqual(first);
		expect(logs.at(-1)).toContain('0 messages converted');
	});

	it('keeps a cardinal and an ordinal selector over the same variable distinct', async () => {
		await write(join(dir, 'en', 'mixed.json'), {
			ranking:
				'{n, plural, one {cardinal one} other {cardinal other}} / {n, selectordinal, one {ordinal one} two {ordinal two} few {ordinal few} other {ordinal other}}'
		});
		await runMigrate(['--messages', dir]);
		const mixed = await read('en', 'mixed.json');
		const mf = new MessageFormat('en', mixed.ranking as string);
		expect(mf.format({ n: 2 })).toBe('cardinal other / ordinal two');
	});

	it('leaves every written file parseable as MF2', async () => {
		await runMigrate(['--messages', dir]);
		for (const locale of await readdir(dir)) {
			for (const file of await readdir(join(dir, locale))) {
				for (const [key, source] of leaves(await read(locale, file))) {
					// unconvertible leftovers are the i18next/ICU originals; everything else must compile
					if (source === FIXTURES.malformed || source === FIXTURES.exotic) continue;
					if (source.includes('{{') && !source.includes('{$')) continue;
					expect(() => new MessageFormat(locale, source), `${locale}/${file} ${key}`).not.toThrow();
				}
			}
		}
	});
});

/** Formats an MF2 source with the function set the runtime registers. */
const fmt = (source: string, params: Record<string, unknown> = {}, locale = 'en') =>
	new MessageFormat(locale, source, { functions: DraftFunctions }).format(params);

/** Migrates one catalog and returns the migrated file (or the untouched one). */
const migrate = async (data: Record<string, unknown>, locale = 'en', args: string[] = []) => {
	await mkdir(join(dir, locale), { recursive: true });
	await write(join(dir, locale, 'extra.json'), data);
	const code = await runMigrate(['--messages', dir, ...args]);
	return { code, out: await read(locale, 'extra.json') };
};

const warned = () => errors.join('\n');

describe('runMigrate: i18next ordinal plurals', () => {
	const ordinals = {
		rank_ordinal_one: '{{count}}st place',
		rank_ordinal_two: '{{count}}nd place',
		rank_ordinal_few: '{{count}}rd place',
		rank_ordinal_other: '{{count}}th place'
	};

	it('selects on the ordinal category, not the cardinal one', async () => {
		const { out } = await migrate(ordinals);
		expect(out.rank_ordinal).toBe(
			'.input {$count :number select=ordinal}\n.match $count\none {{{$count}st place}}\ntwo {{{$count}nd place}}\nfew {{{$count}rd place}}\n* {{{$count}th place}}'
		);
		expect(out).not.toHaveProperty('rank_ordinal_one');
		const rendered = [1, 2, 3, 4, 11, 12, 21, 22].map((count) =>
			fmt(out.rank_ordinal as string, { count })
		);
		expect(rendered).toEqual([
			'1st place',
			'2nd place',
			'3rd place',
			'4th place',
			'11th place',
			'12th place',
			'21st place',
			'22nd place'
		]);
	});

	it('always warns which key to call', async () => {
		await migrate(ordinals);
		expect(warned()).toContain(
			"rank_ordinal: i18next ordinal plural converted to \":number select=ordinal\" — call t('extra:rank_ordinal', { count }) instead of t('extra:rank', { count, ordinal: true })"
		);
	});

	it('uses the dot path for nested keys', async () => {
		await migrate({ results: ordinals });
		expect(warned()).toContain("call t('extra:results.rank_ordinal', { count })");
	});

	it('leaves a cardinal plural of the same base key as before', async () => {
		const { out } = await migrate({
			...ordinals,
			rank_one: '{{count}} rank',
			rank_other: '{{count}} ranks'
		});
		expect(out.rank).toBe(
			'.input {$count :number}\n.match $count\none {{{$count} rank}}\n* {{{$count} ranks}}'
		);
		expect(fmt(out.rank as string, { count: 2 })).toBe('2 ranks');
		expect(fmt(out.rank_ordinal as string, { count: 2 })).toBe('2nd place');
		// the cardinal group does not mention ordinals
		expect(warned()).not.toContain('rank: i18next ordinal');
	});

	it('keeps "_zero" as the zero category, which ordinals have in some locales', async () => {
		const { out } = await migrate(
			{
				n_ordinal_zero: 'zero {{count}}',
				n_ordinal_one: 'one {{count}}',
				n_ordinal_two: 'two {{count}}',
				n_ordinal_few: 'few {{count}}',
				n_ordinal_many: 'many {{count}}',
				n_ordinal_other: 'other {{count}}'
			},
			'cy'
		);
		const source = out.n_ordinal as string;
		expect(source).toContain('\nzero {{zero {$count}}}');
		expect(source).not.toContain('\n0 {{');
		// Welsh ordinals: 0, 7, 8 and 9 are "zero", 5 and 6 are "many"
		expect(fmt(source, { count: 7 }, 'cy')).toBe('zero 7');
		expect(fmt(source, { count: 5 }, 'cy')).toBe('many 5');
	});

	it('is stable on a second run', async () => {
		await migrate(ordinals);
		const first = await readFile(join(dir, 'en', 'extra.json'), 'utf-8');
		errors.length = 0;
		await runMigrate(['--messages', dir]);
		expect(await readFile(join(dir, 'en', 'extra.json'), 'utf-8')).toBe(first);
		expect(warned()).not.toContain('extra.json: rank_ordinal');
	});
});

describe('runMigrate: i18next formats with no MF2 counterpart', () => {
	it('drops the format, keeps the variable and says so', async () => {
		const { out } = await migrate({
			shout: '{{name, uppercase}}!',
			mixed: '{{n, number}} for {{who, lowercase}}'
		});
		expect(out.shout).toBe('{$name}!');
		expect(fmt(out.shout as string, { name: 'Ann' })).toBe('\u2068Ann\u2069!');
		expect(out.mixed).toBe('{$n :number} for {$who}');
		expect(warned()).toContain(
			'shout: format "uppercase" dropped from "{{name, uppercase}}" — "name" is now a plain {$name}'
		);
		expect(warned()).toContain('mixed: format "lowercase" dropped');
		// the formats it does map are untouched
		expect(warned()).not.toContain('format "number"');
	});
});

describe('runMigrate: svelte-i18n flat layout', () => {
	it('fails when nothing else was migrated', async () => {
		const flat = await mkdtemp(join(tmpdir(), 'svelte-dialect-flat-'));
		try {
			await write(join(flat, 'en.json'), { hi: 'Hi {name}' });
			await write(join(flat, 'pt-BR.json'), { hi: 'Oi {name}' });
			expect(await runMigrate(['--messages', flat])).toBe(1);
			expect(warned()).toContain('en.json: skipped');
			expect(warned()).toContain('Move it to en/common.json');
			expect(warned()).toContain('Move it to pt-BR/common.json');
			expect(warned()).toContain('nothing was migrated');
			expect(logs.at(-1)).toBe('svelte-dialect migrate: 0 messages converted, 2 warnings');
			// the files are not touched
			expect(JSON.parse(await readFile(join(flat, 'en.json'), 'utf-8'))).toEqual({
				hi: 'Hi {name}'
			});
		} finally {
			await rm(flat, { recursive: true, force: true });
		}
	});

	it('only warns when locale folders were migrated alongside', async () => {
		await write(join(dir, 'de.json'), { hi: 'Hallo' });
		expect(await runMigrate(['--messages', dir])).toBe(0);
		expect(warned()).toContain('de.json: skipped');
	});

	it('ignores JSON files whose name is not a locale', async () => {
		await write(join(dir, 'notes.json'), {});
		// three letters, like a locale code, but not a language Intl knows
		await write(join(dir, 'app.json'), {});
		await runMigrate(['--messages', dir]);
		expect(warned()).not.toContain('notes.json');
		expect(warned()).not.toContain('app.json');
	});
});

describe('runMigrate: nesting, HTML and context', () => {
	it('warns about $t() nesting, in single messages and plural forms', async () => {
		const { out } = await migrate({
			back: 'Back to $t(welcome)',
			back2: 'Back to $t(welcome, { "name": "x" }) {{name}}',
			doc_one: 'See $t(other) once',
			doc_other: 'See $t(other) {{count}} times'
		});
		expect(out.back).toBe('Back to $t(welcome)');
		expect(warned()).toContain('back: i18next nesting "$t(…)" has no MF2 equivalent');
		expect(warned()).toContain('back2: i18next nesting');
		expect(warned()).toContain('doc: i18next nesting');
	});

	it('converts attribute-less tags to MF2 markup and says so', async () => {
		const { out } = await migrate({
			bold: 'Read <b>this</b> now',
			lines: 'One<br/>two<br />three<br>four',
			combo: '<strong>{{name}}</strong> has <em>{{n}}</em> items'
		});
		expect(out.bold).toBe('Read {#b}this{/b} now');
		expect(out.lines).toBe('One{#br/}two{#br/}three{#br/}four');
		expect(out.combo).toBe('{#strong}{$name}{/strong} has {#em}{$n}{/em} items');
		expect(fmt(out.bold as string)).toBe('Read this now');
		const parts = new MessageFormat('en', out.bold as string).formatToParts();
		expect(parts.map((p) => p.type)).toEqual(['text', 'markup', 'text', 'markup', 'text']);
		expect(warned()).toContain('bold: HTML <b>, </b> converted to MF2 markup');
		expect(warned()).toContain('Rich component');
		expect(warned()).toContain('lines: HTML <br/>, <br />, <br> converted');
	});

	it('leaves tags with attributes as text, and warns', async () => {
		const { out } = await migrate({
			docs: 'Read the <a href="/docs">docs</a>',
			withVar: '<a href="{{url}}" class="x">{{label}}</a>'
		});
		expect(out.docs).toBe('Read the <a href="/docs">docs</a>');
		expect(out.withVar).toBe('<a href="{$url}" class="x">{$label}</a>');
		expect(warned()).toContain('docs: HTML <a href="/docs"> left as text');
		expect(warned()).toContain('{#name}…{/name}');
		expect(warned()).toContain('withVar: HTML <a href="{{url}}" class="x"> left as text');
	});

	it('does not half-convert a tag name that also appears with attributes', async () => {
		const { out } = await migrate({
			mixed: '<a href="/x">docs</a> and <b>bold</b> and <a>plain</a>'
		});
		expect(out.mixed).toBe('<a href="/x">docs</a> and {#b}bold{/b} and <a>plain</a>');
		expect(warned()).toContain('mixed: HTML <b>, </b> converted');
		expect(warned()).toContain('mixed: HTML <a href="/x"> left as text');
	});

	it('converts tags inside plural forms and select arms', async () => {
		const { out } = await migrate({
			files_one: '<b>{{count}}</b> file',
			files_other: '<b>{{count}}</b> files',
			who: '{g, select, f {<i>She</i>} other {<i>They</i>}} left'
		});
		expect(out.files).toContain('one {{{#b}{$count}{/b} file}}');
		expect(out.who).toContain('f {{{#i}She{/i} left}}');
		expect(warned()).toContain('files: HTML <b>, </b> converted');
	});

	it('is stable on a second run, and leaves MF2 sources with HTML alone', async () => {
		await write(join(dir, 'en', 'mf2.json'), { raw: 'Hi {$name} <b>x</b>' });
		const { out } = await migrate({ bold: 'Read <b>this</b> now' });
		errors.length = 0;
		await runMigrate(['--messages', dir]);
		expect((await read('en', 'extra.json')).bold).toBe(out.bold);
		expect((await read('en', 'mf2.json')).raw).toBe('Hi {$name} <b>x</b>');
		expect(warned()).not.toContain('HTML');
	});

	it('leaves plain text with a lone "<" and ICU arms like {#st} alone', async () => {
		const { out } = await migrate({ cmp: 'a < b and c > d', ord: '{n, plural, other {#st}}' });
		expect(out.cmp).toBe('a < b and c > d');
		expect(out.ord).toContain('{$n}st');
		expect(warned()).not.toContain('HTML');
	});

	it('warns when a key sits next to base_suffix siblings that look like context', async () => {
		await migrate({
			friend: 'A friend',
			friend_male: 'A boyfriend',
			friend_female: 'A girlfriend',
			nested: { pal: 'x', pal_formal: 'y' }
		});
		expect(warned()).toContain(
			'friend: "friend_male", "friend_female" look like i18next context variants — MF2 handles context with a .match on a parameter'
		);
		expect(warned()).toContain('nested.pal: "pal_formal" look like');
	});

	it('also warns for two siblings without the base key, and never converts them', async () => {
		const { out } = await migrate({ pal_formal: 'Sir', pal_informal: 'Mate' });
		expect(out).toEqual({ pal_formal: 'Sir', pal_informal: 'Mate' });
		expect(warned()).toContain('pal: "pal_formal", "pal_informal" look like');
	});

	it('does not mistake plural or ordinal keys for context', async () => {
		await migrate({
			rank: 'Rank',
			rank_ordinal_one: '{{count}}st',
			rank_ordinal_other: '{{count}}th',
			item_one: 'one',
			item_other: 'many',
			lonely_key: 'only one sibling and no base'
		});
		expect(warned()).not.toContain('look like i18next context');
	});
});

describe('runMigrate: ICU date, time and number styles', () => {
	const date = new Date(2026, 2, 5, 14, 7, 9);

	it('maps date styles to :date length / fields', async () => {
		const { out } = await migrate({
			short: '{d, date, short}',
			medium: '{d, date, medium}',
			long: '{d, date, long}',
			full: '{d, date, full}',
			bare: '{d, date}'
		});
		expect(out).toEqual({
			short: '{$d :date length=short}',
			medium: '{$d :date length=medium}',
			long: '{$d :date length=long}',
			full: '{$d :date fields=year-month-day-weekday length=long}',
			bare: '{$d :date}'
		});
		expect(fmt(out.short as string, { d: date })).toBe('3/5/2026');
		expect(fmt(out.medium as string, { d: date })).toBe('Mar 5, 2026');
		expect(fmt(out.long as string, { d: date })).toBe('March 5, 2026');
		expect(fmt(out.full as string, { d: date })).toBe('Thursday, March 5, 2026');
		expect(fmt(out.full as string, { d: date }, 'de')).toBe('Donnerstag, 5. März 2026');
		expect(warned()).not.toContain('dropped');
	});

	it('maps time styles to :time precision / timeZoneStyle', async () => {
		const { out } = await migrate({
			short: '{d, time, short}',
			medium: '{d, time, medium}',
			long: '{d, time, long}',
			full: '{d, time, full}'
		});
		expect(out).toEqual({
			short: '{$d :time}',
			medium: '{$d :time precision=second}',
			long: '{$d :time precision=second timeZoneStyle=short}',
			full: '{$d :time precision=second timeZoneStyle=long}'
		});
		expect(fmt(out.short as string, { d: date })).toBe('2:07 PM');
		expect(fmt(out.medium as string, { d: date })).toBe('2:07:09 PM');
		const long = fmt(out.long as string, { d: date });
		const full = fmt(out.full as string, { d: date });
		expect(long).toMatch(/^2:07:09 PM \S+/);
		expect(full.length).toBeGreaterThan(long.length);
		expect(warned()).not.toContain('dropped');
	});

	it('writes the same MF2 on a second run', async () => {
		await migrate({ short: '{d, date, short}' });
		const first = await readFile(join(dir, 'en', 'extra.json'), 'utf-8');
		await runMigrate(['--messages', dir]);
		expect(await readFile(join(dir, 'en', 'extra.json'), 'utf-8')).toBe(first);
	});

	it('maps ::percent to :percent and nothing else', async () => {
		const { out } = await migrate({
			skeleton: '{n, number, ::percent}',
			style: '{n, number, percent}',
			compact: '{n, number, ::compact-long}'
		});
		expect(out.skeleton).toBe('{$n :percent}');
		expect(fmt(out.skeleton as string, { n: 0.256 })).toBe('26%');
		expect(out.style).toBe('{$n :percent}');
		// messageformat v4's :number has no compact notation, so the skeleton stays a warning
		expect(out.compact).toBe('{$n :number}');
		expect(warned()).toContain('compact: style "::compact-long" dropped');
		expect(warned()).not.toContain('skeleton:');
	});

	it('does not emit options messageformat rejects', async () => {
		const { out } = await migrate({
			a: '{d, date, short}',
			b: '{d, date, full}',
			c: '{d, time, full}',
			e: '{n, number, ::percent}'
		});
		for (const source of Object.values(out) as string[]) {
			const errs: unknown[] = [];
			const mf = new MessageFormat('en', source, { functions: DraftFunctions });
			mf.format({ d: date, n: 0.5 }, (e) => errs.push(e));
			expect(errs, source).toEqual([]);
		}
	});
});

describe('runMigrate: --strict and locale folders', () => {
	it('exits 0 with warnings by default and 1 with --strict', async () => {
		expect(await runMigrate(['--messages', dir])).toBe(0);
		errors.length = 0;
		expect(await runMigrate(['--messages', dir, '--strict'])).toBe(1);
		expect(warned()).toContain('--strict: 2 warnings, exiting with 1');
	});

	it('exits 0 with --strict when there is nothing to warn about', async () => {
		const clean = await mkdtemp(join(tmpdir(), 'svelte-dialect-clean-'));
		try {
			await mkdir(join(clean, 'en'));
			await write(join(clean, 'en', 'a.json'), { hi: 'Hi {name}' });
			expect(await runMigrate(['--messages', clean, '--strict'])).toBe(0);
			expect(await readFile(join(clean, 'en', 'a.json'), 'utf-8')).toContain('{$name}');
		} finally {
			await rm(clean, { recursive: true, force: true });
		}
	});

	it('migrates folders named with a hyphenated BCP 47 tag', async () => {
		for (const locale of ['pt-BR', 'zh-Hant']) {
			await mkdir(join(dir, locale));
			await write(join(dir, locale, 'a.json'), { hi: 'Hi {name}' });
		}
		await runMigrate(['--messages', dir]);
		expect((await read('pt-BR', 'a.json')).hi).toBe('Hi {$name}');
		expect((await read('zh-Hant', 'a.json')).hi).toBe('Hi {$name}');
		expect(logs).toContain(
			'svelte-dialect migrate: zh-Hant/a.json — 1 converted, 0 unchanged, 0 warnings'
		);
	});

	it('warns about an underscore folder instead of skipping it silently', async () => {
		await mkdir(join(dir, 'zh_CN'));
		await write(join(dir, 'zh_CN', 'a.json'), { hi: 'Hi {name}' });
		await mkdir(join(dir, 'my_assets'));
		await write(join(dir, 'my_assets', 'a.json'), { hi: 'Hi {name}' });
		await runMigrate(['--messages', dir]);
		expect(warned()).toContain(
			'zh_CN/: skipped — locale folders are BCP 47 tags. Rename it to "zh-CN"'
		);
		expect(warned()).not.toContain('my_assets');
		expect((await read('zh_CN', 'a.json')).hi).toBe('Hi {name}');
		expect(logs.at(-1)).toContain('5 warnings');
	});
});

describe('runMigrate: odd keys and broken files', () => {
	it('keeps a "__proto__" key and collapses a plural group named like a prototype member', async () => {
		await writeFile(
			join(dir, 'en', 'odd.json'),
			'{"__proto__": "Hi {{name}}", "toString_one": "{{count}} thing", "toString_other": "{{count}} things"}'
		);
		await runMigrate(['--messages', dir]);
		const out = await read('en', 'odd.json');
		expect(Object.hasOwn(out, '__proto__')).toBe(true);
		expect(out['__proto__']).toBe('Hi {$name}');
		expect(out.toString).toContain('.match $count');
		expect(warned()).not.toContain('already exists');
	});

	it('leaves a message it wrapped for a leading dot alone on a second run', async () => {
		await write(join(dir, 'en', 'dot.json'), { env: '.env file' });
		await runMigrate(['--messages', dir]);
		const first = await read('en', 'dot.json');
		expect(await runMigrate(['--messages', dir, '--strict'])).toBe(1); // FIXTURES warn anyway
		expect(await read('en', 'dot.json')).toEqual(first);
		expect(warned()).not.toContain('dot.json');
	});

	it('names a broken file and writes nothing when one file in the tree does not parse', async () => {
		await writeFile(join(dir, 'en', 'zzz.json'), '{ broken');
		const before = await readFile(join(dir, 'en', 'home.json'), 'utf-8');
		await expect(runMigrate(['--messages', dir])).rejects.toThrow(/invalid JSON in ".*zzz\.json"/);
		expect(await readFile(join(dir, 'en', 'home.json'), 'utf-8')).toBe(before);
	});
});
