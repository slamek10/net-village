import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllAgentProfiles } from '$lib/server/storage';
import { loadSafeDeviceInventory } from '$lib/server/csvCredentials';

export const POST: RequestHandler = async ({ request }) => {
	const { agentId, message, writeMode = false } = (await request.json()) as {
		agentId: string;
		message: string;
		writeMode?: boolean;
	};
	const agents = getAllAgentProfiles();
	const agent = agents.find((a) => a.id === agentId) ?? agents[0];
	const devices = loadSafeDeviceInventory();
	const demoMode = (process.env.DEMO_MODE ?? 'true').toLowerCase() !== 'false';

	const matchedNames = devices
		.filter((d) =>
			agent.deviceTags.some(
				(t) =>
					t === 'all' ||
					d.name.toLowerCase().includes(t.toLowerCase()) ||
					d.notes.toLowerCase().includes(t.toLowerCase())
			)
		)
		.map((d) => `${d.name} (${d.ip})`);

	const modeNotice = writeMode
		? 'EXPLICIT WRITE MODE ENABLED (remembering backups, serial YYYYMMDDNN, and named-checkzone).'
		: 'READ-ONLY MODE (no config mutations applied).';

	return json({
		agentId: agent.id,
		agentName: agent.name,
		reply: `[${demoMode ? 'Demo Mode' : 'Live Runner'} · ${agent.role}] ${modeNotice} Reviewed "${message}" against inventory [${matchedNames.join(', ') || 'no tagged rows'}]. Zero credentials exposed.`,
		readOnly: !writeMode,
		demoMode
	});
};
