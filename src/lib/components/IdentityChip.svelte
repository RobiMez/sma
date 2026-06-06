<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';

  interface Props {
    rid: string;
    bg?: 'muted' | 'background';
    variant?: 'inline' | 'tab';
    classString?: string;
  }

  let { rid, bg = 'muted', variant = 'inline', classString = '' }: Props = $props();
  const color = $derived(generateConsistentIndices(rid));
  const bgClass = $derived(bg === 'background' ? 'bg-background' : 'bg-muted');
</script>

{#if variant === 'tab'}
  <span class="relative inline-block {classString}">
    <span
      class="border-primary absolute -top-4 -left-2 aspect-square border p-1 px-2 text-sm"
      style="background: {color};"
    >
      &nbsp;
    </span>
    <span
      class="border-primary {bgClass} absolute -top-4 left-1 border border-black p-1 px-2 text-sm whitespace-nowrap"
    >
      {rid}
    </span>
  </span>
{:else}
  <span class="inline-flex flex-row items-stretch text-sm whitespace-nowrap {classString}">
    <span class="border-primary aspect-square border px-2" style="background: {color};">
      &nbsp;
    </span>
    <span class="border-primary {bgClass} border border-l-0 border-black px-2 py-1">
      {rid}
    </span>
  </span>
{/if}
