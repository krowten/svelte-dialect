# svelte-dialect

Svelte 5 i18n library on MessageFormat 2, and the documentation site built with it. Setup, checks
and pull-request conventions:

@CONTRIBUTING.md

## Layout

- `src/lib` is the package; `svelte-package` builds it into `dist/`. Public entry points:
  `index.ts` (core, plain Svelte), `kit.ts` (SvelteKit integration), `entries.ts` (prerender
  entries), `cli/` (the `svelte-dialect` binary: `typegen`, `check`, `migrate`).
- Also in `src/lib` but excluded from the package by `files` in `package.json`: the site's own
  instance `i18n.ts`, its `messages/` and `messages-lazy/`, and the generated `i18n-keys.d.ts`.
  Library code must not import them.
- `src/routes` is the docs site. It imports the library through the `#lib` subpath imports, the
  same way a consumer would import the package.
- `e2e/` runs Playwright against two builds of the site: static (adapter-static, prerendered) and
  adapter-node (`build-node/`, for server-side locale negotiation).

## Tests

- Unit tests are split by file name: `*.svelte.spec.ts` run in Chromium (Vitest browser mode),
  other `*.spec.ts` run in Node. `types.test-d.ts` is checked by `bun run check`.
- `bun run test:e2e` builds the site twice before running, so it is slow; use
  `bun run test:unit -- --run` while iterating.

## Svelte tooling

`.claude/settings.json` enables the official `svelte` plugin: the Svelte MCP server (docs and
`svelte-autofixer`), Svelte skills and the language server. Run `svelte-autofixer` on any
`.svelte` or `.svelte.ts` file you change.
