import * as THREE from 'three';
import type { BuildingSlot } from '$lib/types/village';

export interface SpecialistBuildingHandle {
	group: THREE.Group;
	update: (
		dt: number,
		state: {
			alertLevel?: 'clear' | 'amber' | 'red';
			activeSessions?: number;
			writeMode?: boolean;
			vpnConnected?: boolean;
			dnsChecking?: boolean;
		}
	) => void;
}

export function createFirewallForge(slot: BuildingSlot): SpecialistBuildingHandle {
	const group = new THREE.Group();
	group.position.set(slot.position.x, 0, slot.position.z);
	const beaconMat = new THREE.MeshStandardMaterial({ color: '#1f2937', emissive: '#000000', emissiveIntensity: 0 });
	const body = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.2, 4.4), new THREE.MeshStandardMaterial({ color: '#5c6470', roughness: 0.85 }));
	body.position.y = 1.6;
	body.castShadow = true;
	const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 1.8, 4), new THREE.MeshStandardMaterial({ color: '#3b4252', roughness: 0.7 }));
	roof.position.y = 4.1;
	roof.rotation.y = Math.PI / 4;
	const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), beaconMat);
	beacon.position.set(0, 5.15, 0);
	group.add(body, roof, beacon);

	let phase = 0;
	return {
		group,
		update: (dt, st) => {
			phase += dt;
			const lvl = st.alertLevel ?? 'clear';
			if (lvl === 'red') {
				beaconMat.emissive.set('#ef4444');
				beaconMat.emissiveIntensity = Math.sin(phase * 14) > 0 ? 3.2 : 0.2;
			} else if (lvl === 'amber') {
				beaconMat.emissive.set('#f59e0b');
				beaconMat.emissiveIntensity = 0.8 + Math.sin(phase * 3) * 0.6;
			} else {
				beaconMat.emissive.set('#000000');
				beaconMat.emissiveIntensity = 0;
			}
		}
	};
}

export function createRouterYard(slot: BuildingSlot): SpecialistBuildingHandle {
	const group = new THREE.Group();
	group.position.set(slot.position.x, 0, slot.position.z);
	const modeLedMat = new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 1.4 });
	const shed = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.9, 4.2), new THREE.MeshStandardMaterial({ color: '#8d5b4c', roughness: 0.78 }));
	shed.position.y = 1.45;
	shed.castShadow = true;
	const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 4.2, 10), new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.6 }));
	mast.position.set(1.8, 4.2, -1.4);
	const modeBeacon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.2), modeLedMat);
	modeBeacon.position.set(0, 2.6, 2.15);
	group.add(shed, mast, modeBeacon);

	return {
		group,
		update: (_dt, st) => {
			const col = st.writeMode ? '#f97316' : '#22c55e';
			modeLedMat.color.set(col);
			modeLedMat.emissive.set(col);
			modeLedMat.emissiveIntensity = (st.activeSessions ?? 0) > 0 ? 2.2 : 1.0;
		}
	};
}

export function createWireguardHub(slot: BuildingSlot): SpecialistBuildingHandle {
	const group = new THREE.Group();
	group.position.set(slot.position.x, 0, slot.position.z);
	const ringMat = new THREE.MeshStandardMaterial({ color: '#34d399', emissive: '#10b981', emissiveIntensity: 1.2, transparent: true, opacity: 0.8 });
	const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.8, 4.2), new THREE.MeshStandardMaterial({ color: '#7c5338', roughness: 0.8 }));
	cabin.position.y = 1.4;
	cabin.castShadow = true;
	const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.8, 4), new THREE.MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.7 }));
	roof.position.y = 3.7;
	roof.rotation.y = Math.PI / 4;
	const pulseRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.05, 8, 24), ringMat);
	pulseRing.rotation.x = Math.PI / 2;
	pulseRing.position.set(-1.5, 5.2, -1.2);
	group.add(cabin, roof, pulseRing);

	let t = 0;
	return {
		group,
		update: (dt, st) => {
			t += dt;
			if (st.vpnConnected) {
				const s = 0.7 + ((t * 1.1) % 1) * 1.3;
				pulseRing.scale.set(s, s, 1);
				ringMat.opacity = Math.max(0.15, 1.1 - ((t * 1.1) % 1));
				ringMat.emissive.set('#10b981');
			} else {
				pulseRing.scale.set(0.6, 0.6, 1);
				ringMat.opacity = 0.25;
				ringMat.emissive.set('#64748b');
			}
		}
	};
}

export function createDnsTower(slot: BuildingSlot): SpecialistBuildingHandle {
	const group = new THREE.Group();
	group.position.set(slot.position.x, 0, slot.position.z);
	const domeMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', emissive: '#2563eb', emissiveIntensity: 0.35 });
	const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.4, 4.4, 16), new THREE.MeshStandardMaterial({ color: '#e9dcc9', roughness: 0.76 }));
	tower.position.y = 2.2;
	tower.castShadow = true;
	const dome = new THREE.Mesh(new THREE.SphereGeometry(2.05, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
	dome.position.y = 4.4;
	group.add(tower, dome);

	let phase = 0;
	return {
		group,
		update: (dt, st) => {
			phase += dt;
			domeMat.emissiveIntensity = st.dnsChecking ? 1.6 + Math.sin(phase * 8) * 0.8 : 0.35;
		}
	};
}

export function createDynamicHouse(slot: BuildingSlot): SpecialistBuildingHandle {
	const group = new THREE.Group();
	group.position.set(slot.position.x, 0, slot.position.z);
	const wallColor = slot.style === 'cabin' ? '#8c5a3c' : slot.style === 'workshop' ? '#64748b' : '#f3e7d3';
	const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 4.0), new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.75 }));
	body.position.y = 1.4;
	body.castShadow = true;
	const roofMat = new THREE.MeshStandardMaterial({ color: slot.accentColor, roughness: 0.62 });
	const roof = slot.style === 'observatory'
		? new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), roofMat)
		: new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.8, 4), roofMat);
	roof.position.y = slot.style === 'observatory' ? 2.8 : 3.7;
	if (slot.style !== 'observatory') roof.rotation.y = Math.PI / 4;
	const emblem = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.16), new THREE.MeshStandardMaterial({ color: slot.accentColor, emissive: slot.accentColor, emissiveIntensity: 0.4 }));
	emblem.position.set(0, 2.35, 2.05);
	group.add(body, roof, emblem);
	return { group, update: () => {} };
}
