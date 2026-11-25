import type {
	AgentBehaviorState,
	AgentProfile,
	BindingsConfig,
	BuildingSlot,
	BuildingStylePreset,
	CameraPreset,
	ChatMessage,
	ModelPreset,
	VillageTelemetry,
	WorkOrder
} from '$lib/types/village';
import { VillageNavigationGraph, type Vec2 } from '$lib/agents/navigation';
import { computeMeetingSeats } from '$lib/agents/stateMachine';

export interface AgentRuntime {
	profile: AgentProfile;
	state: AgentBehaviorState;
	previousState: AgentBehaviorState;
	position: Vec2;
	yaw: number;
	path: Vec2[];
	lingerTimer: number;
	isWaving: boolean;
	portraitUrl: string;
	seatIndex: number;
}

export const DEFAULT_AGENTS: AgentProfile[] = [
	{
		id: 'chief-orchestrator',
		name: 'Mayor Vance',
		role: 'Chief / Orchestrator',
		specialty: 'Task Routing, Synthesis & Town Hall Meetings',
		buildingId: 'town-hall',
		buildingName: 'Town Hall HQ',
		buildingStyle: 'cottage',
		modelFile: 'villager_suit.glb',
		accentColor: '#eab308',
		hairColor: '#3f2e21',
		skinColor: '#f3c6a5',
		outfitColor: '#334155',
		systemPrompt: 'Coordinate network specialists, synthesize findings, and never expose CSV passwords.',
		deviceTags: ['all', 'hq', 'core'],
		isDefault: true
	},
	{
		id: 'firewall-specialist',
		name: 'Kira Ember',
		role: 'Firewall Specialist',
		specialty: 'FortiGate Policies, NAT, IPsec & SSL-VPN',
		buildingId: 'firewall-forge',
		buildingName: 'Firewall Forge',
		buildingStyle: 'workshop',
		modelFile: 'villager_hoodie.glb',
		accentColor: '#ef4444',
		hairColor: '#1f2937',
		skinColor: '#e5b899',
		outfitColor: '#991b1b',
		systemPrompt: 'Diagnose FortiGate policies, NAT rules, and IPsec/SSL-VPN tunnels in read-only mode by default.',
		deviceTags: ['fortigate', 'firewall', 'vpn', 'nat'],
		isDefault: true
	},
	{
		id: 'routing-specialist',
		name: 'Bram Copper',
		role: 'Routing & Switching Specialist',
		specialty: 'Cisco & MikroTik (RB951, FiberOne-HQ, ssh -J, MAC-telnet)',
		buildingId: 'router-yard',
		buildingName: 'Router Yard',
		buildingStyle: 'workshop',
		modelFile: 'villager_overalls.glb',
		accentColor: '#f97316',
		hairColor: '#7c2d12',
		skinColor: '#f1c29b',
		outfitColor: '#1d4ed8',
		systemPrompt: 'Use admin+ct200w@<ip> with print without-paging on MikroTik; respect ssh -J and MAC-telnet notes.',
		deviceTags: ['mikrotik', 'cisco', 'rb951', 'hq', 'jump-host'],
		isDefault: true
	},
	{
		id: 'wireguard-specialist',
		name: 'Soren Vale',
		role: 'WireGuard Specialist',
		specialty: 'Peers, Keys, AllowedIPs & Ovis DFR Tunnels',
		buildingId: 'wireguard-hub',
		buildingName: 'WireGuard Hub',
		buildingStyle: 'cabin',
		modelFile: 'villager_cardigan.glb',
		accentColor: '#10b981',
		hairColor: '#92400e',
		skinColor: '#f5d0b5',
		outfitColor: '#065f46',
		systemPrompt: 'Verify WireGuard peers, handshakes, AllowedIPs, and Ovis DFR connectivity before tunnel-dependent SSH.',
		deviceTags: ['wireguard', 'vpn', 'ovis-dfr', 'tunnel'],
		isDefault: true
	},
	{
		id: 'dns-specialist',
		name: 'Iris Reed',
		role: 'DNS Specialist',
		specialty: 'BIND named (/var/named/<zone>), YYYYMMDDNN & dig',
		buildingId: 'dns-tower',
		buildingName: 'DNS Observatory Tower',
		buildingStyle: 'observatory',
		modelFile: 'villager_field.glb',
		accentColor: '#3b82f6',
		hairColor: '#b45309',
		skinColor: '#f0c4a0',
		outfitColor: '#1e40af',
		systemPrompt: 'Follow strict BIND zone protocol: backup -DDMMYY + scp, increment YYYYMMDDNN, named-checkzone, systemctl restart named, dig @127.0.0.1.',
		deviceTags: ['dns', 'bind', 'named', 'afrinet'],
		isDefault: true
	}
];

export const DEFAULT_BUILDING_SLOTS: BuildingSlot[] = [
	{ id: 'town-hall', name: 'Town Hall HQ', agentId: 'chief-orchestrator', style: 'town-hall', accentColor: '#eab308', position: { x: 0, z: -15.5 }, doorPosition: { x: 0, z: -11.3 }, deskPosition: { x: 0, z: -14.5 }, footprint: { halfW: 4.8, halfD: 4.0 } },
	{ id: 'firewall-forge', name: 'Firewall Forge', agentId: 'firewall-specialist', style: 'firewall-forge', accentColor: '#ef4444', position: { x: -13.5, z: -9.5 }, doorPosition: { x: -13.5, z: -6.7 }, deskPosition: { x: -13.5, z: -9.2 }, footprint: { halfW: 2.8, halfD: 2.5 } },
	{ id: 'router-yard', name: 'Router Yard', agentId: 'routing-specialist', style: 'router-yard', accentColor: '#f97316', position: { x: 13.5, z: -9.5 }, doorPosition: { x: 13.5, z: -6.7 }, deskPosition: { x: 13.5, z: -9.2 }, footprint: { halfW: 2.7, halfD: 2.4 } },
	{ id: 'wireguard-hub', name: 'WireGuard Hub', agentId: 'wireguard-specialist', style: 'wireguard-hub', accentColor: '#10b981', position: { x: -13.5, z: 9.5 }, doorPosition: { x: -13.5, z: 6.8 }, deskPosition: { x: -13.5, z: 9.2 }, footprint: { halfW: 2.6, halfD: 2.4 } },
	{ id: 'dns-tower', name: 'DNS Observatory Tower', agentId: 'dns-specialist', style: 'dns-tower', accentColor: '#3b82f6', position: { x: 13.5, z: 1.5 }, doorPosition: { x: 10.6, z: 1.5 }, deskPosition: { x: 13.5, z: 1.5 }, footprint: { halfW: 2.6, halfD: 2.6 } }
];

export const EXPANSION_PLOTS: Array<{ position: Vec2; doorPosition: Vec2; deskPosition: Vec2 }> = [
	{ position: { x: -18.5, z: 0.5 }, doorPosition: { x: -15.6, z: 0.5 }, deskPosition: { x: -18.5, z: 0.5 } },
	{ position: { x: -6.5, z: 15.5 }, doorPosition: { x: -6.5, z: 12.7 }, deskPosition: { x: -6.5, z: 15.5 } },
	{ position: { x: 3.5, z: 15.5 }, doorPosition: { x: 3.5, z: 12.7 }, deskPosition: { x: 3.5, z: 15.5 } },
	{ position: { x: 20.5, z: -5.5 }, doorPosition: { x: 17.6, z: -5.5 }, deskPosition: { x: 20.5, z: -5.5 } },
	{ position: { x: -20.5, z: -15.5 }, doorPosition: { x: -17.6, z: -15.5 }, deskPosition: { x: -20.5, z: -15.5 } },
	{ position: { x: 20.5, z: -15.5 }, doorPosition: { x: 17.6, z: -15.5 }, deskPosition: { x: 20.5, z: -15.5 } }
];

export interface NewAgentInput {
	name: string;
	role: string;
	specialty?: string;
	systemPrompt: string;
	buildingName: string;
	buildingStyle: BuildingStylePreset;
	accentColor: string;
	outfitColor?: string;
	modelFile?: ModelPreset;
	deviceTags: string[];
}

export class VillageStore {
	agents = $state<AgentRuntime[]>([]);
	buildings = $state<BuildingSlot[]>([...DEFAULT_BUILDING_SLOTS]);
	bindings = $state<BindingsConfig>({ version: 1, buildings: {} });
	meetingActive = $state(false);
	selectedAgentId = $state<string>('chief-orchestrator');
	activeCameraPresetId = $state<string>('overview');
	lightingMode = $state<'daylight' | 'twilight'>('daylight');
	workOrders = $state<WorkOrder[]>([]);
	chats = $state<Record<string, ChatMessage[]>>({});
	telemetry = $state<VillageTelemetry>({
		demoMode: true,
		firewallAlertLevel: 'clear',
		activeSshSessions: 1,
		writeModeEnabled: false,
		vpnTunnelName: 'Ovis DFR',
		vpnConnected: true,
		vpnActivePeers: 4,
		dnsZoneChecking: false,
		lastDnsSerial: '2026112501',
		activeTurnAgentIds: []
	});

	navGraph = new VillageNavigationGraph(DEFAULT_BUILDING_SLOTS);

	constructor() {
		this.buildings = [...DEFAULT_BUILDING_SLOTS];
		this.navGraph.rebuild(this.buildings);
		this.agents = DEFAULT_AGENTS.map((profile, idx) => {
			const slot = this.buildings.find((b) => b.id === profile.buildingId) ?? this.buildings[0];
			return {
				profile,
				state: 'IDLE',
				previousState: 'IDLE',
				position: { x: slot.doorPosition.x, z: slot.doorPosition.z },
				yaw: 0,
				path: [],
				lingerTimer: 3 + idx * 2,
				isWaving: false,
				portraitUrl: '',
				seatIndex: idx
			};
		});
	}

	get cameraPresets(): CameraPreset[] {
		const presets: CameraPreset[] = [
			{ id: 'overview', label: 'Overview', position: [0, 26, 28], target: [0, 0, -2] },
			{ id: 'town-hall', label: 'Town Hall', position: [0, 9.5, -6.2], target: [0, 1.2, -14.5], buildingId: 'town-hall' },
			{ id: 'firewall-forge', label: 'Firewall Forge', position: [-13.5, 8.5, -1.5], target: [-13.5, 1.5, -9.5], buildingId: 'firewall-forge' },
			{ id: 'router-yard', label: 'Router Yard', position: [13.5, 8.5, -1.5], target: [13.5, 1.5, -9.5], buildingId: 'router-yard' },
			{ id: 'wireguard-hub', label: 'WireGuard Hub', position: [-13.5, 8.5, 16.5], target: [-13.5, 1.5, 9.5], buildingId: 'wireguard-hub' },
			{ id: 'dns-tower', label: 'DNS Tower', position: [5.5, 9.0, 6.5], target: [13.5, 2.0, 1.5], buildingId: 'dns-tower' },
			{ id: 'pond', label: 'Pond', position: [10.0, 8.0, 23.0], target: [16.5, 0.5, 15.0] }
		];
		for (const b of this.buildings) {
			if (!presets.some((p) => p.buildingId === b.id)) {
				presets.push({
					id: b.id,
					label: b.name,
					position: [b.position.x, 8.5, b.position.z + 7.5],
					target: [b.position.x, 1.5, b.position.z],
					buildingId: b.id
				});
			}
		}
		return presets;
	}

	addDynamicAgent(input: NewAgentInput): { agent: AgentRuntime; building: BuildingSlot } {
		const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
		const buildingId = `bldg-${slug}`;
		const expansionIndex = Math.max(0, this.buildings.length - DEFAULT_BUILDING_SLOTS.length);
		const plot = EXPANSION_PLOTS[expansionIndex] ?? {
			position: { x: -20 + (expansionIndex % 5) * 9, z: 21 + Math.floor(expansionIndex / 5) * 6 },
			doorPosition: { x: -20 + (expansionIndex % 5) * 9, z: 18.2 + Math.floor(expansionIndex / 5) * 6 },
			deskPosition: { x: -20 + (expansionIndex % 5) * 9, z: 21 + Math.floor(expansionIndex / 5) * 6 }
		};

		const building: BuildingSlot = {
			id: buildingId,
			name: input.buildingName || `${input.name}'s Workshop`,
			agentId: slug,
			style: input.buildingStyle || 'cottage',
			accentColor: input.accentColor || '#ec4899',
			position: { ...plot.position },
			doorPosition: { ...plot.doorPosition },
			deskPosition: { ...plot.deskPosition },
			footprint: { halfW: 2.5, halfD: 2.3 }
		};

		const profile: AgentProfile = {
			id: slug,
			name: input.name,
			role: input.role,
			specialty: input.specialty || input.role,
			buildingId,
			buildingName: building.name,
			buildingStyle: input.buildingStyle || 'cottage',
			modelFile: input.modelFile || 'villager_cardigan.glb',
			accentColor: input.accentColor || '#ec4899',
			hairColor: '#292524',
			skinColor: '#f3c6a5',
			outfitColor: input.outfitColor || input.accentColor || '#6d28d9',
			systemPrompt: input.systemPrompt,
			deviceTags: input.deviceTags
		};

		this.buildings = [...this.buildings, building];
		this.navGraph.rebuild(this.buildings);
		this.bindings = {
			...this.bindings,
			buildings: {
				...this.bindings.buildings,
				[buildingId]: {
					buildingId,
					buildingName: building.name,
					agentId: slug,
					deviceTags: input.deviceTags,
					modules: ['custom-specialist', 'csv-lookup']
				}
			}
		};

		const runtime: AgentRuntime = {
			profile,
			state: this.meetingActive ? 'MEETING' : 'IDLE',
			previousState: 'IDLE',
			position: { ...building.doorPosition },
			yaw: 0,
			path: [],
			lingerTimer: 4,
			isWaving: false,
			portraitUrl: '',
			seatIndex: this.agents.length
		};

		this.agents = [...this.agents, runtime];
		if (this.meetingActive) this.assignMeetingSeats();
		return { agent: runtime, building };
	}

	callMeeting(): void {
		this.meetingActive = true;
		this.activeCameraPresetId = 'town-hall';
		this.assignMeetingSeats();
	}

	endMeeting(): void {
		this.meetingActive = false;
		for (const agent of this.agents) {
			if (agent.state === 'MEETING') {
				agent.state = 'IDLE';
				const doorNode = this.navGraph.getNode('door-town-hall');
				const plazaNode = this.navGraph.getNode('plaza-n');
				if (doorNode && plazaNode) {
					agent.path = [{ x: doorNode.x, z: doorNode.z }, { x: plazaNode.x, z: plazaNode.z }];
				}
			}
		}
	}

	assignMeetingSeats(): void {
		const seats = computeMeetingSeats(this.agents.map((a) => a.profile.id));
		const townDoor = this.navGraph.getNode('door-town-hall') ?? { x: 0, z: -11.3 };
		for (const seat of seats) {
			const agent = this.agents.find((a) => a.profile.id === seat.agentId);
			if (!agent) continue;
			agent.seatIndex = seat.seatIndex;
			if (agent.state === 'ALERT') continue;
			agent.state = 'MEETING';
			const toDoor = this.navGraph.findPath(agent.position, { x: townDoor.x, z: townDoor.z }, 'door-town-hall');
			agent.path = [...toDoor, seat.position];
		}
	}

	triggerAgentAlert(agentId: string): void {
		const agent = this.agents.find((a) => a.profile.id === agentId);
		if (!agent) return;
		agent.previousState = agent.state;
		agent.state = 'ALERT';
		const bldg = this.buildings.find((b) => b.id === agent.profile.buildingId);
		if (bldg) {
			const doorId = `door-${bldg.id}`;
			agent.path = [...this.navGraph.findPath(agent.position, bldg.doorPosition, doorId), bldg.deskPosition];
		}
	}

	resolveAgentAlert(agentId: string): void {
		const agent = this.agents.find((a) => a.profile.id === agentId);
		if (!agent || agent.state !== 'ALERT') return;
		if (this.meetingActive) {
			agent.state = 'MEETING';
			this.assignMeetingSeats();
		} else {
			agent.state = 'IDLE';
			agent.lingerTimer = 2;
		}
	}

	stepSimulation(dt: number): void {
		for (const agent of this.agents) {
			const speed = agent.state === 'ALERT' ? 5.2 : 2.35;
			if (agent.path.length > 0) {
				const target = agent.path[0];
				const dx = target.x - agent.position.x;
				const dz = target.z - agent.position.z;
				const dist = Math.hypot(dx, dz);
				if (dist < 0.14) {
					agent.position = { x: target.x, z: target.z };
					agent.path.shift();
					if (agent.path.length === 0 && agent.state === 'MEETING') {
						const seats = computeMeetingSeats(this.agents.map((a) => a.profile.id));
						const mySeat = seats.find((s) => s.agentId === agent.profile.id);
						if (mySeat) agent.yaw = mySeat.facingYaw;
					}
				} else {
					const step = Math.min(dist, speed * dt);
					agent.position = {
						x: agent.position.x + (dx / dist) * step,
						z: agent.position.z + (dz / dist) * step
					};
					agent.yaw = Math.atan2(dx, dz);
				}
			} else if (agent.state === 'IDLE') {
				agent.lingerTimer -= dt;
				if (agent.lingerTimer <= 0) {
					agent.lingerTimer = 5 + Math.random() * 15;
					agent.isWaving = Math.random() < 0.25;
					const targets = this.navGraph.getReachableWanderTargets(agent.position);
					if (targets.length > 0) {
						const pick = targets[Math.floor(Math.random() * targets.length)];
						agent.path = this.navGraph.findPath(agent.position, { x: pick.x, z: pick.z }, pick.id);
					}
				}
			}
		}
	}
}
