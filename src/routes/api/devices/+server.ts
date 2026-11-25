import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSafeDeviceInventory } from '$lib/server/csvCredentials';

export const GET: RequestHandler = () => json({ devices: loadSafeDeviceInventory() });
