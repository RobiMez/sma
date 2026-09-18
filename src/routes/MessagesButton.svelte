<script lang="ts">
  import { onMount } from 'svelte';

  import type { IKeyPairs } from '$lib/types';
  import { buttonVariants } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import { generateConsistentIndices } from '$lib/utils/colors';
  import { loadRoomSummaries, type RoomSummary } from '$lib/utils/roomSummaries';
  import Mailbox from 'phosphor-svelte/lib/Mailbox';

  interface Props {
    loadedPair: IKeyPairs;
  }

  let { loadedPair }: Props = $props();

  const rid = $derived(loadedPair.uniqueString);
  const color = $derived(generateConsistentIndices(rid));

  let summary: RoomSummary | undefined = $state(undefined);

  // The same batch read /i draws its list from, asked about one room. Nothing
  // waits on it and it is allowed to come back empty: this says which inbox
  // the button opens, it is not what makes the button work. Until it lands the
  // row shows the rid alone, which is everything the old chip ever showed.
  onMount(async () => {
    const found = await loadRoomSummaries([rid]);
    summary = found[rid];
  });
</script>

<!-- The identity used to hang off the button as a tab chip: a 12-char hash in
     a box whose width had no relation to the button's. It answers the same
     question /i answers with a row, so it gets the same row. Title and message
     count are what tell you whether this is the inbox you meant, and one batch
     endpoint already fetches them for /i.

     One anchor around both halves, not a button with a caption beneath it: a
     cell sitting flush under a button is going to be clicked, and both halves
     lead to the same inbox, so the honest shape is one link with one focus
     ring and one hover state. That is what group-hover on the face is for. On
     its own it would light up only over its own half.

     The column stretches both halves to whichever is wider, which is what
     makes them equal without either being told a number. max-w-64 bounds it so
     an unusually long room title truncates instead of dragging the pair wide;
     the button's text is nowrap, so it sets the floor. -->
<a
  href="/li/{rid}"
  class="group focus-visible:ring-ring/50 flex max-w-64 flex-col outline-none focus-visible:ring-[3px]"
>
  <!-- text-base, matching the Identities button beside it. Both used to say
       text-md, which is not a utility this project defines. It reached 16px
       by accident: tailwind-merge reads `md` as a size and drops the base
       class's text-sm for it, leaving the button with no font-size at all
       and inheriting the root's. Same pixels, said on purpose. -->
  <span class={cn(buttonVariants({ size: 'lg' }), 'text-base group-hover:bg-primary/90')}>
    <Mailbox class="size-5" weight="duotone" />
    Your Messages
  </span>

  <!-- Same construction as IdentityPill: the swatch is a full-height edge
       rather than a square sitting inside the cell, because the colour is the
       part of an identity that is recognisable at a glance. -->
  <span
    class="border-border bg-muted group-hover:bg-secondary flex flex-row items-stretch border transition-colors"
  >
    <span class="w-10 shrink-0" style="background: {color};" aria-hidden="true"></span>
    <span class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left">
      <span class="truncate text-sm">{rid}</span>
      {#if summary?.title}
        <!-- The rid stays the headline, as on /i: it is what the share link
             carries. A title is the room's own name for itself, which not
             every room has. -->
        <span class="text-muted-foreground truncate text-xs">{summary.title}</span>
      {/if}
      {#if summary}
        <span class="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          {#if summary.theme}
            <span>{summary.theme.name}</span>
          {/if}
          <span>
            {summary.theme ? '· ' : ''}{summary.messages}
            {summary.messages === 1 ? 'message' : 'messages'}
          </span>
        </span>
      {/if}
    </span>
  </span>
</a>
