/** The sidebar's structure: grouped pages, each with its own message key for the label. */
export const NAV = [
	{
		group: 'common:nav.groups.start',
		items: [
			{ path: '/setup', label: 'common:nav.setup' },
			{ path: '/messages', label: 'common:nav.messages' }
		]
	},
	{
		group: 'common:nav.groups.guides',
		items: [
			{ path: '/sources', label: 'common:nav.sources' },
			{ path: '/routing', label: 'common:nav.routing' },
			{ path: '/strategy', label: 'common:nav.strategy' },
			{ path: '/rich-text', label: 'common:nav.rich' },
			{ path: '/migrate', label: 'common:nav.migrate' }
		]
	},
	{
		group: 'common:nav.groups.reference',
		items: [
			{ path: '/typed-keys', label: 'common:nav.typed' },
			{ path: '/api', label: 'common:nav.api' },
			{ path: '/cli', label: 'common:nav.cli' },
			{ path: '/compare', label: 'common:nav.compare' }
		]
	}
] as const;

/** Every docs page in sidebar order, without the home page. */
export const PAGES = NAV.flatMap((group) => group.items.map((item) => item.path));
