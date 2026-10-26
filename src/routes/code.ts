/** A highlighted snippet as the pages pass it to CodeBlock. */
export type CodeSample = {
	/** The shiki HTML of the code, without the path comment. */
	html: string;
	/** The plain source that the copy button puts on the clipboard, also without the path comment. */
	code: string;
	/** The file named by a leading path comment, if the snippet has one. */
	file?: string;
	/** What follows the path after an em dash (`// src/hooks.ts — universal, not hooks.server.ts`). */
	note?: string;
};
