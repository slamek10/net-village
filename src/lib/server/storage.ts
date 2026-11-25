import fs from 'node:fs';
import path from 'node:path';
import type { AgentProfile, BindingsConfig, WorkOrder } from '$lib/types/village';
import { DEFAULT_AGENTS } from '$lib/state/bastion3d.svelte';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const BINDINGS_FILE = path.join(DATA_DIR, 'bindings.json');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime-state.json');

export interface PersistedVillageState {
	customAgents: AgentProfile[];
	workOrders: WorkOrder[];
}

export function readBindings(): BindingsConfig {
	if (!fs.existsSync(BINDINGS_FILE)) return { version: 1, buildings: {} };
	const parsed = JSON.parse(fs.readFileSync(BINDINGS_FILE, 'utf-8')) as BindingsConfig;
	return { version: parsed.version ?? 1, buildings: parsed.buildings ?? {} };
}

export function writeBindings(config: BindingsConfig): void {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.writeFileSync(BINDINGS_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function readRuntimeState(): PersistedVillageState {
	if (!fs.existsSync(RUNTIME_FILE)) return { customAgents: [], workOrders: [] };
	return JSON.parse(fs.readFileSync(RUNTIME_FILE, 'utf-8')) as PersistedVillageState;
}

export function writeRuntimeState(state: PersistedVillageState): void {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	fs.writeFileSync(RUNTIME_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function getAllAgentProfiles(): AgentProfile[] {
	return [...DEFAULT_AGENTS, ...readRuntimeState().customAgents];
}
