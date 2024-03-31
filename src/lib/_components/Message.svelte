<script lang="ts">

	export let msg: any;
	export let color: any;

	$: msg.hidden = false;
</script>

<div class=" relative w-full border border-black p-2 font-light">
	{#if !msg.hidden}
		<span class="overflow-hidden">
			{msg.msg}
		</span>
	{/if}

	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<span
		class="absolute -left-2 -top-4 aspect-square border border-black p-1 px-2 text-xs"
		style="background: {color};"
		on:click={() => (msg.hidden = !msg.hidden)}
	>
		&nbsp;
	</span>
	<span class="absolute -top-4 left-1 border border-black bg-stone-100 p-1 px-2 text-xs">
		{msg.r}
	</span>
</div>
