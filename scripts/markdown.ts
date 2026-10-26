// Runs after `vite build` (`bun run build:docs`): writes the Markdown version of every docs page,
// build/<page>.md, and all of them in sidebar order as build/llms-full.txt, for LLMs and coding
// agents (linked from static/llms.txt). The same pages also go to docs/<page>.md, committed for
// indexers that read the repository rather than the site (Context7, see context7.json); CI fails
// when they are stale. Converted from the prerendered English HTML, so it can't
// drift from what the site shows. A step after the build rather than a prerendered endpoint:
// an endpoint fetching a page mid-prerender sometimes gets SvelteKit's half-written copy of it.
import { file, write } from 'bun';
import { NodeHtmlMarkdown } from 'node-html-markdown';

import { PAGES } from '../src/routes/nav.ts';

const { BASE_PATH = '' } = process.env;

// links always point at the public site, so docs/ comes out the same whatever BASE_PATH the build had
const SITE = 'https://krowten.github.io/svelte-dialect';
const OUT = 'build';
const GENERATED =
	'<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->\n\n';

const markdown = new NodeHtmlMarkdown({ codeBlockStyle: 'fenced', ignore: ['button', 'nav'] });

const toMarkdown = (html: string) => {
	const main = (/<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '')
		// the column labels /compare repeats in each cell for narrow screens
		.replace(/<span class="[^"]*\blg:hidden\b[^"]*">[^<]*<\/span>/g, '');
	return (
		markdown
			.translate(main)
			// heading permalinks: `## Install [#](#install)`
			.replace(/ ?\[#\]\(#[^)]*\)/g, '')
			// site links: absolute, and to the Markdown version of a docs page
			.replace(/\]\((\/[^)#\s]*)(#[^)]*)?\)/g, (_, path: string, hash = '') => {
				const page = path.slice(BASE_PATH.length) as (typeof PAGES)[number];
				return `](${SITE}${page}${PAGES.includes(page) ? '.md' : ''}${hash})`;
			})
			.trim() + '\n'
	);
};

const pages = await Promise.all(
	PAGES.map(async (path) => {
		const html = file(`${OUT}${path}.html`);
		if (!(await html.exists()))
			throw new Error(`${OUT}${path}.html is missing: run vite build first`);
		const text = toMarkdown(await html.text());
		await write(`${OUT}${path}.md`, text);
		await write(`docs${path}.md`, GENERATED + text);
		return text;
	})
);

// the title and summary paragraph of llms.txt, so the file says what it documents
const intro = (await file('static/llms.txt').text()).split('\n\n').slice(0, 2).join('\n\n') + '\n';
await write(`${OUT}/llms-full.txt`, [intro, ...pages].join('\n---\n\n'));
console.log(`markdown: ${pages.length} pages to ${OUT}/ and docs/, plus ${OUT}/llms-full.txt`);
