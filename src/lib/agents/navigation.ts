import type { BuildingSlot } from '$lib/types/village';

export interface Vec2 {
	x: number;
	z: number;
}

export interface WaypointNode {
	id: string;
	x: number;
	z: number;
	kind: 'plaza' | 'path' | 'dock' | 'door' | 'desk' | 'chair';
	buildingId?: string;
	neighbors: string[];
}

export interface RectObstacle {
	id: string;
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

export const POND_OBSTACLE: RectObstacle = {
	id: 'village-pond',
	minX: 11.5,
	maxX: 23.5,
	minZ: 9.5,
	maxZ: 21.5
};

export const FOUNTAIN_OBSTACLE: RectObstacle = {
	id: 'plaza-fountain',
	minX: -2.4,
	maxX: 2.4,
	minZ: -2.4,
	maxZ: 2.4
};

export function segmentIntersectsRect(a: Vec2, b: Vec2, rect: RectObstacle, pad = 0.25): boolean {
	const minX = rect.minX - pad;
	const maxX = rect.maxX + pad;
	const minZ = rect.minZ - pad;
	const maxZ = rect.maxZ + pad;

	let t0 = 0;
	let t1 = 1;
	const dx = b.x - a.x;
	const dz = b.z - a.z;

	const checks: [number, number][] = [
		[-dx, a.x - minX],
		[dx, maxX - a.x],
		[-dz, a.z - minZ],
		[dz, maxZ - a.z]
	];

	for (const [p, q] of checks) {
		if (Math.abs(p) < 1e-8) {
			if (q < 0) return false;
		} else {
			const r = q / p;
			if (p < 0) {
				if (r > t1) return false;
				if (r > t0) t0 = r;
			} else {
				if (r < t0) return false;
				if (r < t1) t1 = r;
			}
		}
	}
	return t0 <= t1;
}

export class VillageNavigationGraph {
	private nodes = new Map<string, WaypointNode>();
	private obstacles: RectObstacle[] = [POND_OBSTACLE, FOUNTAIN_OBSTACLE];

	constructor(buildings: BuildingSlot[] = []) {
		this.rebuild(buildings);
	}

	rebuild(buildings: BuildingSlot[]): void {
		this.nodes.clear();
		this.obstacles = [POND_OBSTACLE, FOUNTAIN_OBSTACLE];

		const baseNodes: Omit<WaypointNode, 'neighbors'>[] = [
			{ id: 'plaza-n', x: 0, z: -5.5, kind: 'plaza' },
			{ id: 'plaza-s', x: 0, z: 5.5, kind: 'plaza' },
			{ id: 'plaza-e', x: 5.5, z: 0, kind: 'plaza' },
			{ id: 'plaza-w', x: -5.5, z: 0, kind: 'plaza' },
			{ id: 'plaza-nw', x: -4.2, z: -4.2, kind: 'plaza' },
			{ id: 'plaza-ne', x: 4.2, z: -4.2, kind: 'plaza' },
			{ id: 'plaza-sw', x: -4.2, z: 4.2, kind: 'plaza' },
			{ id: 'plaza-se', x: 4.2, z: 4.2, kind: 'plaza' },
			{ id: 'bench-w', x: -6.8, z: -2.2, kind: 'path' },
			{ id: 'bench-e', x: 6.8, z: 2.2, kind: 'path' },
			{ id: 'path-north', x: 0, z: -9.5, kind: 'path' },
			{ id: 'path-nw-loop', x: -10.5, z: -8.5, kind: 'path' },
			{ id: 'path-ne-loop', x: 10.5, z: -8.5, kind: 'path' },
			{ id: 'path-sw-loop', x: -10.5, z: 8.5, kind: 'path' },
			{ id: 'path-se-approach', x: 8.5, z: 8.5, kind: 'path' },
			{ id: 'pond-dock', x: 10.6, z: 13.5, kind: 'dock' },
			{ id: 'path-south-west', x: -15.5, z: 14.0, kind: 'path' },
			{ id: 'path-north-west', x: -16.5, z: -13.5, kind: 'path' },
			{ id: 'path-north-east', x: 16.5, z: -13.5, kind: 'path' }
		];

		for (const n of baseNodes) {
			this.nodes.set(n.id, { ...n, neighbors: [] });
		}

		for (const b of buildings) {
			if (b.id !== 'town-hall') {
				this.obstacles.push({
					id: `building-${b.id}`,
					minX: b.position.x - b.footprint.halfW,
					maxX: b.position.x + b.footprint.halfW,
					minZ: b.position.z - b.footprint.halfD,
					maxZ: b.position.z + b.footprint.halfD
				});
			}

			const doorId = `door-${b.id}`;
			const deskId = `desk-${b.id}`;
			this.nodes.set(doorId, {
				id: doorId,
				x: b.doorPosition.x,
				z: b.doorPosition.z,
				kind: 'door',
				buildingId: b.id,
				neighbors: [deskId]
			});
			this.nodes.set(deskId, {
				id: deskId,
				x: b.deskPosition.x,
				z: b.deskPosition.z,
				kind: 'desk',
				buildingId: b.id,
				neighbors: [doorId]
			});
		}

		const nodeList = Array.from(this.nodes.values());
		for (let i = 0; i < nodeList.length; i++) {
			for (let j = i + 1; j < nodeList.length; j++) {
				const a = nodeList[i];
				const b = nodeList[j];
				if (a.kind === 'desk' || b.kind === 'desk') continue;
				const dist = Math.hypot(a.x - b.x, a.z - b.z);
				if (dist > 15.5) continue;
				if (!this.isSegmentBlocked(a, b)) {
					a.neighbors.push(b.id);
					b.neighbors.push(a.id);
				}
			}
		}
	}

	isSegmentBlocked(a: Vec2, b: Vec2): boolean {
		return this.obstacles.some((obs) => segmentIntersectsRect(a, b, obs, 0.2));
	}

	getObstacles(): RectObstacle[] {
		return [...this.obstacles];
	}

	getNode(id: string): WaypointNode | undefined {
		return this.nodes.get(id);
	}

	findNearestNode(pos: Vec2, allowInterior = false): WaypointNode {
		let best: WaypointNode | undefined;
		let bestDist = Infinity;
		for (const node of this.nodes.values()) {
			if (!allowInterior && (node.kind === 'desk' || node.kind === 'chair')) continue;
			const d = Math.hypot(node.x - pos.x, node.z - pos.z);
			if (d < bestDist) {
				bestDist = d;
				best = node;
			}
		}
		if (!best) throw new Error('Navigation graph has no exterior nodes');
		return best;
	}

	getReachableWanderTargets(fromPos: Vec2): WaypointNode[] {
		const start = this.findNearestNode(fromPos, false);
		const visited = new Set<string>([start.id]);
		const queue = [start.id];
		while (queue.length > 0) {
			const currId = queue.shift()!;
			const curr = this.nodes.get(currId);
			if (!curr) continue;
			for (const nb of curr.neighbors) {
				if (!visited.has(nb)) {
					visited.add(nb);
					queue.push(nb);
				}
			}
		}
		return Array.from(visited)
			.map((id) => this.nodes.get(id)!)
			.filter((n) => n.kind === 'plaza' || n.kind === 'path' || n.kind === 'dock' || n.kind === 'door');
	}

	findPath(from: Vec2, to: Vec2, targetNodeId?: string): Vec2[] {
		const startNode = this.findNearestNode(from, true);
		const goalNode = targetNodeId
			? (this.nodes.get(targetNodeId) ?? this.findNearestNode(to, true))
			: this.findNearestNode(to, true);

		if (startNode.id === goalNode.id) {
			return [
				{ x: goalNode.x, z: goalNode.z },
				{ ...to }
			];
		}

		const openSet = new Set<string>([startNode.id]);
		const cameFrom = new Map<string, string>();
		const gScore = new Map<string, number>([[startNode.id, 0]]);
		const fScore = new Map<string, number>([
			[startNode.id, Math.hypot(goalNode.x - startNode.x, goalNode.z - startNode.z)]
		]);

		while (openSet.size > 0) {
			let currentId = '';
			let lowestF = Infinity;
			for (const id of openSet) {
				const f = fScore.get(id) ?? Infinity;
				if (f < lowestF) {
					lowestF = f;
					currentId = id;
				}
			}

			if (currentId === goalNode.id) {
				const chain: Vec2[] = [];
				let curr: string | undefined = currentId;
				while (curr) {
					const n = this.nodes.get(curr)!;
					chain.unshift({ x: n.x, z: n.z });
					curr = cameFrom.get(curr);
				}
				if (Math.hypot(to.x - goalNode.x, to.z - goalNode.z) > 0.05) {
					chain.push({ x: to.x, z: to.z });
				}
				return chain;
			}

			openSet.delete(currentId);
			const current = this.nodes.get(currentId)!;

			for (const neighborId of current.neighbors) {
				const neighbor = this.nodes.get(neighborId);
				if (!neighbor) continue;
				const tentativeG =
					(gScore.get(currentId) ?? Infinity) +
					Math.hypot(neighbor.x - current.x, neighbor.z - current.z);
				if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
					cameFrom.set(neighborId, currentId);
					gScore.set(neighborId, tentativeG);
					fScore.set(
						neighborId,
						tentativeG + Math.hypot(goalNode.x - neighbor.x, goalNode.z - neighbor.z)
					);
					openSet.add(neighborId);
				}
			}
		}

		return [];
	}
}
