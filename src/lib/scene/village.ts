import * as THREE from 'three';

export function createVillageEnvironment() {
	const group = new THREE.Group();
	group.name = 'village-environment';

	const ground = new THREE.Mesh(new THREE.CircleGeometry(46, 48), new THREE.MeshStandardMaterial({ color: '#7ea15b', roughness: 0.92 }));
	ground.rotation.x = -Math.PI / 2;
	ground.receiveShadow = true;

	const plaza = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.0, 0.12, 32), new THREE.MeshStandardMaterial({ color: '#cbbba0', roughness: 0.85 }));
	plaza.position.y = 0.06;
	plaza.receiveShadow = true;

	const fountainBasin = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.65, 24), new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.78 }));
	fountainBasin.position.y = 0.35;
	fountainBasin.castShadow = true;

	const pond = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.18, 11.5), new THREE.MeshStandardMaterial({ color: '#2b9eb3', roughness: 0.22 }));
	pond.position.set(17.5, 0.05, 15.5);

	const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 1.5), new THREE.MeshStandardMaterial({ color: '#7f5539', roughness: 0.8 }));
	dock.position.set(11.4, 0.22, 13.5);

	const boat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.95), new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.7 }));
	boat.position.set(14.5, 0.24, 14.5);

	group.add(ground, plaza, fountainBasin, pond, dock, boat);

	const treePositions: [number, number][] = [
		[-22, -18], [-24, -4], [-22, 12], [-18, 22], [2, 22],
		[24, -18], [26, -2], [26, 12], [-8, -24], [10, -24]
	];
	const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.38, 1.8, 8), new THREE.MeshStandardMaterial({ color: '#6f4e37', roughness: 0.85 }), treePositions.length);
	const crowns = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.45, 1), new THREE.MeshStandardMaterial({ color: '#4c7c34', roughness: 0.78 }), treePositions.length);
	trunks.castShadow = true;
	crowns.castShadow = true;

	const dummy = new THREE.Object3D();
	treePositions.forEach(([tx, tz], i) => {
		dummy.position.set(tx, 0.9, tz);
		dummy.scale.set(1, 1, 1);
		dummy.updateMatrix();
		trunks.setMatrixAt(i, dummy.matrix);
		dummy.position.set(tx, 2.5, tz);
		dummy.scale.set(1 + (i % 3) * 0.12, 1.1, 1 + (i % 2) * 0.12);
		dummy.updateMatrix();
		crowns.setMatrixAt(i, dummy.matrix);
	});
	group.add(trunks, crowns);

	const lampBulbMat = new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fbbf24', emissiveIntensity: 0.2 });
	const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 2.6, 8);
	const poleMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.5 });
	const bulbGeo = new THREE.SphereGeometry(0.22, 10, 10);
	for (const [lx, lz] of [[-6.2, -5.2], [6.2, -5.2], [-6.2, 5.2], [6.2, 5.2], [9.6, 12.2]]) {
		const pole = new THREE.Mesh(poleGeo, poleMat);
		pole.position.set(lx, 1.3, lz);
		const bulb = new THREE.Mesh(bulbGeo, lampBulbMat);
		bulb.position.set(lx, 2.75, lz);
		group.add(pole, bulb);
	}

	const hemiLight = new THREE.HemisphereLight('#fff5e4', '#4a5d3f', 1.15);
	const sunLight = new THREE.DirectionalLight('#ffedd5', 1.85);
	sunLight.position.set(22, 32, 18);
	sunLight.castShadow = true;
	sunLight.shadow.mapSize.set(2048, 2048);
	sunLight.shadow.camera.near = 5;
	sunLight.shadow.camera.far = 90;
	sunLight.shadow.camera.left = -32;
	sunLight.shadow.camera.right = 32;
	sunLight.shadow.camera.top = 32;
	sunLight.shadow.camera.bottom = -32;
	group.add(hemiLight, sunLight);

	return {
		group,
		setLightingMode: (mode: 'daylight' | 'twilight') => {
			if (mode === 'twilight') {
				hemiLight.color.set('#93c5fd');
				hemiLight.groundColor.set('#1e293b');
				hemiLight.intensity = 0.7;
				sunLight.color.set('#c4b5fd');
				sunLight.intensity = 0.85;
				lampBulbMat.emissiveIntensity = 2.6;
			} else {
				hemiLight.color.set('#fff5e4');
				hemiLight.groundColor.set('#4a5d3f');
				hemiLight.intensity = 1.15;
				sunLight.color.set('#ffedd5');
				sunLight.intensity = 1.85;
				lampBulbMat.emissiveIntensity = 0.2;
			}
		},
		update: () => {
			boat.position.y = 0.24 + Math.sin(performance.now() * 0.002) * 0.04;
			boat.rotation.z = Math.sin(performance.now() * 0.0015) * 0.04;
		}
	};
}
