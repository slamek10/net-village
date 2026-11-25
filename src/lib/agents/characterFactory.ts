import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AgentProfile } from '$lib/types/village';
import { mapAvailableClip, type AnimationClipName } from './stateMachine';

export interface LoadedAgentRig {
	root: THREE.Group;
	mixer: THREE.AnimationMixer;
	actions: Record<AnimationClipName, THREE.AnimationAction | null>;
	currentClip: AnimationClipName;
	badgeMesh: THREE.Mesh;
	dispose: () => void;
}

const gltfCache = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }>();
const portraitCache = new Map<string, string>();
const loader = new GLTFLoader();

export async function loadBaseModel(modelFile: string) {
	const url = `/models/${modelFile}`;
	const cached = gltfCache.get(url);
	if (cached) return cached;
	const gltf = await loader.loadAsync(url);
	const entry = { scene: gltf.scene, animations: gltf.animations };
	gltfCache.set(url, entry);
	return entry;
}

export async function createAgentCharacter(profile: AgentProfile): Promise<LoadedAgentRig> {
	const base = await loadBaseModel(profile.modelFile);
	const cloned = SkeletonUtils.clone(base.scene) as THREE.Group;
	const root = new THREE.Group();
	root.name = `agent-${profile.id}`;
	root.add(cloned);

	const clonedMaterials: THREE.Material[] = [];
	const clonedGeometries: THREE.BufferGeometry[] = [];

	cloned.traverse((obj) => {
		if (obj instanceof THREE.Mesh) {
			obj.castShadow = true;
			obj.receiveShadow = true;
			if (obj.material) {
				const mat = (obj.material as THREE.MeshStandardMaterial).clone();
				mat.color = new THREE.Color(profile.outfitColor);
				mat.roughness = 0.62;
				obj.material = mat;
				clonedMaterials.push(mat);
			}
		}
	});

	const scarfGeo = new THREE.TorusGeometry(0.24, 0.045, 8, 18);
	const scarfMat = new THREE.MeshStandardMaterial({
		color: new THREE.Color(profile.accentColor),
		roughness: 0.45
	});
	const badgeMesh = new THREE.Mesh(scarfGeo, scarfMat);
	badgeMesh.rotation.x = Math.PI / 2;
	badgeMesh.position.set(0, 1.28, 0);
	root.add(badgeMesh);
	clonedGeometries.push(scarfGeo);
	clonedMaterials.push(scarfMat);

	const mixer = new THREE.AnimationMixer(cloned);
	const clipNames = base.animations.map((c) => c.name);
	const wanted: AnimationClipName[] = ['idle', 'walk', 'run', 'sit', 'talk', 'wave'];
	const actions = {} as Record<AnimationClipName, THREE.AnimationAction | null>;

	for (const w of wanted) {
		const matchedName = mapAvailableClip(w, clipNames);
		const clip = base.animations.find((c) => c.name === matchedName) ?? base.animations[0];
		actions[w] = clip ? mixer.clipAction(clip) : null;
	}
	if (actions.idle) actions.idle.play();

	return {
		root,
		mixer,
		actions,
		currentClip: 'idle',
		badgeMesh,
		dispose: () => {
			mixer.stopAllAction();
			mixer.uncacheRoot(cloned);
			for (const g of clonedGeometries) g.dispose();
			for (const m of clonedMaterials) m.dispose();
		}
	};
}

export function crossfadeAgentClip(rig: LoadedAgentRig, nextClip: AnimationClipName, duration = 0.22): void {
	if (rig.currentClip === nextClip) return;
	const prevAction = rig.actions[rig.currentClip];
	const nextAction = rig.actions[nextClip];
	if (!nextAction) return;
	nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
	if (prevAction && prevAction !== nextAction) prevAction.fadeOut(duration);
	rig.currentClip = nextClip;
}

export function renderAgentPortrait(
	renderer: THREE.WebGLRenderer,
	rig: LoadedAgentRig,
	profile: AgentProfile
): string {
	const cacheKey = `${profile.id}:${profile.modelFile}:${profile.accentColor}:${profile.outfitColor}`;
	const existing = portraitCache.get(cacheKey);
	if (existing) return existing;
	if (typeof document === 'undefined') return '';

	const size = 128;
	const rt = new THREE.WebGLRenderTarget(size, size);
	const portraitScene = new THREE.Scene();
	portraitScene.background = new THREE.Color('#27221d');
	portraitScene.add(new THREE.HemisphereLight('#fff4e0', '#3d332a', 1.5));
	const key = new THREE.DirectionalLight('#ffe6c2', 1.8);
	key.position.set(1.5, 2.5, 2.5);
	portraitScene.add(key);

	const cloneForShot = SkeletonUtils.clone(rig.root) as THREE.Group;
	cloneForShot.rotation.set(0, 0.25, 0);
	portraitScene.add(cloneForShot);

	const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 10);
	cam.position.set(0, 1.44, 1.35);
	cam.lookAt(0, 1.42, 0);

	const prevTarget = renderer.getRenderTarget();
	renderer.setRenderTarget(rt);
	renderer.render(portraitScene, cam);

	const buffer = new Uint8Array(size * size * 4);
	renderer.readRenderTargetPixels(rt, 0, 0, size, size, buffer);
	renderer.setRenderTarget(prevTarget);
	rt.dispose();

	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	const imgData = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) {
		const srcRow = (size - 1 - y) * size * 4;
		imgData.data.set(buffer.subarray(srcRow, srcRow + size * 4), y * size * 4);
	}
	ctx.putImageData(imgData, 0, 0);
	const url = canvas.toDataURL('image/png');
	portraitCache.set(cacheKey, url);
	return url;
}
