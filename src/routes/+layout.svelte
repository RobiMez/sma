<script>
  import '../global.css';
  import { onMount } from 'svelte';
  import { themeChange } from 'theme-change';

  import AppWindow from 'phosphor-svelte/lib/AppWindow';
  import House from 'phosphor-svelte/lib/House';
  import ArrowSquareUpLeft from 'phosphor-svelte/lib/ArrowSquareUpLeft';
  import { page } from '$app/state';
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

<!-- Two surfaces. The page ground (here) is the darker one and carries the
     nav and the gutters; the content column below is the lighter one. The step
     between them is about 3% lightness in either theme, held apart by the
     column's border-x rather than by contrast alone. Putting the column's
     surface in the layout rather than in each route means a new route gets it
     by existing, and the four routes cannot drift apart. -->
<!-- The room's bought look rides here, on the shell, because this is the only
     element with both surfaces beneath it: the ground is this div's own
     bg-muted, the content column is <main>'s bg-background. A theme redefines
     the tokens both of those read, so it reaches every descendant without any
     of them knowing; a watermark tiles this div's background-image, which
     <main> then paints over. Empty on every page that is not a room.

     text-foreground here is not decoration, it is what lets a theme change
     the text colour at all. `color` inherits, and @layer base puts
     text-foreground on <body>, which resolves --foreground ABOVE this div,
     where no theme class applies. Everything inside then inherits that
     already-computed stock colour, so a theme could recolour anything
     carrying an explicit text-* class and nothing without one: a loud theme's
     body copy took its new colour while every heading stayed the old one. Re-declaring it
     here resolves the variable at the level the theme owns. font-sans is on
     this div for exactly the same reason: font-family inherits too, and
     Tailwind's preflight sets it on <html> from the root token. -->
<div class="bg-muted text-foreground font-sans relative flex min-h-screen flex-col">
  <!-- Brutalist bar: the container carries no padding and no gap at all, so
       the cells butt directly against each other and against the viewport
       edges. The padding that used to be on the bar now lives inside each
       cell, which is what lets a 1px rule between them read as a shared
       divider rather than as a gap. items-stretch (not items-start) is what
       makes every cell full-bleed top to bottom; without it they shrink to
       their text and the dividers become floating ticks.

       bg-muted against the body's bg-background, rules in border-border to
       match the room header and the message cards. Both are theme tokens, so
       there is no dark: variant to keep in step. -->
  <!-- One bar across the top rather than a right-hand cluster: Home and New
       Room used to live inside the inbox header, where they were room
       furniture. They are site navigation, so they belong here, on every
       page, opposite the account and theme controls.

       In normal flow, not absolute: floating it meant every page rendered
       underneath it and each one had to remember to leave a gap, which
       /b/[room] did not. Reserving the space here makes collisions
       impossible rather than a thing each route gets right separately.
       min-h is on the bar itself and OUTSIDE the browser gate, so the server
       reserves exactly what the client fills; gating the box as well as its
       contents would hand back the load shift we just removed. Keep min-h-11
       equal to the tallest control (28px) plus py-2 top and bottom: if it
       drifts above that the bar pads itself for nothing, and below it the
       reservation stops matching and the shift comes back. -->
  <div
    class="border-border bg-muted z-50 flex min-h-11 w-full flex-row items-stretch justify-between border-b text-sm transition-colors duration-300"
  >
    {#if browser}
      <nav class="flex flex-row items-stretch">
        <!-- Real links, not goto() buttons: they were buttons only because
             they sat inside a header that had no room for anything else.
             Anchors get middle-click, open-in-new-tab and focus order free. -->
        <a
          href="/"
          title="Home"
          aria-label="Home"
          aria-current={page.url.pathname === '/' ? 'page' : undefined}
          class="border-border hover:bg-secondary flex cursor-pointer items-center justify-center gap-2 border-r px-4 transition-colors"
        >
          <House size={18} weight="duotone" />
        </a>
        <a
          href="/i"
          title="Create or switch identities"
          aria-current={page.url.pathname === '/i' ? 'page' : undefined}
          class="bg-primary hover:bg-primary/80 text-primary-foreground border-border flex cursor-pointer items-center justify-center gap-2 border-r px-4 transition-colors"
        >
          <ArrowSquareUpLeft size={18} weight="duotone" />
          <span class="hidden sm:flex">New Room</span>
        </a>
      </nav>

      <div class="flex flex-row items-stretch">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="border-border flex cursor-pointer flex-row items-center justify-center gap-2 border-l px-4 transition-colors"
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
            <SunHorizon size={18} weight="duotone" />
          {:else}
            <MoonStars size={18} weight="duotone" />
          {/if}
          <span class="hidden lg:flex">
            {systemPeek ? 'System ' : themeDark ? 'Lights on' : 'Lights off '}
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
  </div>
  <!-- The gutter. Padding scales with the viewport so the column never runs
       edge to edge on a phone and never floats in the middle of a 4K display
       with nothing framing it. Below the max-width the padding IS the gutter;
       above it, the leftover half-width adds to it. -->
  <div class="flex flex-1 flex-col px-2 sm:px-6 md:px-10 lg:px-16">
    <!-- border-x, not a full box: the column runs into the nav above it and
         off the bottom of the page, which is what makes it read as a column
         rather than as a very large card. -->
    <main
      class="border-border bg-background mx-auto flex w-full max-w-4xl flex-1 flex-col border-x"
    >
      {@render children?.()}
    </main>
  </div>
</div>
