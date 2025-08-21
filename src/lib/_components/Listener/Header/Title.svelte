<script lang="ts">
  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
  import X from 'phosphor-svelte/lib/X';
  import PencilSimpleLine from 'phosphor-svelte/lib/PencilSimpleLine';
  import { onMount } from 'svelte';

  interface Props {
    roomTitle: string;
    unlocked: boolean;
    unpacking: boolean;
    rid: string;
    loadedPair: any;
    children?: import('svelte').Snippet;
  }

  let {
    roomTitle = $bindable(),
    unlocked,
    unpacking,
    rid,
    loadedPair,
    children
  }: Props = $props();

  let isEditingTitle = $state(false);

  const toggleEditTitle = () => {
    isEditingTitle = !isEditingTitle;
  };

  async function fetchRoomTitle() {
    const responseTitle = await fetch(`/api/titl?rid=${rid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const respTitle = await responseTitle.json();

    if (respTitle.error || respTitle.status === 404) {
      console.log(respTitle.message);
    } else {
      roomTitle = respTitle.body.title?.length == 0 ? respTitle.body.rid : respTitle.body.title;
    }
  }

  async function updateRoomTitle() {
    const responseUpdateTitle = await fetch('/api/titl', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pbKey: loadedPair?.pbKey,
        title: roomTitle
      })
    });

    const respUpdateTitle = await responseUpdateTitle.json();

    if (respUpdateTitle.error) {
      console.log(respUpdateTitle.message);
    } else {
      roomTitle = respUpdateTitle.body.title;
    }
  }

  onMount(async () => {
    await fetchRoomTitle();
  });
</script>

<h1
  class="border-black relative flex w-full flex-row items-center justify-start gap-2 border p-1 text-left text-base font-semibold md:p-2 md:text-xl lg:p-4 lg:text-2xl dark:border-dark-400"
>
  Room
  {#if isEditingTitle}
    <input
      bind:value={roomTitle}
      type="text"
      minlength="1"
      maxlength="24"
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          if (roomTitle.length <= 0) return;
          updateRoomTitle();
          toggleEditTitle();
        }
      }}
      class="text-base-content focus:bg-base-100 min-h-8 rounded-sm border-none p-1 font-extralight focus:outline-none"
      size={roomTitle.length > 5 ? roomTitle.length : 5}
      style={`font-size: ${Math.ceil(roomTitle.length / 50)}em`}
    />
    <button
      onclick={() => {
        if (roomTitle.length <= 0) return;
        updateRoomTitle();
        toggleEditTitle();
      }}
      class="btn btn-square btn-sm"
    >
      <FloppyDisk size="24" weight="duotone" />
    </button>
    <button onclick={toggleEditTitle} class="btn btn-square btn-sm">
      <X size="24" weight="duotone" />
    </button>
  {:else}
    <span class="text-base-content pointer-events-none rounded-sm border-none p-1 font-extralight">
      {roomTitle}
    </span>
    <button onclick={toggleEditTitle} class="btn btn-sm my-4">
      <PencilSimpleLine size="24" weight="duotone" />
    </button>
  {/if}

  {#if unlocked}
    <span
      class="absolute -top-1 left-1 rounded-sm bg-light-900 px-2 py-1 text-xs font-light text-dark-100 dark:bg-dark-800 dark:text-light-100"
    >
      Your
    </span>
  {/if}

  {#if unpacking}
    <span
      class="absolute -bottom-3 left-1 rounded-sm bg-light-200 p-1 px-2 text-xs font-normal dark:bg-dark-900 dark:text-dark-200"
    >
      Loading ...
    </span>
  {/if}

  {@render children?.()}
</h1>
