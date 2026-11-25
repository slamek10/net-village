import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllAgentProfiles, readBindings, readRuntimeState, writeBindings, writeRuntimeState } from '$lib/server/storage';
import type { AgentProfile } from '$lib/types/village';

export const GET: RequestHandler = () => json({ agents: getAllAgentProfiles() });

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Partial<AgentProfile>;
	if (!body.name || !body.role) return json({ error: 'name and role are required' }, { status: 400 });

	const slug = body.id || `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
	const buildingId = body.buildingId || `bldg-${slug}`;
	const buildingName = body.buildingName || `${body.name}'s Workshop`;

	const profile: AgentProfile = {
		id: slug,
		name: body.name,
		role: body.role,
		specialty: body.specialty || body.role,
		buildingId,
		buildingName,
		buildingStyle: body.buildingStyle || 'cottage',
		modelFile: body.modelFile || 'villager_cardigan.glb',
		accentColor: body.accentColor || '#ec4899',
		hairColor: body.hairColor || '#292524',
		skinColor: body.skinColor || '#f3c6a5',
		outfitColor: body.outfitColor || body.accentColor || '#6d28d9',
		systemPrompt: body.systemPrompt || 'Follow CLAUDE.md read-only-by-default network operational rules.',
		deviceTags: Array.isArray(body.deviceTags) ? body.deviceTags : ['all']
	};

	const runtime = readRuntimeState();
	runtime.customAgents = [...runtime.customAgents.filter((a) => a.id !== profile.id), profile];
	writeRuntimeState(runtime);

	const bindings = readBindings();
	bindings.buildings[buildingId] = {
		buildingId,
		buildingName,
		agentId: profile.id,
		deviceTags: profile.deviceTags,
		modules: ['custom-specialist', 'csv-lookup']
	};
	writeBindings(bindings);

	return json({ agent: profile, buildingId }, { status: 201 });
};
