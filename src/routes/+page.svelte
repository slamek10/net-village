<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/3d', { replaceState: true });
	});
</script>

<main class="min-h-screen flex items-center justify-center bg-[#1a1815] text-[#f5efe6] font-sans">
	<div class="text-center space-y-3">
		<h1 class="text-2xl font-semibold tracking-tight">net-village</h1>
		<p class="text-sm text-[#cfc4b4]">Entering the Network Engineering Agent Village…</p>
		<a href="/3d" class="inline-block px-4 py-2 rounded-lg bg-[#d97706] text-white text-sm font-medium">
			Open 3D Village
		</a>
	</div>
</main>
