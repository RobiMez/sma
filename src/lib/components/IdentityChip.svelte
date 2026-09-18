<script lang="ts">
  import type { Snippet } from 'svelte';
  import { generateConsistentIndices } from '$lib/utils/colors';

  interface Props {
    rid: string;
    bg?: 'muted' | 'background';
    variant?: 'inline' | 'tab';
    classString?: string;
    /**
     * Replaces the rid text, for callers that have a better label to show (a
     * verified sender name). Everything else stays identical: the swatch, the
     * borders, and the offsets that make the tab variant's label overlap its
     * swatch. That overlap is why a hand-rolled copy of this chip comes out
     * the wrong size, so it is worth routing through here instead.
     */
    label?: Snippet;
  }

  let { rid, bg = 'muted', variant = 'inline', classString = '', label }: Props = $props();
  const color = $derived(generateConsistentIndices(rid));
  const bgClass = $derived(bg === 'background' ? 'bg-background' : 'bg-muted');
</script>

{#if variant === 'tab'}
  <span class="relative inline-block {classString}">
    <span
      class="border-border absolute -top-4 -left-2 aspect-square border p-1 px-2 text-sm"
      style="background: {color};"
    >
      &nbsp;
    </span>
    <span
      class="border-border {bgClass} absolute -top-4 left-1 border border-border p-1 px-2 text-sm whitespace-nowrap"
    >
      {#if label}{@render label()}{:else}{rid}{/if}
    </span>
  </span>
{:else}
  <span class="inline-flex flex-row items-stretch text-sm whitespace-nowrap {classString}">
    <span class="border-border aspect-square border px-2" style="background: {color};">
      &nbsp;
    </span>
    <span class="border-border {bgClass} border border-l-0 border-border px-2 py-1">
      {#if label}{@render label()}{:else}{rid}{/if}
    </span>
  </span>
{/if}
