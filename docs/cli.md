<!-- Generated from the docs site by scripts/markdown.ts (bun run build:docs). Edit the page in src/routes and its messages instead. -->

# CLI reference

svelte-dialect ships one executable with three commands: typegen, check and migrate. There is no config file, so every setting is a flag.

## Usage

Run it with no arguments, or with --help as the only argument, to print the command list and exit with 0\. An unknown command prints the same list and exits with 1\. A flag the command doesn't know, a messages directory it can't read and invalid JSON are errors too: the command prints one line to stderr and exits with 1.

```sh
npx svelte-dialect <command> [flags]
```

## typegen

Writes a .d.ts file with the MessageKey union and the MessageParams shapes. [Typed keys](https://krowten.github.io/svelte-dialect/typed-keys.md) shows how to use them.

```sh
$ npx svelte-dialect typegen --messages src/lib/messages --out src/lib/i18n-keys.d.ts
svelte-dialect typegen: 3 keys → src/lib/i18n-keys.d.ts
```

### Flags

| Flag                                      | Default                | Description                                                                                                                                                                                |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [\--messages <dir>](#typegen-messages)    | src/lib/messages       | The messages directory, laid out as <locale>/<namespace>.json. Repeat the flag to merge several directories, for example a bundled tree and a lazy one. Ignored when --from-json is given. |
| [\--from-json <file>](#typegen-from-json) | —                      | Read a {locale: {namespace: {…}}} JSON dump instead of a directory. Meant for catalogs that live in a database.                                                                            |
| [\--out <file>](#typegen-out)             | src/lib/i18n-keys.d.ts | The file to write. Its directory has to exist already. An existing file is overwritten.                                                                                                    |

### Exit codes

| Code | When                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | The file was written.                                                                                                                |
| 1    | Unknown flag, a --messages directory or a --from-json file that can't be read, invalid JSON, or an --out path that can't be written. |

## check

Compares the t('ns:key') calls found in your source with the message files, so a renamed or deleted key fails in CI instead of showing up as raw text in production.

```sh
$ npx svelte-dialect check --unused
Missing:
  home:footer — missing in en, ru
  home:greeting — missing in ru
Unused:
  home:old
3 keys used, 2 missing, 1 unused
$ echo $?
1
```

The scan searches the source as plain text and does not parse it, so it sees string literals only: a key built from a variable or from a template literal with ${…} is skipped, both for the missing list and for --unused. A loadTranslations('ns') call is checked as ns:\*, which fails when a locale has no such namespace.

### Flags

| Flag                                 | Default          | Description                                                                                                                        |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [\--messages <dir>](#check-messages) | src/lib/messages | The messages directory, laid out as <locale>/<namespace>.json. Repeatable.                                                         |
| [\--src <dir>](#check-src)           | src              | The directory to scan, recursively, for .ts, .js and .svelte files. node\_modules and directories starting with a dot are skipped. |
| [\--unused](#check-unused)           | false            | Also list the keys in the message files that no code references. It doesn't change the exit code.                                  |

### Exit codes

| Code | When                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Every key the code uses exists in every locale.                                                                                                              |
| 1    | A used key is missing from at least one locale, no locale was found under --messages while keys were in use, or the command failed as described under Usage. |

## migrate

Converts i18next and ICU MessageFormat JSON files to MF2, in place. The [migration guide](https://krowten.github.io/svelte-dialect/migrate.md) follows one migration from start to finish.

```sh
$ npx svelte-dialect migrate --dry-run --strict
svelte-dialect migrate: en/common.json — 3 converted, 0 unchanged, 1 warnings
  …
svelte-dialect migrate: 3 messages would change, 1 warnings (dry run, nothing written)
svelte-dialect migrate: --strict: 1 warnings, exiting with 1
```

Results and the summary go to stdout, warnings to stderr. A file is rewritten only when at least one of its messages changed, as JSON indented with tabs. A second run changes nothing.

### Flags

| Flag                                   | Default          | Description                                                                                                                  |
| -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [\--messages <dir>](#migrate-messages) | src/lib/messages | The messages directory to convert, laid out as <locale>/<namespace>.json. Repeatable: each directory is migrated on its own. |
| [\--dry-run](#migrate-dry-run)         | false            | Print every change as a before and after pair and write nothing.                                                             |
| [\--strict](#migrate-strict)           | false            | Exit with 1 when any warning was emitted. The files are still written; the flag only changes the exit code, for CI.          |

### Exit codes

| Code | When                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| 0    | The run finished. Warnings alone don't fail it.                                                                            |
| 1    | \--strict was given and at least one warning was emitted.                                                                  |
| 1    | The directory holds only flat <locale>.json files, so nothing could be migrated. Move each into <locale>/<namespace>.json. |
| 1    | Unknown flag, a messages directory that can't be read, or invalid JSON.                                                    |
