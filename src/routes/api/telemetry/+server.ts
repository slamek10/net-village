import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { VillageTelemetry } from '$lib/types/village';

export const GET: RequestHandler = () => {
	const demoMode = (process.env.DEMO_MODE ?? 'true').toLowerCase() !== 'false';
	const payload: VillageTelemetry = {
		demoMode,
		firewallAlertLevel: 'clear',
		activeSshSessions: 1,
		writeModeEnabled: false,
		vpnTunnelName: 'Ovis DFR',
		vpnConnected: true,
		vpnActivePeers: 4,
		dnsZoneChecking: false,
		lastDnsSerial: '2026112501',
		activeTurnAgentIds: []
	};
	return json(payload);
};
