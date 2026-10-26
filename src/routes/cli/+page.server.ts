import type { PageServerLoad } from './$types.js';

import { highlight } from '../highlight.server.js';

// Flags and exit codes as the commands implement them (src/lib/cli/*.ts). Texts live in the
// `cli` messages: `<command>_flag_<id>` and `<command>_exit_<id>`. The output blocks below come
// from a real run on a two-locale demo project.

const USAGE = `npx svelte-dialect <command> [flags]`;

const TYPEGEN = `$ npx svelte-dialect typegen --messages src/lib/messages --out src/lib/i18n-keys.d.ts
svelte-dialect typegen: 3 keys → src/lib/i18n-keys.d.ts`;

const CHECK = `$ npx svelte-dialect check --unused
Missing:
  home:footer — missing in en, ru
  home:greeting — missing in ru
Unused:
  home:old
3 keys used, 2 missing, 1 unused
$ echo $?
1`;

const MIGRATE = `$ npx svelte-dialect migrate --dry-run --strict
svelte-dialect migrate: en/common.json — 3 converted, 0 unchanged, 1 warnings
  …
svelte-dialect migrate: 3 messages would change, 1 warnings (dry run, nothing written)
svelte-dialect migrate: --strict: 1 warnings, exiting with 1`;

const COMMANDS = {
	typegen: {
		flags: [
			{ id: 'messages', flag: '--messages <dir>', default: 'src/lib/messages' },
			{ id: 'from_json', flag: '--from-json <file>', default: '—' },
			{ id: 'out', flag: '--out <file>', default: 'src/lib/i18n-keys.d.ts' }
		],
		exits: [
			{ id: '0', code: '0' },
			{ id: '1', code: '1' }
		]
	},
	check: {
		flags: [
			{ id: 'messages', flag: '--messages <dir>', default: 'src/lib/messages' },
			{ id: 'src', flag: '--src <dir>', default: 'src' },
			{ id: 'unused', flag: '--unused', default: 'false' }
		],
		exits: [
			{ id: '0', code: '0' },
			{ id: '1', code: '1' }
		]
	},
	migrate: {
		flags: [
			{ id: 'messages', flag: '--messages <dir>', default: 'src/lib/messages' },
			{ id: 'dry_run', flag: '--dry-run', default: 'false' },
			{ id: 'strict', flag: '--strict', default: 'false' }
		],
		exits: [
			{ id: '0', code: '0' },
			{ id: 'strict', code: '1' },
			{ id: 'flat', code: '1' },
			{ id: '1', code: '1' }
		]
	}
} as const;

export const load: PageServerLoad = async () => ({
	commands: COMMANDS,
	usageCode: await highlight(USAGE, 'sh'),
	typegenCode: await highlight(TYPEGEN, 'sh'),
	checkCode: await highlight(CHECK, 'sh'),
	migrateCode: await highlight(MIGRATE, 'sh')
});
