<script>
	import '../global.css';
	import { onMount } from 'svelte';
	import { themeChange } from 'theme-change';

	import SunHorizon from 'phosphor-svelte/lib/SunHorizon';
	import MoonStars from 'phosphor-svelte/lib/MoonStars';
	import { browser } from '$app/environment';

	$: themeDark = false;

	onMount(() => {
		themeDark = document.documentElement.classList.contains('dark');
	});
</script>

<div
	class=" 
  relative
  h-fit min-h-screen"
>
	{#if browser}
		<div
			class="
      absolute
  gap-4 p-4 text-sm
  transition-colors duration-300
  "
		>
			<button
				class=" rounded-sm border px-2 py-1"
				on:click={() => {
					document.documentElement.classList.toggle('dark');
					if (document.documentElement.classList.contains('dark')) {
						localStorage.theme = 'dark';
						themeDark = true;
					} else {
						localStorage.theme = 'light';
						themeDark = false;
					}
				}}
				>{themeDark ? 'Turn the lights on' : 'Turn the lights off'}
			</button>
			<!-- 
			<button
				class=" absolute rounded-sm border px-2 py-1"
				on:click={() => {
					// Whenever the user explicitly chooses to respect the OS preference
					localStorage.removeItem('theme');
					document.documentElement.classList.remove('dark');
					if (
						localStorage.theme === 'dark' ||
						(!('theme' in localStorage) &&
							window.matchMedia('(prefers-color-scheme: dark)').matches)
					) {
						document.documentElement.classList.add('dark');
					} else {
						document.documentElement.classList.remove('dark');
					}
				}}
			>
				System pref
			</button> -->
		</div>
	{/if}

	<slot />
</div>
