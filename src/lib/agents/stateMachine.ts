import type { AgentBehaviorState } from '$lib/types/village';
import type { Vec2 } from './navigation';

export type AnimationClipName = 'idle' | 'walk' | 'run' | 'sit' | 'talk' | 'wave';

export function resolveAnimationClip(
	state: AgentBehaviorState,
	isMoving: boolean,
	isWaving = false
): AnimationClipName {
	if (isWaving && state === 'IDLE' && !isMoving) return 'wave';
	switch (state) {
		case 'ALERT':
			return isMoving ? 'run' : 'talk';
		case 'SPEAKING':
			return 'talk';
		case 'MEETING':
			return isMoving ? 'walk' : 'sit';
		case 'WORKING':
			return isMoving ? 'walk' : 'talk';
		case 'COLLAB':
			return isMoving ? 'walk' : 'talk';
		case 'IDLE':
		default:
			return isMoving ? 'walk' : 'idle';
	}
}

export function mapAvailableClip(requested: AnimationClipName, availableClips: string[]): string {
	const lower = availableClips.map((c) => c.toLowerCase());
	const exactIdx = lower.indexOf(requested);
	if (exactIdx >= 0) return availableClips[exactIdx];

	const fallbacks: Record<AnimationClipName, string[]> = {
		idle: ['idle', 'stand', 'breathe'],
		walk: ['walk', 'run', 'move'],
		run: ['run', 'sprint', 'walk'],
		sit: ['sit', 'idle'],
		talk: ['talk', 'speak', 'wave', 'idle'],
		wave: ['wave', 'talk', 'idle']
	};

	for (const candidate of fallbacks[requested]) {
		const idx = lower.findIndex((name) => name.includes(candidate));
		if (idx >= 0) return availableClips[idx];
	}
	return availableClips[0] ?? 'idle';
}

export interface MeetingSeatAssignment {
	agentId: string;
	seatIndex: number;
	position: Vec2;
	facingYaw: number;
}

export function computeMeetingSeats(
	agentIds: string[],
	tableCenter: Vec2 = { x: 0, z: -14.5 },
	baseRadius = 2.35
): MeetingSeatAssignment[] {
	const count = Math.max(agentIds.length, 1);
	const radius = baseRadius + Math.max(0, count - 5) * 0.22;
	return agentIds.map((agentId, seatIndex) => {
		const angle = (seatIndex / count) * Math.PI * 2 - Math.PI / 2;
		const x = tableCenter.x + Math.cos(angle) * radius;
		const z = tableCenter.z + Math.sin(angle) * radius;
		const facingYaw = Math.atan2(tableCenter.x - x, tableCenter.z - z);
		return { agentId, seatIndex, position: { x, z }, facingYaw };
	});
}
