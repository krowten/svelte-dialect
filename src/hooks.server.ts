import type { Handle } from '@sveltejs/kit/hooks';
import { handle as dialect } from '#lib/i18n.js';

export const handle: Handle = dialect;
