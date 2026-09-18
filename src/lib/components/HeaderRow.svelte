<script lang="ts">
  import type { Snippet } from 'svelte';

  // One header style for the whole app, as a component rather than a set of
  // classes to copy: the four page headers had drifted into four different
  // paddings and three type scales, and a shared class would have drifted
  // again the first time someone needed a trailing control.
  //
  // Chrome only. It owns the rule, the padding and the type scale; callers
  // own what goes in the row. `last` drops the bottom rule for a row that
  // sits at the end of a stack, where the container's own edge already
  // separates it and a second line reads as a double border.

  interface Props {
    children: Snippet;
    /** Right-aligned content: counts, controls, status. */
    trailing?: Snippet;
    /** Size of the row. `page` is a route's title, `section` a block within one. */
    variant?: 'page' | 'section';
    last?: boolean;
    classString?: string;
  }

  let {
    children,
    trailing,
    variant = 'section',
    last = false,
    classString = ''
  }: Props = $props();

  // font-display, not font-sans: a display face can differ from the body face
  // for headings only and leave body text readable. On a room wearing nothing,
  // both tokens are Lexend and this changes nothing.
  const title = $derived(
    variant === 'page'
      ? 'font-display text-md font-semibold md:text-lg'
      : 'font-display text-sm font-semibold'
  );
</script>

<!-- flex-wrap, and flex-auto rather than flex-1, is load-bearing on mobile.
     flex-1 means basis:0, so the title contributes no width to the layout and
     a wide trailing group shrinks it to nothing instead of pushing it onto a
     second line: the identities page lost its heading entirely, and the send
     page broke "Send to" mid-phrase. basis:auto lets the title's real width
     force the wrap it needs. -->
<div
  class="border-border flex w-full flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-2 {last
    ? ''
    : 'border-b'} {classString}"
>
  <div class="flex flex-auto flex-row flex-wrap items-center gap-2 {title}">
    {@render children()}
  </div>
  {#if trailing}
    <div
      class="text-muted-foreground flex shrink-0 flex-row flex-wrap items-center gap-2 text-xs"
    >
      {@render trailing()}
    </div>
  {/if}
</div>
