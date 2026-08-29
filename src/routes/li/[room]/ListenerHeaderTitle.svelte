<script lang="ts">
  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
  import X from 'phosphor-svelte/lib/X';
  import PencilSimpleLine from 'phosphor-svelte/lib/PencilSimpleLine';
  import { onMount } from 'svelte';
  import type { IKeyPairs } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import Input from '$lib/components/ui/input/input.svelte';
  import { fly, slide } from 'svelte/transition';
  import { quintInOut } from 'svelte/easing';
  import {
    ArrowSquareUpLeft,
    Broadcast,
    ClockCountdown,
    House,
    WebhooksLogo
  } from 'phosphor-svelte';
  import { goto } from '$app/navigation';
  import { signedFetch } from '$lib/utils/signedRequest';
  import { apiUrl } from '$lib/api';

  interface Props {
    roomTitle: string;
    unpacking: boolean;
    pollingInterval: number;
    wsConnected?: boolean;
    rid: string;
    loadedPair: IKeyPairs;
    profanityEnabled: boolean;
    webhookUrl: string;
    children?: import('svelte').Snippet;
  }

  let {
    roomTitle = $bindable(),
    unpacking,
    wsConnected = false,
    rid,
    loadedPair,
    children,
    profanityEnabled,
    pollingInterval = $bindable(),
    webhookUrl
  }: Props = $props();

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

    if (respTitle.status !== 200) {
      console.error('Failed to fetch room title:', respTitle.body);
    } else {
      roomTitle = respTitle.body.title?.length == 0 ? respTitle.body.rid : respTitle.body.title;
    }
  }

  async function updateRoomTitle() {
    try {
      const respUpdateTitle = await signedFetch('/api/title', 'PATCH', rid, 'title:set', {
        title: roomTitle
      });

      if (respUpdateTitle.status !== 200) {
        console.error('Failed to update room title:', respUpdateTitle.body);
      } else {
        roomTitle = respUpdateTitle.body.title;
      }
    } catch (e) {
      console.error('Failed to update room title', e);
    }
  }

  onMount(async () => {
    await fetchRoomTitle();
  });
</script>

<!--
  Three stacked rows — nav, title, status — in normal flow.

  They used to be absolutely positioned into the corners of this box, which
  only held together because the box is stretched tall by the button column
  beside it and is wide enough on a desktop for the rows never to meet. At
  phone widths they overlapped: the nav buttons sat on top of the "Room"
  heading, the status chips sat on top of the title, and `overflow-clip` took
  a bite out of whichever chip reached the right edge. Laying them out as
  actual rows costs nothing on a wide screen (justify-between reproduces the
  same spread) and simply reflows on a narrow one, so keep it that way.
-->
<div
  class="border-primary relative flex w-full min-w-0 flex-col justify-between gap-2 border px-2 py-1 md:px-4"
>
  <div class="flex flex-row items-center gap-1">
    <button
      onclick={() => {
        goto('/');
      }}
      in:fly={{ y: -4, duration: 400, easing: quintInOut }}
      out:fly={{ y: 4, easing: quintInOut }}
      aria-label="Home"
      class="bg-secondary hover:bg-secondary/80 text-secondary-foreground flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm px-1 py-0.5 text-sm transition-all"
    >
      <House size={24} weight="duotone" />
    </button>
    <button
      onclick={() => {
        goto('/i');
      }}
      in:fly={{ y: -4, duration: 400, easing: quintInOut }}
      out:fly={{ y: 4, easing: quintInOut }}
      class="bg-primary hover:bg-primary/80 text-primary-foreground flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm px-2 py-0.5 text-sm transition-all"
    >
      <ArrowSquareUpLeft size={24} weight="duotone" />
      <span> New Room </span>
    </button>
  </div>

  <div class="flex min-w-0 flex-col gap-1 md:flex-row md:items-center md:gap-2">
    <h1 class="text-md font-semibold md:text-xl">Room</h1>
    <div class="flex min-w-0 flex-row items-stretch">
      {#if isEditingTitle}
        <span in:fly={{ x: -30 }} class="min-w-0 flex-1">
          <Input
            bind:value={roomTitle}
            class="h-full w-full"
            type="text"
            minlength={1}
            maxlength={24}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                if (roomTitle.length <= 0) return;
                updateRoomTitle();
                toggleEditTitle();
              }
            }}
          />
        </span>
        <span in:fly={{ x: -90 }} class="flex shrink-0 gap-0">
          <Button
            class="h-full"
            variant="secondary"
            onclick={() => {
              if (roomTitle.length <= 0) return;
              updateRoomTitle();
              toggleEditTitle();
            }}
          >
            <FloppyDisk size="24" weight="duotone" />
          </Button>
          <Button onclick={toggleEditTitle} class="h-full">
            <X size="24" weight="duotone" />
          </Button>
        </span>
      {:else}
        <!-- A title can be 24 chars and the box can be 340px wide, so it has
             to be allowed to wrap rather than run out of its own background. -->
        <span
          in:fly={{ x: 30 }}
          class="bg-primary text-primary-foreground flex min-w-0 items-center justify-center px-2 py-1 font-light break-all"
        >
          {roomTitle}
        </span>
        <span in:fly={{ x: 60 }} class="shrink-0">
          <Button
            variant="secondary"
            onclick={toggleEditTitle}
            aria-label="Rename room"
            class="btn btn-sm h-full"
          >
            <PencilSimpleLine size="24" weight="duotone" />
          </Button>
        </span>
      {/if}
    </div>
  </div>

  <span
    in:fly={{ y: -4, duration: 400, easing: quintInOut }}
    out:fly={{ y: 4, easing: quintInOut }}
    class="text-primary-foreground flex flex-wrap items-center gap-1"
  >
    {#if wsConnected}
      <span
        class="bg-primary flex items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-xs whitespace-nowrap"
        title="Live updates over WebSocket — no polling"
        ><Broadcast /> WebSocket connected
      </span>
    {:else}
      <span
        class="bg-primary flex items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-xs whitespace-nowrap"
        title="Polling — WebSocket not connected"
        ><ClockCountdown /> {pollingInterval} s
      </span>
    {/if}
    <!-- Rendered only when one is actually set; an empty chip was just a
         floating icon with nothing after it. -->
    {#if webhookUrl}
      <span
        class="bg-primary flex max-w-full items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-xs"
        title={webhookUrl}
        ><WebhooksLogo class="shrink-0" /> <span class="truncate">{webhookUrl}</span>
      </span>
    {/if}
    <span class="bg-primary rounded-sm px-2 py-0.5 text-xs whitespace-nowrap"
      >{profanityEnabled ? 'Profanity Allowed' : 'Profanity Filter on'}</span
    >
    {#if unpacking}
      <span
        in:fly={{ y: -4, duration: 400, easing: quintInOut, opacity: 1 }}
        out:fly={{ y: 4, easing: quintInOut, opacity: 1 }}
        class="bg-primary text-primary-foreground rounded-sm px-2 py-0.5 text-xs whitespace-nowrap"
      >
        Loading ...
      </span>
    {/if}
  </span>

  {#key pollingInterval}
    {#if !unpacking && !wsConnected}
      <!-- The sweeping bar tracks the poll interval; meaningless once the
           socket is live and there is no timer, so only show it when polling. -->
      <span
        in:slide={{ axis: 'x', duration: pollingInterval * 1000, easing: quintInOut }}
        out:slide={{ axis: 'y', duration: 300 }}
        class="bg-primary absolute bottom-0 left-0 h-1 w-full"
      >
      </span>
    {/if}
  {/key}
  {@render children?.()}
</div>
