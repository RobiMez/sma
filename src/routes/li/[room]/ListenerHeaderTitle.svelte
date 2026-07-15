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
  import { ArrowSquareUpLeft, ClockCountdown, House, WebhooksLogo } from 'phosphor-svelte';
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

    if (respTitle.error || respTitle.status === 404) {
      console.error(respTitle.message);
    } else {
      roomTitle = respTitle.body.title?.length == 0 ? respTitle.body.rid : respTitle.body.title;
    }
  }

  async function updateRoomTitle() {
    try {
      const respUpdateTitle = await signedFetch('/api/title', 'PATCH', rid, 'title:set', {
        title: roomTitle
      });

      if (respUpdateTitle.error || respUpdateTitle.status >= 400) {
        console.error(respUpdateTitle.body ?? respUpdateTitle.message);
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

<div
  class="border-primary relative flex w-full flex-row items-center justify-start gap-2 overflow-clip border px-4"
>
  <div class=" flex flex-col md:flex-row md:items-center md:gap-2">
    <h1 class="text-md font-semibold md:text-xl">Room</h1>
    <div class="flex h-8 flex-row">
      {#if isEditingTitle}
        <span in:fly={{ x: -30 }} class="h-full">
          <Input
            bind:value={roomTitle}
            class="h-full"
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
            size={roomTitle.length > 5 ? roomTitle.length : 5}
            style={`font-size: ${Math.ceil(roomTitle.length / 50)}em`}
          />
        </span>
        <span in:fly={{ x: -90 }} class="flex h-full gap-0">
          <Button
            class=" h-full "
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
        <span
          in:fly={{ x: 30 }}
          class="bg-primary text-primary-foreground flex h-full items-center justify-center px-2 py-0.5 font-light"
        >
          {roomTitle}
        </span>
        <span in:fly={{ x: 60 }}>
          <Button variant="secondary" onclick={toggleEditTitle} class="btn btn-sm h-full ">
            <PencilSimpleLine size="24" weight="duotone" />
          </Button>
        </span>
      {/if}
    </div>
  </div>

  <button
    onclick={() => {
      goto('/');
    }}
    in:fly={{ y: -4, duration: 400, easing: quintInOut }}
    out:fly={{ y: 4, easing: quintInOut }}
    class="bg-secondary hover:bg-secondary/80 text-secondary-foreground absolute top-0 left-0 flex cursor-pointer items-center justify-center gap-2 rounded-sm px-1 py-0.5 text-sm transition-all"
  >
    <House size={24} weight="duotone" />
  </button>
  <button
    onclick={() => {
      goto('/i');
    }}
    in:fly={{ y: -4, duration: 400, easing: quintInOut }}
    out:fly={{ y: 4, easing: quintInOut }}
    class="bg-primary hover:bg-primary/80 text-primary-foreground absolute top-0 left-8 flex cursor-pointer items-center justify-center gap-2 rounded-sm px-2 py-0.5 text-sm transition-all"
  >
    <ArrowSquareUpLeft size={24} weight="duotone" />
    <span> New Room </span>
  </button>
  <span
    in:fly={{ y: -4, duration: 400, easing: quintInOut }}
    out:fly={{ y: 4, easing: quintInOut }}
    class="text-primary-foreground absolute bottom-1 left-0 flex gap-1"
  >
    {#if wsConnected}
      <span
        class="flex items-center justify-center gap-1.5 rounded-sm bg-green-600/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-green-700 ring-1 ring-green-600/30 ring-inset dark:text-green-400"
        title="Live updates over WebSocket — no polling"
      >
        <span
          class="inline-block size-1.5 animate-pulse rounded-full bg-green-600 dark:bg-green-400"
        ></span>
        WebSocket connected
      </span>
    {:else}
      <span
        class="bg-primary flex items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-xs"
        title="Polling — WebSocket not connected"
        ><ClockCountdown /> {pollingInterval} s
      </span>
    {/if}
    <span class="bg-primary flex items-center justify-center gap-1 rounded-sm px-2 py-0.5 text-xs"
      ><WebhooksLogo /> {webhookUrl}
    </span>
    <span class="bg-primary rounded-sm px-2 py-0.5 text-xs"
      >{profanityEnabled ? 'Profanity Allowed' : 'Profanity Filter on'}</span
    >
  </span>
  {#key pollingInterval}
    {#if unpacking}
      <span
        in:fly={{ y: -4, duration: 400, easing: quintInOut, opacity: 1 }}
        out:fly={{ y: 4, easing: quintInOut, opacity: 1 }}
        class="bg-primary text-primary-foreground absolute right-0 bottom-0 rounded-sm px-2 py-0.5 text-sm"
      >
        Loading ...
      </span>
    {:else if !wsConnected}
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
