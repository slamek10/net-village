import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { VillageNavigationGraph, POND_OBSTACLE } from '../src/lib/agents/navigation';
import { resolveAnimationClip, computeMeetingSeats } from '../src/lib/agents/stateMachine';
import { VillageStore, DEFAULT_BUILDING_SLOTS } from '../src/lib/state/bastion3d.svelte';
import { parseRfc4180Csv } from '../src/lib/server/csvCredentials';
import { disposeThreeResources } from '../src/lib/scene/disposer';

describe('net-village navigation & dynamic buildings', () => {
	it('finds obstacle-free A* paths between all building doors including dynamically added ones', () => {
		const store = new VillageStore();
		store.addDynamicAgent({
			name: 'Lina BGP',
			role: 'BGP Peering Specialist',
			systemPrompt: 'Inspect BGP sessions read-only.',
			buildingName: 'Peering Cottage',
			buildingStyle: 'cottage',
			accentColor: '#ec4899',
			deviceTags: ['bgp', 'core']
		});

		const doors = store.buildings.map((b) => `door-${b.id}`);
		for (let i = 0; i < doors.length; i++) {
			for (let j = i + 1; j < doors.length; j++) {
				const a = store.navGraph.getNode(doors[i])!;
				const b = store.navGraph.getNode(doors[j])!;
				const path = store.navGraph.findPath({ x: a.x, z: a.z }, { x: b.x, z: b.z }, b.id);
				expect(path.length).toBeGreaterThan(1);
				for (let k = 0; k < path.length - 1; k++) {
					expect(store.navGraph.isSegmentBlocked(path[k], path[k + 1])).toBe(false);
				}
			}
		}
	});

	it('picks only reachable exterior wander targets and avoids the pond', () => {
		const nav = new VillageNavigationGraph(DEFAULT_BUILDING_SLOTS);
		const reachable = nav.getReachableWanderTargets({ x: 0, z: 5.5 });
		expect(reachable.length).toBeGreaterThan(5);
		for (const node of reachable) {
			const insidePond =
				node.x >= POND_OBSTACLE.minX &&
				node.x <= POND_OBSTACLE.maxX &&
				node.z >= POND_OBSTACLE.minZ &&
				node.z <= POND_OBSTACLE.maxZ;
			expect(insidePond).toBe(false);
		}
	});
});

describe('state machine & Town Hall meetings', () => {
	it('selects accurate animation clips for IDLE, WORKING, COLLAB, ALERT, SPEAKING, and MEETING', () => {
		expect(resolveAnimationClip('IDLE', false)).toBe('idle');
		expect(resolveAnimationClip('IDLE', true)).toBe('walk');
		expect(resolveAnimationClip('WORKING', false)).toBe('talk');
		expect(resolveAnimationClip('COLLAB', false)).toBe('talk');
		expect(resolveAnimationClip('ALERT', true)).toBe('run');
		expect(resolveAnimationClip('SPEAKING', false)).toBe('talk');
		expect(resolveAnimationClip('MEETING', true)).toBe('walk');
		expect(resolveAnimationClip('MEETING', false)).toBe('sit');
	});

	it('seats every agent in a distinct chair and lets an ALERT agent leave and return', () => {
		const store = new VillageStore();
		store.callMeeting();
		expect(store.meetingActive).toBe(true);
		const seatIndices = new Set(store.agents.map((a) => a.seatIndex));
		expect(seatIndices.size).toBe(store.agents.length);

		const seats = computeMeetingSeats(store.agents.map((a) => a.profile.id));
		expect(seats).toHaveLength(store.agents.length);

		store.triggerAgentAlert('firewall-specialist');
		const fw = store.agents.find((a) => a.profile.id === 'firewall-specialist')!;
		expect(fw.state).toBe('ALERT');

		store.resolveAgentAlert('firewall-specialist');
		expect(fw.state).toBe('MEETING');
	});
});

describe('CSV credential parsing & Three.js disposer', () => {
	it('parses quoted notes containing commas without splitting columns', () => {
		const csv = 'name,ip,port,user,password,notes\nFiberOne-HQ,10.20.20.20,22,admin,secret,"MikroTik v6, identity ONE Broadband HQ"';
		const rows = parseRfc4180Csv(csv);
		expect(rows[1][0]).toBe('FiberOne-HQ');
		expect(rows[1][5]).toBe('MikroTik v6, identity ONE Broadband HQ');
	});

	it('disposes geometries, materials, textures, mixers, render targets, and renderer', () => {
		const scene = new THREE.Scene();
		const geo = new THREE.BoxGeometry(1, 1, 1);
		const tex = new THREE.Texture();
		const mat = new THREE.MeshStandardMaterial({ map: tex });
		scene.add(new THREE.Mesh(geo, mat));

		const geoSpy = vi.spyOn(geo, 'dispose');
		const matSpy = vi.spyOn(mat, 'dispose');
		const texSpy = vi.spyOn(tex, 'dispose');
		const rt = new THREE.WebGLRenderTarget(32, 32);
		const rtSpy = vi.spyOn(rt, 'dispose');

		const mockRenderer = {
			renderLists: { dispose: vi.fn() },
			dispose: vi.fn()
		} as unknown as THREE.WebGLRenderer;

		disposeThreeResources({ scene, renderer: mockRenderer, renderTargets: [rt] });

		expect(geoSpy).toHaveBeenCalledOnce();
		expect(matSpy).toHaveBeenCalledOnce();
		expect(texSpy).toHaveBeenCalledOnce();
		expect(rtSpy).toHaveBeenCalledOnce();
		expect(mockRenderer.dispose).toHaveBeenCalledOnce();
	});
});
