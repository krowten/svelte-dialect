// The site ships prerendered to plain files. The SSR build turns this off (ADAPTER=node), because
// a prerendered page is served as a file and never reaches `handle` — nothing to negotiate.
export const prerender = import.meta.env.VITE_PRERENDER !== 'false';
