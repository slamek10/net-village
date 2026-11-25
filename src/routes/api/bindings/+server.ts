import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readBindings, writeBindings } from '$lib/server/storage';
import type { BindingsConfig } from '$lib/types/village';

export const GET: RequestHandler = () => json(readBindings());

export const PUT: RequestHandler = async ({ request }) => {
	const incoming = (await request.json()) as BindingsConfig;
	const clean: BindingsConfig = { version: 1, buildings: incoming.buildings ?? {} };
	writeBindings(clean);
	return json(clean);
};
