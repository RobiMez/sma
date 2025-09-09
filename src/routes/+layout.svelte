<script>
  import '../global.css';
  import { onMount } from 'svelte';
  import { themeChange } from 'theme-change';

  import AppWindow from 'phosphor-svelte/lib/AppWindow';
  import SunHorizon from 'phosphor-svelte/lib/SunHorizon';
  import MoonStars from 'phosphor-svelte/lib/MoonStars';
  import { browser } from '$app/environment';
  import { clearLS } from '$lib/utils/localStorage';
  /** @type {{children?: import('svelte').Snippet}} */
  let { children } = $props();

  let themeDark = $state(false);

  let systemPeek = $state(false);

  onMount(() => {
    themeDark = document.documentElement.classList.contains('dark');
    clearLS();
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
      absolute right-2
  gap-4 p-4 text-sm
  transition-colors duration-300
  "
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class=" flex flex-row items-center justify-center gap-2 rounded-xs border
        border-light-400 px-2
        py-1
        transition-all dark:border-dark-600"
        onclick={() => {
          if (systemPeek) return;
          document.documentElement.classList.toggle('dark');
          if (document.documentElement.classList.contains('dark')) {
            localStorage.theme = 'dark';
            themeDark = true;
          } else {
            localStorage.theme = 'light';
            themeDark = false;
          }
        }}
      >
        {#if themeDark}
          <MoonStars size={18} weight="duotone" />
        {:else}
          <SunHorizon size={18} weight="duotone" />
        {/if}
        <span class="hidden lg:flex">
          {systemPeek ? 'System ' : themeDark ? 'Lights off ' : 'Lights on'}
        </span>

        <button
          onmouseover={() => {
            systemPeek = true;
          }}
          onfocus={() => {
            systemPeek = true;
          }}
          onmouseout={() => {
            systemPeek = false;
          }}
          onblur={() => {
            systemPeek = false;
          }}
          onclick={() => {
            // Whenever the user explicitly chooses to respect the OS preference
            localStorage.removeItem('theme');
            document.documentElement.classList.remove('dark');
            if (
              localStorage.theme === 'dark' ||
              (!('theme' in localStorage) &&
                window.matchMedia('(prefers-color-scheme: dark)').matches)
            ) {
              document.documentElement.classList.add('dark');
              themeDark = true;
            } else {
              document.documentElement.classList.remove('dark');
              themeDark = false;
            }
          }}
        >
          <AppWindow size={18} weight="duotone" />
        </button>
      </div>
    </div>
  {/if}
  {@render children?.()}
</div>
