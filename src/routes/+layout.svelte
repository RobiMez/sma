<script>
	import '../global.css';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';

	import SunHorizon from 'phosphor-svelte/lib/SunHorizon';
	import MoonStars from 'phosphor-svelte/lib/MoonStars';

	onMount(() => {
		themeChange(false);
	});
</script>

<!-- Put theme switcher here  -->
<label class="swap absolute right-4 top-2">
	<!-- this hidden checkbox controls the state -->
	<input data-toggle-theme="dark,light" type="checkbox" />

	<div
		class="
		swap-on bg-base-200
		flex flex-row items-center justify-center gap-2 rounded-sm px-2 py-1"
	>
		<small class="hidden text-xs md:block"> Turn the lights on </small>
		<SunHorizon size="24" weight="duotone" />
	</div>
	<div
		class="
		swap-off bg-base-200
		flex flex-row items-center justify-center gap-2 rounded-sm px-2 py-1"
	>
		<small class="hidden text-xs md:block"> Turn the lights off </small>
		<MoonStars size="24" weight="duotone" />
	</div>
</label>

<slot />
