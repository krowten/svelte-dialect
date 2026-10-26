# Contributing

Thanks for taking the time. Bug reports, docs fixes and translations of the docs site are all
welcome.

## Before you start

For anything bigger than a small fix, open an issue first so we can agree on the approach — it
saves you from writing code that ends up not fitting the library.

## Setup

The repository is both the library (`src/lib`) and its documentation site (`src/routes`). It uses
[bun](https://bun.sh) and Node 22.17 or newer.

```sh
bun install
bun run dev        # the docs site, with the library loaded from source
```

## Checks

Run these before opening a pull request; CI runs the same:

```sh
bun run lint       # prettier + eslint
bun run check      # svelte-check
bun run check:i18n # every t('…') key used in the site exists in every locale
bun run test       # unit tests (node + browser) and the Playwright suite
```

If you change messages, regenerate the key types with `bun run typegen` and commit the result. If
you change the docs site, run `bun run build:docs` and commit `docs/`: it is the Markdown copy of
the site that tools reading the repository use, and CI checks that it is current.

## Translations of the docs site

Messages live in `src/lib/messages/<locale>/<namespace>.json` and
`src/lib/messages-lazy/<locale>/<namespace>.json`. They are
[MessageFormat 2](https://messageformat.unicode.org/): keep variables (`{$name}`), markup
(`{#link}…{/link}`) and plural selectors intact, and keep the same keys as the English files.

## Pull requests

- One topic per pull request, with a test when the change fixes a bug.
- Add a line to `CHANGELOG.md` for anything a user of the package would notice.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`fix: …`, `feat: …`, `docs: …`).
