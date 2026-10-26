import type { Reroute } from '@sveltejs/kit/hooks';
import { reroute as dialect } from '#lib/i18n.js';

export const reroute: Reroute = dialect;
