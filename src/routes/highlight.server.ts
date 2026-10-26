import type { CodeSample } from './code.js';

import { codeToHtml } from 'shiki';

// `// src/hooks.ts`, `# src/app.sh`, `<!-- src/app.html -->`, each optionally followed by
// `— a note`. The path has to look like one (a dot or a slash), so `// message` stays code.
const PATH_COMMENT = /^(?:\/\/|#|<!--)\s+([^\s]*[./][^\s]*?)(?:\s+—\s+(.+?))?(?:\s+-->)?\s*$/;

/**
 * Highlights a demo snippet on the server — at build time under prerender, per request under SSR.
 * The shorthand keeps one highlighter internally, so repeated calls share grammars and themes.
 * Both themes ship in one pass as CSS variables; layout.css flips them on prefers-color-scheme.
 *
 * A first line that is a path comment is lifted out into `file` (and `note`) and left out of the
 * highlighted code, so CodeBlock can show it as a header instead.
 */
export const highlight = async (
	source: string,
	lang: 'ts' | 'svelte' | 'json' | 'jsonc' | 'sh'
): Promise<CodeSample> => {
	const [first, ...rest] = source.split('\n');
	const match = PATH_COMMENT.exec(first);
	const code = match ? rest.join('\n') : source;
	return {
		html: await codeToHtml(code, {
			lang,
			themes: { light: 'github-light', dark: 'github-dark-default' },
			// the fence language of the page's Markdown version (scripts/markdown.ts)
			transformers: [{ code: (node) => void (node.properties.class = `language-${lang}`) }]
		}),
		code,
		file: match?.[1],
		note: match?.[2]
	};
};
