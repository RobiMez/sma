<script lang="ts">
	export let msg: any;
	export let color: any;
	import prettyMilliseconds from 'pretty-ms';
	import { onMount } from 'svelte';

	let hidden = false;
	console.log('msg', msg);
	let time = '';

	// Function to refresh the time
	const refresh = () => {
		const now = new Date();
		const diff = now.getTime() - new Date(msg.timestamp).getTime();
		time = prettyMilliseconds(diff, { compact: true });
	};
	const refreshInterval = setInterval(refresh, 10000);

	onMount(() => {
		const timestamp = new Date(msg.timestamp);
		const now = new Date();
		const diff = now.getTime() - timestamp.getTime();
		time = prettyMilliseconds(diff, { compact: true });
		return () => clearInterval(refreshInterval);
	});
</script>

<div class=" bg-base-100 relative w-full border border-black p-2 font-light">
	{#if !hidden}
		<span class="w-full overflow-hidden">
			{msg.msg}
		</span>
	{/if}

	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<span
		class="absolute -left-2 -top-4 aspect-square border border-black p-1 px-2 text-xs"
		style="background: {color};"
		on:click={() => (hidden = !hidden)}
	>
		&nbsp;
	</span>
	<span class="bg-base-100 absolute -top-4 left-1 border border-black p-1 px-2 text-xs">
		{msg.r}
	</span><span class="absolute -top-4 right-1 text-xs">{time}</span>
</div>
