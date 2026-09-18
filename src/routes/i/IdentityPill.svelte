<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';
  import type { IKeyPairs } from '$lib/types';
  import type { RoomSummary } from '$lib/config/rooms';

  interface Props {
    identity: IKeyPairs;
    loadedPair?: IKeyPairs | undefined;
    onClick?: (identity: IKeyPairs) => void;
    classString?: string;
    /**
     * What this room looks like server-side: its title, the theme it wears and
     * how many messages it holds. Absent while the batch read is in flight, and
     * for an identity whose Listener was never registered, so every use of it
     * has to tolerate undefined.
     */
    summary?: RoomSummary;
  }

  let { identity, loadedPair, onClick = () => {}, classString = '', summary }: Props = $props();

  const loaded = $derived(loadedPair?.uniqueString === identity.uniqueString);
  const color = $derived(generateConsistentIndices(identity.uniqueString));
</script>

<!-- A grid cell, not a pill. It used to be a bordered box inside a bordered
     box inside a gap-4 grid, which is three ways of saying the same thing and
     none of them the way the rest of the site separates anything.

     The swatch runs the full height of the cell rather than sitting inside it
     with its own rounding: the colour is the identity's only distinguishing
     mark at a glance, and it reads faster as an edge than as a chip.

     This component is now only the cell. The header's inline chip uses
     IdentityChip, which exists for exactly that and was already used for the
     same rid elsewhere. -->
<button
  type="button"
  onclick={() => onClick(identity)}
  class="hover:bg-secondary/60 flex h-full w-full flex-row items-stretch text-left transition-colors {loaded
    ? 'bg-secondary'
    : ''} {classString}"
  aria-pressed={loaded}
>
  <span class="w-10 shrink-0" style="background: {color};" aria-hidden="true"></span>
  <span class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
    <span class="truncate text-sm">{identity.uniqueString}</span>
    {#if summary?.title}
      <!-- The rid stays the headline: it is what the share link carries and
           what the owner recognises. A title is the room's own name for
           itself, which not every room has. -->
      <span class="text-muted-foreground truncate text-xs">{summary.title}</span>
    {/if}
    <span class="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
      <span>{loaded ? 'Loaded' : 'Load'}</span>
      {#if summary}
        {#if summary.theme}
          <span>· {summary.theme.name}</span>
        {/if}
        <!-- The count is the point of the row for anyone deciding what to keep:
             a room nobody ever wrote to is a room worth losing. Stated even
             when it is zero, because "no messages" is the useful answer. -->
        <span>· {summary.messages} {summary.messages === 1 ? 'message' : 'messages'}</span>
      {/if}
    </span>
  </span>
</button>
