<script lang="ts">
  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
  import X from 'phosphor-svelte/lib/X';
  import PencilSimpleLine from 'phosphor-svelte/lib/PencilSimpleLine';
  import { onMount } from 'svelte';
  import type { IKeyPairs } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import Input from '$lib/components/ui/input/input.svelte';
  import { fly } from 'svelte/transition';
  import { signedFetch } from '$lib/utils/signedRequest';
  import { apiUrl } from '$lib/api';

  interface Props {
    roomTitle: string;
    rid: string;
    loadedPair: IKeyPairs;
    children?: import('svelte').Snippet;
  }

  // Socket, polling, webhook and profanity state all moved to
  // ListenerStatus.svelte with the row that renders them.
  let { roomTitle = $bindable(), rid, loadedPair, children }: Props = $props();

  let isEditingTitle = $state(false);

  const toggleEditTitle = () => {
    isEditingTitle = !isEditingTitle;
  };

  async function fetchRoomTitle() {
    const responseTitle = await fetch(apiUrl(`/api/title?rid=${rid}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const respTitle = await responseTitle.json();

    if (respTitle.error || respTitle.status === 404) {
      console.error(respTitle.message);
    } else {
      // `undefined == 0` is false, so the old ternary passed a missing title
      // straight through and left roomTitle undefined. Fall back to the rid.
      roomTitle = respTitle.body.title || respTitle.body.rid || rid;
    }
  }

  async function updateRoomTitle() {
    try {
      const respUpdateTitle = await signedFetch('/api/title', 'PATCH', rid, 'title:set', {
        title: roomTitle.trim()
      });

      if (respUpdateTitle.error || respUpdateTitle.status >= 400) {
        console.error(respUpdateTitle.body ?? respUpdateTitle.message);
      } else {
        roomTitle = respUpdateTitle.body.title || rid;
      }
    } catch (e) {
      console.error('Failed to update room title', e);
    }
  }

  onMount(async () => {
    await fetchRoomTitle();
  });
</script>

<!-- Rows separated by a bottom rule, not boxes. This block used to be a
     bordered box inside another bordered box, which read as nested cards; the
     content column already supplies the outer frame, so each row only needs
     the line beneath it. One arrangement at every width, no md: split. -->
<div class="flex w-full flex-col">
  <!-- No "Room" label: the row is the room, and the id says which one.
       A cell row like the controls beneath it and the nav above: no padding
       on the row, no gaps, the id running to the column's left edge and the
       last control to its right. The id had a border of its own, which read
       as a field floating inside a padded row; as a cell it needs only the
       dividers between it and what follows. -->
  <div class="border-border flex w-full flex-row items-stretch border-b">
    {#if isEditingTitle}
      <span in:fly={{ x: -30 }} class="flex flex-1 items-center px-4 py-2">
        <Input
          bind:value={roomTitle}
          class="h-full w-full"
          type="text"
          minlength={1}
          maxlength={24}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              if (!roomTitle.trim()) return;
              updateRoomTitle();
              toggleEditTitle();
            }
          }}
        />
      </span>
      <span in:fly={{ x: -90 }} class="flex items-stretch">
        <Button
          class="border-border h-full rounded-none border-l px-4"
          variant="ghost"
          onclick={() => {
            if (!roomTitle.trim()) return;
            updateRoomTitle();
            toggleEditTitle();
          }}
        >
          <FloppyDisk size="24" weight="duotone" />
        </Button>
        <Button
          onclick={toggleEditTitle}
          variant="ghost"
          class="border-border h-full rounded-none border-l px-4"
        >
          <X size="24" weight="duotone" />
        </Button>
      </span>
    {:else}
      <span
        in:fly={{ x: 30 }}
        class="font-display flex flex-1 items-center justify-center px-4 py-3 font-light"
      >
        <!-- Falls back to the rid: a room whose title is empty (mid-rename, or
             never set) should read as itself, not as a blank row. -->
        {roomTitle || rid}
      </span>
      <Button
        variant="ghost"
        onclick={toggleEditTitle}
        class="border-border h-full rounded-none border-l px-4"
      >
        <PencilSimpleLine size="24" weight="duotone" />
      </Button>
    {/if}
  </div>


  {@render children?.()}
</div>
