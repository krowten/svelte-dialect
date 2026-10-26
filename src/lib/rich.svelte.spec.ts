import { describe, it, expect, beforeEach } from 'vitest';
import { mount, unmount, createRawSnippet, flushSync, type Snippet } from 'svelte';
import { createDialect } from './core.svelte';
import Rich from './Rich.svelte';

const messages = {
	'/m/en/home.json': {
		default: {
			cta: 'Read {#link}the docs{/link} now',
			pay: 'Pay via {#pay to=|/checkout|}card{/pay}',
			solo: 'Break{#br/}here',
			plain: 'No markup at all',
			nested: 'A {#outer}B {#inner}C{/inner} D{/outer} E',
			deep: 'A {#one}B {#two}C {#three}D{/three} E{/two} F{/one} G',
			mixed: 'A {#outer}B{#br/}C{/outer} D',
			stray: 'A{/gone} B',
			unclosed: 'A {#outer}B C',
			inherited: 'Keep {#toString}KEPT{/toString} text'
		}
	}
};

/**
 * A markup snippet built from raw HTML: it creates `tag`, then renders the children snippet into
 * it through an anchor comment — the only way to reach the children from `createRawSnippet`.
 */
const tag = (name: string, attrs?: (options: Record<string, unknown>) => string) =>
	createRawSnippet<[Snippet, Record<string, unknown>]>((children, options) => ({
		render: () => `<${name}${attrs ? attrs(options() ?? {}) : ''}></${name}>`,
		setup: (node: Element) => {
			const anchor = node.appendChild(document.createComment(''));
			(children() as unknown as (anchor: Comment) => void)(anchor);
		}
	}));

/** A link-shaped snippet: children wrapped in an anchor pointing at the option-supplied target. */
const link = tag('a', (options) => ` href="${String(options.to ?? '/docs')}"`);
const strong = tag('strong');

describe('Rich', () => {
	let host: HTMLElement;
	beforeEach(() => {
		host = document.createElement('div');
		document.body.appendChild(host);
		return () => host.remove();
	});

	const render = (
		parts: ReturnType<ReturnType<typeof createDialect>['formatParts']>,
		snippets = {}
	) => {
		const component = mount(Rich, { target: host, props: { parts, ...snippets } });
		flushSync();
		return () => unmount(component);
	};

	it('renders markup through the matching snippet, with options', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:pay'), { pay: link });

		const anchor = host.querySelector('a');
		expect(anchor?.getAttribute('href')).toBe('/checkout');
		expect(anchor?.textContent).toBe('card');
		expect(host.textContent).toBe('Pay via card');
		done();
	});

	it('degrades to the inner text when no snippet matches the markup name', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:cta'));

		expect(host.textContent).toBe('Read the docs now');
		expect(host.querySelector('a')).toBeNull();
		done();
	});

	it('renders standalone markup with empty children', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const br = createRawSnippet<[Snippet, Record<string, unknown>]>(() => ({
			render: () => '<br />'
		}));
		const done = render(d.formatParts('home:solo'), { br });

		expect(host.textContent).toBe('Breakhere');
		expect(host.querySelector('br')).not.toBeNull();
		done();
	});

	it('gives standalone markup children that render nothing', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:solo'), { br: tag('span') });

		expect(host.querySelector('span')?.textContent).toBe('');
		expect(host.textContent).toBe('Breakhere');
		done();
	});

	it('renders nested markup as a tree, one snippet per level', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:nested'), { outer: strong, inner: link });

		expect(host.querySelector('strong a')?.textContent).toBe('C');
		expect(host.querySelector('strong')?.textContent).toBe('B C D');
		expect(host.textContent).toBe('A B C D E');
		done();
	});

	it('renders three levels of nesting', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:deep'), {
			one: strong,
			two: tag('em'),
			three: link
		});

		expect(host.querySelector('strong em a')?.textContent).toBe('D');
		expect(host.querySelector('strong em')?.textContent).toBe('C D E');
		expect(host.querySelector('strong')?.textContent).toBe('B C D E F');
		expect(host.textContent).toBe('A B C D E F G');
		done();
	});

	it('keeps unmatched inner markup inside the outer element as text', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:nested'), { outer: strong });

		expect(host.querySelector('strong')?.textContent).toBe('B C D');
		expect(host.querySelector('a')).toBeNull();
		expect(host.textContent).toBe('A B C D E');
		done();
	});

	it('renders inner markup even when the outer one has no snippet', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:nested'), { inner: link });

		expect(host.querySelector('strong')).toBeNull();
		expect(host.querySelector('a')?.textContent).toBe('C');
		expect(host.textContent).toBe('A B C D E');
		done();
	});

	it('renders standalone markup nested inside markup', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const br = createRawSnippet<[Snippet, Record<string, unknown>]>(() => ({
			render: () => '<br />'
		}));
		const done = render(d.formatParts('home:mixed'), { outer: strong, br });

		expect(host.querySelector('strong br')).not.toBeNull();
		expect(host.querySelector('strong')?.textContent).toBe('BC');
		expect(host.textContent).toBe('A BC D');
		done();
	});

	it('ignores a close with no matching open', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:stray'), { gone: strong });

		expect(host.querySelector('strong')).toBeNull();
		expect(host.textContent).toBe('A B');
		done();
	});

	it('runs an unclosed open to the end of the message', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:unclosed'), { outer: strong });

		expect(host.querySelector('strong')?.textContent).toBe('B C');
		expect(host.textContent).toBe('A B C');
		done();
	});

	it('renders a message without markup as plain text', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:plain'));

		expect(host.textContent).toBe('No markup at all');
		done();
	});

	it('degrades markup named like an inherited Object.prototype member instead of calling it', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		// no `toString` snippet passed — must fall through to plain rendering, not Object.prototype.toString
		const done = render(d.formatParts('home:inherited'));

		expect(host.textContent).toBe('Keep KEPT text');
		done();
	});

	it('degrades an unknown key to the key itself, matching t()', () => {
		const d = createDialect({ messages, defaultLocale: 'en' });
		const done = render(d.formatParts('home:missing'));

		expect(host.textContent).toBe('home:missing');
		done();
	});
});
