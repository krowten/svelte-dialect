#!/usr/bin/env node
/**
 * The svelte-dialect CLI. Deliberately dependency-free: argument parsing is node:util, the
 * commands live in their own modules, and nothing here (or in them) may import core.svelte.ts —
 * that file contains runes and only compiles inside Svelte tooling.
 */
import { runTypegen } from './typegen.js';
import { runCheck } from './check.js';
import { runMigrate } from './migrate.js';

const HELP = `svelte-dialect <command>

Commands:
  typegen   Generate a .d.ts with the message key union (and param shapes) from your messages
            --messages <dir>    messages directory, repeatable (default: src/lib/messages)
            --from-json <file>  a {locale: {ns: {…}}} dump instead of a directory (e.g. from a DB)
            --out <file>        output file (default: src/lib/i18n-keys.d.ts)

  check     Compare t('…') calls in your source against the message catalogs
            --messages <dir>    messages directory, repeatable (default: src/lib/messages)
            --src <dir>         source directory to scan (default: src)
            --unused            also report keys no code references
            (exits 1 when a used key is missing from any locale)

  migrate   Convert i18next / ICU MessageFormat JSON files to MF2 in place
            --messages <dir>    messages directory, repeatable (default: src/lib/messages)
            --dry-run           print what would change without writing
            --strict            exit 1 when any warning was emitted (for CI)
            (exits 1 when <locale>.json files sit in the messages directory and nothing else was migrated)`;

const [command, ...rest] = process.argv.slice(2);

const commands: Record<string, (argv: string[]) => Promise<number>> = {
	typegen: runTypegen,
	check: runCheck,
	migrate: runMigrate
};

const asksForHelp = ['help', '--help', '-h'].includes(command ?? 'help');
// own properties only: `svelte-dialect toString` is an unknown command, not Object.prototype's
const run = command && Object.hasOwn(commands, command) ? commands[command] : undefined;
if (!run || rest.includes('--help') || rest.includes('-h')) {
	console.log(HELP);
	process.exit(run || asksForHelp ? 0 : 1);
}

run(rest).then(
	(code) => process.exit(code),
	(error) => {
		console.error(`svelte-dialect ${command}: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	}
);
