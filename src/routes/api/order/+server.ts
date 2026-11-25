import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readRuntimeState, writeRuntimeState } from '$lib/server/storage';
import type { WorkOrder } from '$lib/types/village';

export const GET: RequestHandler = () => json({ orders: readRuntimeState().workOrders });

export const POST: RequestHandler = async ({ request }) => {
	const { agentId, title, instructions } = (await request.json()) as {
		agentId: string;
		title?: string;
		instructions: string;
	};
	if (!agentId || !instructions?.trim()) {
		return json({ error: 'agentId and instructions are required' }, { status: 400 });
	}
	const now = new Date().toISOString();
	const order: WorkOrder = {
		id: `wo-${Date.now().toString(36)}`,
		agentId,
		title: title?.trim() || instructions.trim().slice(0, 48),
		instructions: instructions.trim(),
		status: 'running',
		createdAt: now,
		updatedAt: now
	};
	const state = readRuntimeState();
	state.workOrders = [order, ...state.workOrders];
	writeRuntimeState(state);
	return json({ order }, { status: 201 });
};
