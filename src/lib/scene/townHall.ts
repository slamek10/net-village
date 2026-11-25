import * as THREE from 'three';

export function createTownHall(position = { x: 0, z: -15.5 }) {
	const group = new THREE.Group();
	group.name = 'building-town-hall';
	group.position.set(position.x, 0, position.z);

	const wallMat = new THREE.MeshStandardMaterial({ color: '#f2e5d0', roughness: 0.72, transparent: true, opacity: 1 });
	const roofMat = new THREE.MeshStandardMaterial({ color: '#b85038', roughness: 0.65, transparent: true, opacity: 1 });
	const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.7 });

	const base = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.4, 7.6), new THREE.MeshStandardMaterial({ color: '#d8c3a5', roughness: 0.8 }));
	base.position.y = 0.2;
	base.receiveShadow = true;

	const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.0, 3.6, 0.35), wallMat);
	backWall.position.set(0, 2.0, -3.5);
	const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 7.2), wallMat);
	leftWall.position.set(-4.35, 2.0, 0);
	const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 7.2), wallMat);
	rightWall.position.set(4.35, 2.0, 0);
	const frontWall = new THREE.Mesh(new THREE.BoxGeometry(9.0, 3.6, 0.35), wallMat.clone());
	frontWall.position.set(0, 2.0, 3.5);

	const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.0, 4), roofMat);
	roof.position.set(0, 5.2, 0);
	roof.rotation.y = Math.PI / 4;

	const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 2.2), wallMat);
	tower.position.set(0, 6.2, -1.5);

	const crystalMat = new THREE.MeshStandardMaterial({ color: '#4deeea', emissive: '#1cc5dc', emissiveIntensity: 1.3 });
	const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), crystalMat);
	crystal.position.set(0, 8.5, -1.5);

	const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.16, 24), woodMat);
	tableTop.position.set(0, 0.95, 1.0);
	const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.75, 16), woodMat);
	tablePedestal.position.set(0, 0.55, 1.0);

	const chairsGroup = new THREE.Group();
	chairsGroup.position.set(0, 0, 1.0);
	group.add(base, backWall, leftWall, rightWall, frontWall, roof, tower, crystal, tableTop, tablePedestal, chairsGroup);

	const chairGeo = new THREE.BoxGeometry(0.55, 0.45, 0.55);
	const chairBackGeo = new THREE.BoxGeometry(0.55, 0.55, 0.1);

	function rebuildChairs(seatCount: number) {
		while (chairsGroup.children.length > 0) chairsGroup.remove(chairsGroup.children[0]);
		const count = Math.max(seatCount, 5);
		const radius = 2.35 + Math.max(0, count - 5) * 0.22;
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
			const chair = new THREE.Group();
			const seat = new THREE.Mesh(chairGeo, woodMat);
			seat.position.y = 0.42;
			const back = new THREE.Mesh(chairBackGeo, woodMat);
			back.position.set(0, 0.75, -0.22);
			chair.add(seat, back);
			chair.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
			chair.lookAt(0, 0.42, 0);
			chairsGroup.add(chair);
		}
	}
	rebuildChairs(5);

	return {
		group,
		rebuildChairs,
		update: (dt: number, cameraPos: THREE.Vector3, activeTurnCount: number, isMeetingCam: boolean) => {
			crystal.rotation.y += dt * (activeTurnCount > 0 ? 3.4 : 0.75);
			crystal.position.y = 8.5 + Math.sin(performance.now() * 0.003) * 0.14;
			crystalMat.emissiveIntensity = activeTurnCount > 0 ? 2.4 : 1.1;

			const shouldCutaway = isMeetingCam || cameraPos.distanceTo(group.position) < 16.5;
			const targetOpacity = shouldCutaway ? 0.12 : 1.0;
			const fMat = frontWall.material as THREE.MeshStandardMaterial;
			fMat.opacity += (targetOpacity - fMat.opacity) * Math.min(1, dt * 6);
			roofMat.opacity += (targetOpacity - roofMat.opacity) * Math.min(1, dt * 6);
			frontWall.visible = fMat.opacity > 0.15;
		}
	};
}
