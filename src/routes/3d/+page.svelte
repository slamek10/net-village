<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { VillageStore, type NewAgentInput } from '$lib/state/bastion3d.svelte';
	import { createVillageEnvironment } from '$lib/scene/village';
	import { createTownHall } from '$lib/scene/townHall';
	import {
		createFirewallForge,
		createRouterYard,
		createWireguardHub,
		createDnsTower,
		createDynamicHouse,
		type SpecialistBuildingHandle
	} from '$lib/scene/specialistBuildings';
	import { disposeThreeResources } from '$lib/scene/disposer';
	import {
		createAgentCharacter,
		crossfadeAgentClip,
		renderAgentPortrait,
		type LoadedAgentRig
	} from '$lib/agents/characterFactory';
	import { resolveAnimationClip } from '$lib/agents/stateMachine';
	import type { BuildingSlot, BuildingStylePreset } from '$lib/types/village';

	const store = new VillageStore();

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let showAddModal = $state(false);
	let showBindingsDrawer = $state(false);
	let chatInput = $state('');
	let taskInput = $state('');

	let newName = $state('');
	let newRole = $state('BGP / Core Specialist');
	let newSpecialty = $state('BGP Peering, OSPF & Telemetry');
	let newSystemPrompt = $state('Inspect network state read-only by default; follow CLAUDE.md zero-credential rules.');
	let newBuildingName = $state('');
	let newBuildingStyle = $state<BuildingStylePreset>('cottage');
	let newAccentColor = $state('#ec4899');
	let newTagsRaw = $state('bgp, core, hq');

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let controls: OrbitControls | null = null;
	let animFrameId: number | null = null;
	let isPausedByVisibility = false;

	const agentRigs = new Map<string, LoadedAgentRig>();
	const buildingHandles = new Map<string, SpecialistBuildingHandle>();
	let townHallHandle: ReturnType<typeof createTownHall> | null = null;
	let villageEnvHandle: ReturnType<typeof createVillageEnvironment> | null = null;

	function buildBuildingMesh(slot: BuildingSlot) {
		if (!scene || buildingHandles.has(slot.id)) return;
		if (slot.style === 'town-hall') {
			townHallHandle = createTownHall(slot.position);
			scene.add(townHallHandle.group);
			return;
		}
		let handle: SpecialistBuildingHandle;
		switch (slot.style) {
			case 'firewall-forge':
				handle = createFirewallForge(slot);
				break;
			case 'router-yard':
				handle = createRouterYard(slot);
				break;
			case 'wireguard-hub':
				handle = createWireguardHub(slot);
				break;
			case 'dns-tower':
				handle = createDnsTower(slot);
				break;
			default:
				handle = createDynamicHouse(slot);
				break;
		}
		buildingHandles.set(slot.id, handle);
		scene.add(handle.group);
	}

	async function attachAgentMesh(agentIndex: number) {
		if (!scene || !renderer) return;
		const agent = store.agents[agentIndex];
		if (!agent || agentRigs.has(agent.profile.id)) return;
		const rig = await createAgentCharacter(agent.profile);
		rig.root.position.set(agent.position.x, 0, agent.position.z);
		rig.root.rotation.y = agent.yaw;
		scene.add(rig.root);
		agentRigs.set(agent.profile.id, rig);
		agent.portraitUrl = renderAgentPortrait(renderer, rig, agent.profile);
	}

	function applyCameraPreset(presetId: string) {
		store.activeCameraPresetId = presetId;
		const preset = store.cameraPresets.find((p) => p.id === presetId);
		if (preset && camera && controls) {
			camera.position.set(...preset.position);
			controls.target.set(...preset.target);
			controls.update();
		}
	}

	async function handleCreateAgent(e: Event) {
		e.preventDefault();
		if (!newName.trim() || !newRole.trim()) return;

		const input: NewAgentInput = {
			name: newName.trim(),
			role: newRole.trim(),
			specialty: newSpecialty.trim() || newRole.trim(),
			systemPrompt: newSystemPrompt.trim(),
			buildingName: newBuildingName.trim() || `${newName.trim()}'s Workshop`,
			buildingStyle: newBuildingStyle,
			accentColor: newAccentColor,
			deviceTags: newTagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
		};

		const { agent, building } = store.addDynamicAgent(input);
		buildBuildingMesh(building);
		townHallHandle?.rebuildChairs(store.agents.length);
		await attachAgentMesh(store.agents.length - 1);

		fetch('/api/agents', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(agent.profile)
		}).catch(() => {});

		newName = '';
		newBuildingName = '';
		showAddModal = false;
		store.selectedAgentId = agent.profile.id;
		applyCameraPreset(building.id);
	}

	async function sendChatTurn() {
		if (!chatInput.trim()) return;
		const agentId = store.selectedAgentId;
		const text = chatInput.trim();
		chatInput = '';

		store.chats = {
			...store.chats,
			[agentId]: [
				...(store.chats[agentId] ?? []),
				{ id: `msg-${Date.now()}`, agentId, sender: 'user', text, timestamp: new Date().toLocaleTimeString() }
			]
		};

		const ag = store.agents.find((a) => a.profile.id === agentId);
		if (ag && ag.state !== 'MEETING') ag.state = 'SPEAKING';

		try {
			const res = await fetch('/api/turn', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ agentId, message: text, writeMode: store.telemetry.writeModeEnabled })
			});
			const data = await res.json();
			store.chats = {
				...store.chats,
				[agentId]: [
					...(store.chats[agentId] ?? []),
					{
						id: `reply-${Date.now()}`,
						agentId,
						sender: 'agent',
						text: data.reply || 'Acknowledged.',
						timestamp: new Date().toLocaleTimeString(),
						readOnlyMode: data.readOnly
					}
				]
			};
		} catch {
			store.chats = {
				...store.chats,
				[agentId]: [
					...(store.chats[agentId] ?? []),
					{
						id: `demo-${Date.now()}`,
						agentId,
						sender: 'agent',
						text: `[Demo Mode] Read-only check queued for "${text}".`,
						timestamp: new Date().toLocaleTimeString(),
						readOnlyMode: true
					}
				]
			};
		} finally {
			if (ag && ag.state === 'SPEAKING') ag.state = store.meetingActive ? 'MEETING' : 'IDLE';
		}
	}

	async function assignWorkOrder() {
		if (!taskInput.trim()) return;
		const agentId = store.selectedAgentId;
		const instructions = taskInput.trim();
		taskInput = '';

		const localOrder = {
			id: `wo-${Date.now().toString(36)}`,
			agentId,
			title: instructions.slice(0, 44),
			instructions,
			status: 'running' as const,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		store.workOrders = [localOrder, ...store.workOrders];
		fetch('/api/order', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agentId, instructions })
		}).catch(() => {});
	}

	function handleVisibilityChange() {
		isPausedByVisibility = typeof document !== 'undefined' && document.hidden;
	}

	onMount(async () => {
		if (!canvasEl) return;

		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		scene = new THREE.Scene();
		scene.background = new THREE.Color('#22201d');
		scene.fog = new THREE.FogExp2('#22201d', 0.012);

		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.2, 160);
		camera.position.set(0, 26, 28);

		controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.target.set(0, 0, -2);
		controls.maxPolarAngle = Math.PI / 2 - 0.08;

		villageEnvHandle = createVillageEnvironment();
		scene.add(villageEnvHandle.group);

		for (const b of store.buildings) buildBuildingMesh(b);
		townHallHandle?.rebuildChairs(store.agents.length);
		for (let i = 0; i < store.agents.length; i++) await attachAgentMesh(i);

		const handleResize = () => {
			if (!renderer || !camera) return;
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener('resize', handleResize);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		let lastTime = performance.now();
		const tick = (now: number) => {
			animFrameId = requestAnimationFrame(tick);
			if (isPausedByVisibility || !renderer || !scene || !camera || !controls) return;

			const dt = Math.min((now - lastTime) / 1000, 0.05);
			lastTime = now;

			store.stepSimulation(dt);
			villageEnvHandle?.setLightingMode(store.lightingMode);
			villageEnvHandle?.update(dt);
			townHallHandle?.update(dt, camera.position, store.telemetry.activeTurnAgentIds.length, store.activeCameraPresetId === 'town-hall');
			buildingHandles.get('firewall-forge')?.update(dt, { alertLevel: store.telemetry.firewallAlertLevel });
			buildingHandles.get('router-yard')?.update(dt, { activeSessions: store.telemetry.activeSshSessions, writeMode: store.telemetry.writeModeEnabled });
			buildingHandles.get('wireguard-hub')?.update(dt, { vpnConnected: store.telemetry.vpnConnected });
			buildingHandles.get('dns-tower')?.update(dt, { dnsChecking: store.telemetry.dnsZoneChecking });

			for (const agent of store.agents) {
				const rig = agentRigs.get(agent.profile.id);
				if (!rig) continue;
				const clipName = resolveAnimationClip(agent.state, agent.path.length > 0, agent.isWaving);
				crossfadeAgentClip(rig, clipName);
				rig.mixer.update(dt);
				rig.root.position.set(agent.position.x, clipName === 'sit' ? -0.22 : 0, agent.position.z);
				rig.root.rotation.y = agent.yaw;
			}

			controls.update();
			renderer.render(scene, camera);
		};
		animFrameId = requestAnimationFrame(tick);

		return () => {
			window.removeEventListener('resize', handleResize);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	onDestroy(() => {
		if (animFrameId !== null) cancelAnimationFrame(animFrameId);
		controls?.dispose();
		if (scene && renderer) {
			disposeThreeResources({
				scene,
				renderer,
				mixers: Array.from(agentRigs.values()).map((r) => r.mixer),
				onExtraDispose: () => {
					for (const rig of agentRigs.values()) rig.dispose();
					agentRigs.clear();
					buildingHandles.clear();
				}
			});
		}
	});
</script>

<div class="relative w-screen h-screen overflow-hidden select-none font-sans">
	<canvas bind:this={canvasEl} class="block w-full h-full"></canvas>

	<header class="fixed top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-[#1c1917]/80 backdrop-blur-md border border-white/10 shadow-lg">
		<div class="flex items-center gap-3">
			<span class="font-semibold text-base text-[#fef3c7]">net-village</span>
			<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
				{store.telemetry.demoMode ? 'Demo Mode' : 'Live Mode'}
			</span>
			<span class="text-xs text-[#d6cfc2]">
				VPN ({store.telemetry.vpnTunnelName}): {store.telemetry.vpnConnected ? 'UP' : 'DOWN'}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<button type="button" onclick={() => (store.lightingMode = store.lightingMode === 'daylight' ? 'twilight' : 'daylight')} class="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-[#fef3c7]">
				{store.lightingMode === 'daylight' ? 'Twilight' : 'Daylight'}
			</button>
			<button type="button" onclick={() => (showBindingsDrawer = !showBindingsDrawer)} class="px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-[#fef3c7]">
				Settings · Bindings
			</button>
			{#if store.meetingActive}
				<button type="button" onclick={() => store.endMeeting()} class="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white">
					End Meeting
				</button>
			{:else}
				<button type="button" onclick={() => store.callMeeting()} class="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white">
					Call Meeting
				</button>
			{/if}
			<button type="button" onclick={() => (showAddModal = true)} class="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white">
				+ Add Agent
			</button>
		</div>
	</header>

	<aside class="fixed top-20 left-3 bottom-20 w-72 overflow-y-auto p-3 rounded-2xl bg-[#1c1917]/80 backdrop-blur-md border border-white/10 space-y-2.5">
		<div class="flex items-center justify-between px-1">
			<h2 class="text-xs font-semibold uppercase tracking-wider text-[#d6cfc2]">Agents ({store.agents.length})</h2>
			<button type="button" onclick={() => store.triggerAgentAlert('firewall-specialist')} class="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30">
				Test Alert
			</button>
		</div>
		{#each store.agents as agent (agent.profile.id)}
			<div
				role="button"
				tabindex="0"
				onclick={() => (store.selectedAgentId = agent.profile.id)}
				onkeydown={(e) => e.key === 'Enter' && (store.selectedAgentId = agent.profile.id)}
				class="p-2.5 rounded-xl border transition cursor-pointer {store.selectedAgentId === agent.profile.id ? 'bg-white/15 border-amber-400/60' : 'bg-white/5 border-white/10 hover:bg-white/10'}"
			>
				<div class="flex items-center gap-2.5">
					{#if agent.portraitUrl}
						<img src={agent.portraitUrl} alt={agent.profile.name} class="w-10 h-10 rounded-lg object-cover border border-white/20" />
					{:else}
						<div class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white" style="background-color: {agent.profile.accentColor}">
							{agent.profile.name.slice(0, 2).toUpperCase()}
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-1">
							<p class="text-xs font-semibold text-white truncate">{agent.profile.name}</p>
							<span class="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-amber-200">{agent.state}</span>
						</div>
						<p class="text-[11px] text-[#c7beb0] truncate">{agent.profile.role}</p>
						<p class="text-[10px] text-[#9e9486] truncate">{agent.profile.buildingName}</p>
					</div>
				</div>
			</div>
		{/each}
	</aside>

	<aside class="fixed top-20 right-3 bottom-20 w-88 overflow-y-auto p-3.5 rounded-2xl bg-[#1c1917]/85 backdrop-blur-md border border-white/10 flex flex-col gap-3">
		{#if store.meetingActive}
			<div class="p-2.5 rounded-xl bg-sky-950/60 border border-sky-400/30 space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-semibold text-sky-200">Town Hall Meeting Table</h3>
					<button type="button" onclick={() => store.endMeeting()} class="text-[11px] px-2 py-0.5 rounded bg-sky-600 text-white">End Meeting</button>
				</div>
				<div class="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
					{#each store.agents as seated (seated.profile.id)}
						<div class="flex items-center justify-between px-2 py-1 rounded bg-black/35 text-xs">
							<span class="truncate text-white">{seated.profile.name}</span>
							<div class="flex items-center gap-1">
								<span class="text-[10px] text-sky-300">{seated.state}</span>
								<button type="button" onclick={() => (store.selectedAgentId = seated.profile.id)} class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20">Select</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if store.selectedAgentId}
			{@const selected = store.agents.find((a) => a.profile.id === store.selectedAgentId) ?? store.agents[0]}
			{#if selected}
				<div class="space-y-2">
					<div class="border-b border-white/10 pb-2">
						<h3 class="text-sm font-semibold text-[#fef3c7]">{selected.profile.name}</h3>
						<p class="text-xs text-[#d6cfc2]">{selected.profile.role}</p>
						<p class="text-[11px] text-[#9e9486]">{selected.profile.specialty}</p>
					</div>
					<div class="space-y-1.5">
						<label class="block text-[11px] font-medium text-[#e7e0d5]">
							Assign Task (Work Order)
							<input type="text" bind:value={taskInput} placeholder="e.g. Inspect Ovis DFR peers & check named zone..." class="mt-1 w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white" />
						</label>
						<button type="button" onclick={assignWorkOrder} class="w-full py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white">
							File Work Order
						</button>
					</div>
					{#if store.workOrders.length > 0}
						<div class="space-y-1 max-h-28 overflow-y-auto">
							<p class="text-[10px] uppercase tracking-wider text-[#b5aa99]">Active Work Orders</p>
							{#each store.workOrders as wo (wo.id)}
								<div class="p-2 rounded-lg bg-white/5 border border-white/10 text-xs flex justify-between">
									<span class="font-medium text-white truncate">{wo.title}</span>
									<span class="text-[10px] text-amber-300">{wo.status}</span>
								</div>
							{/each}
						</div>
					{/if}
					<div class="space-y-1.5 pt-1">
						<p class="text-[10px] uppercase tracking-wider text-[#b5aa99]">Specialist Chat</p>
						<div class="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-lg bg-black/30 border border-white/10">
							{#each store.chats[selected.profile.id] ?? [] as msg (msg.id)}
								<div class="text-xs {msg.sender === 'user' ? 'text-sky-200' : 'text-[#f5efe6]'}">
									<span class="font-semibold">{msg.sender === 'user' ? 'You' : selected.profile.name}:</span> {msg.text}
								</div>
							{:else}
								<p class="text-[11px] text-[#8c8275]">Read-only by default. Ask a diagnostic question.</p>
							{/each}
						</div>
						<div class="flex gap-1.5">
							<input type="text" bind:value={chatInput} onkeydown={(e) => e.key === 'Enter' && sendChatTurn()} placeholder="Ask specialist..." class="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-white" />
							<button type="button" onclick={sendChatTurn} class="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white">Send</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</aside>

	<nav class="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1c1917]/85 backdrop-blur-md border border-white/10 max-w-[95vw] overflow-x-auto">
		{#each store.cameraPresets as preset (preset.id)}
			<button type="button" onclick={() => applyCameraPreset(preset.id)} class="px-3 py-1 rounded-lg text-xs whitespace-nowrap transition {store.activeCameraPresetId === preset.id ? 'bg-amber-600 text-white font-medium' : 'bg-white/10 hover:bg-white/20 text-[#e7e0d5]'}">
				{preset.label}
			</button>
		{/each}
	</nav>

	{#if showAddModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
			<form onsubmit={handleCreateAgent} class="w-full max-w-md p-5 rounded-2xl bg-[#24201c] border border-white/15 space-y-3 text-xs">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-white">Add Custom Network Agent & House</h2>
					<button type="button" onclick={() => (showAddModal = false)} class="text-[#b5aa99] hover:text-white">Close</button>
				</div>
				<label class="block text-[#d6cfc2]">
					Agent Name
					<input type="text" required bind:value={newName} placeholder="e.g. Nadia OSPF" class="mt-1 w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white" />
				</label>
				<label class="block text-[#d6cfc2]">
					Role / Specialty
					<input type="text" required bind:value={newRole} class="mt-1 w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white" />
				</label>
				<div class="grid grid-cols-2 gap-2">
					<label class="block text-[#d6cfc2]">
						Building Name
						<input type="text" bind:value={newBuildingName} placeholder="e.g. OSPF Cottage" class="mt-1 w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white" />
					</label>
					<label class="block text-[#d6cfc2]">
						Building Style
						<select bind:value={newBuildingStyle} class="mt-1 w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white">
							<option value="cottage">Cottage</option>
							<option value="workshop">Workshop</option>
							<option value="cabin">Cabin</option>
							<option value="observatory">Observatory</option>
						</select>
					</label>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<label class="block text-[#d6cfc2]">
						Accent Color
						<input type="color" bind:value={newAccentColor} class="mt-1 w-full h-8 rounded bg-transparent border border-white/15" />
					</label>
					<label class="block text-[#d6cfc2]">
						Device CSV Tags
						<input type="text" bind:value={newTagsRaw} class="mt-1 w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white" />
					</label>
				</div>
				<label class="block text-[#d6cfc2]">
					System Prompt / Operational Rules
					<textarea rows="2" bind:value={newSystemPrompt} class="mt-1 w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/15 text-white"></textarea>
				</label>
				<div class="flex justify-end gap-2 pt-2">
					<button type="button" onclick={() => (showAddModal = false)} class="px-3.5 py-1.5 rounded-lg bg-white/10 text-white">Cancel</button>
					<button type="submit" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Spawn in Village</button>
				</div>
			</form>
		</div>
	{/if}

	{#if showBindingsDrawer}
		<div class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
			<div class="w-96 h-full bg-[#24201c] border-l border-white/15 p-5 overflow-y-auto space-y-4 text-xs">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-white">Settings · Building Bindings</h2>
					<button type="button" onclick={() => (showBindingsDrawer = false)} class="text-[#b5aa99] hover:text-white">Close</button>
				</div>
				<p class="text-[#c7beb0]">Persisted in <code class="text-amber-300">data/bindings.json</code>. Passwords from CSV are never displayed.</p>
				{#each store.buildings as bldg (bldg.id)}
					<div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
						<p class="font-semibold text-white">{bldg.name}</p>
						<p class="text-[11px] text-[#b5aa99]">ID: {bldg.id} · Agent: {bldg.agentId}</p>
						<p class="text-[11px] text-emerald-300">Tags: {(store.bindings.buildings[bldg.id]?.deviceTags ?? ['default']).join(', ')}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
