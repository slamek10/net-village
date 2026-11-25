export type AgentBehaviorState = 'IDLE' | 'WORKING' | 'COLLAB' | 'ALERT' | 'SPEAKING' | 'MEETING';
export type BuildingStylePreset = 'cottage' | 'observatory' | 'workshop' | 'cabin';
export type ModelPreset =
	| 'villager_suit.glb'
	| 'villager_hoodie.glb'
	| 'villager_overalls.glb'
	| 'villager_cardigan.glb'
	| 'villager_field.glb';

export interface AgentProfile {
	id: string;
	name: string;
	role: string;
	specialty: string;
	buildingId: string;
	buildingName: string;
	buildingStyle: BuildingStylePreset;
	modelFile: ModelPreset;
	accentColor: string;
	hairColor: string;
	skinColor: string;
	outfitColor: string;
	systemPrompt: string;
	deviceTags: string[];
	isDefault?: boolean;
}

export interface BuildingSlot {
	id: string;
	name: string;
	agentId: string;
	style: BuildingStylePreset | 'town-hall' | 'firewall-forge' | 'router-yard' | 'wireguard-hub' | 'dns-tower';
	accentColor: string;
	position: { x: number; z: number };
	doorPosition: { x: number; z: number };
	deskPosition: { x: number; z: number };
	footprint: { halfW: number; halfD: number };
}

export interface BuildingBinding {
	buildingId: string;
	buildingName: string;
	agentId: string;
	deviceTags: string[];
	modules: string[];
}

export interface BindingsConfig {
	version: number;
	buildings: Record<string, BuildingBinding>;
}

export interface WorkOrder {
	id: string;
	agentId: string;
	title: string;
	instructions: string;
	status: 'queued' | 'running' | 'completed' | 'failed';
	createdAt: string;
	updatedAt: string;
	summary?: string;
}

export interface ChatMessage {
	id: string;
	agentId: string;
	sender: 'user' | 'agent' | 'system';
	text: string;
	timestamp: string;
	readOnlyMode?: boolean;
}

export interface VillageTelemetry {
	demoMode: boolean;
	firewallAlertLevel: 'clear' | 'amber' | 'red';
	activeSshSessions: number;
	writeModeEnabled: boolean;
	vpnTunnelName: string;
	vpnConnected: boolean;
	vpnActivePeers: number;
	dnsZoneChecking: boolean;
	lastDnsSerial: string;
	activeTurnAgentIds: string[];
}

export interface CameraPreset {
	id: string;
	label: string;
	position: [number, number, number];
	target: [number, number, number];
	buildingId?: string;
}
