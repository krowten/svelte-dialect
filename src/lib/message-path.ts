/**
 * `…/<locale>/<namespace>.json`. The locale segment has to look like a language tag and sit on a
 * path boundary, so a stray `messages/notes.json` is skipped instead of inventing a `messages`
 * locale that would then show up in a language switcher.
 *
 * Lives outside core.svelte.ts because the CLI parses the same layout: this module must stay free
 * of runes and of anything that needs the Svelte compiler.
 */
export const MESSAGE_PATH = /(?:^|\/)([a-z]{2,3}(?:-[A-Za-z0-9]+)*)\/([^/]+)\.json$/i;

/**
 * `zh_CN`, `pt_BR`: a folder that is a locale in everything but its separator. The runtime skips
 * it, so the CLI says so and suggests the BCP 47 spelling (`zh-CN`) instead of staying quiet.
 */
export const legacyLocaleFolder = (name: string): string | undefined =>
	// language, optional script, optional region: `my_assets` is a folder, not a locale
	/^(?=.*_)[a-z]{2,3}(?:[_-][A-Za-z]{4})?(?:[_-](?:[A-Za-z]{2}|\d{3}))?$/i.test(name)
		? name.replaceAll('_', '-')
		: undefined;

/** `{ nav: { home: 'Home' } }` → `{ 'nav.home': 'Home' }` — non-string leaves are dropped. */
export const flattenSources = (obj: Record<string, unknown>, prefix = ''): Record<string, string> =>
	Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
		const key = prefix + k;
		if (typeof v === 'string') acc[key] = v;
		else if (v && typeof v === 'object')
			Object.assign(acc, flattenSources(v as Record<string, unknown>, `${key}.`));
		return acc;
		// no prototype, so a `__proto__` key is a message like any other, not a prototype swap
	}, Object.create(null));
