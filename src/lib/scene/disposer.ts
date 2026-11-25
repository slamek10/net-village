import * as THREE from 'three';

export interface DisposableSceneBundle {
	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	mixers?: THREE.AnimationMixer[];
	renderTargets?: THREE.WebGLRenderTarget[];
	onExtraDispose?: () => void;
}

export function disposeThreeResources(bundle: DisposableSceneBundle): void {
	bundle.onExtraDispose?.();
	if (bundle.mixers) {
		for (const mixer of bundle.mixers) mixer.stopAllAction();
	}
	if (bundle.renderTargets) {
		for (const rt of bundle.renderTargets) rt.dispose();
	}

	const disposedGeos = new Set<THREE.BufferGeometry>();
	const disposedMats = new Set<THREE.Material>();
	const disposedTex = new Set<THREE.Texture>();

	bundle.scene.traverse((obj) => {
		if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
			if (obj.geometry && !disposedGeos.has(obj.geometry)) {
				obj.geometry.dispose();
				disposedGeos.add(obj.geometry);
			}
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			for (const m of mats) {
				if (!m || disposedMats.has(m)) continue;
				for (const val of Object.values(m)) {
					if (val instanceof THREE.Texture && !disposedTex.has(val)) {
						val.dispose();
						disposedTex.add(val);
					}
				}
				m.dispose();
				disposedMats.add(m);
			}
		}
	});

	bundle.scene.clear();
	bundle.renderer.renderLists.dispose();
	bundle.renderer.dispose();
}
