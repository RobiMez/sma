<script lang="ts">
  import type { LoadedPair } from '$lib/types';
  import WebhooksLogo from 'phosphor-svelte/lib/WebhooksLogo';
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import X from 'phosphor-svelte/lib/X';
  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';

  export let loadedPair: LoadedPair | undefined = undefined;
  export let showModal = false;

  export let webhookUrl = '';
  let validationError = '';

  function isValidUrl(url: string): boolean {
    if (!url) return true; // Allow empty URL for clearing webhook
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function updateWebhook() {
    if (!isValidUrl(webhookUrl)) {
      validationError = 'Please enter a valid HTTP or HTTPS URL';
      return;
    }

    const response = await fetch('/api/webhook', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rid: loadedPair?.uniqueString,
        webhookUrl
      })
    });

    const resp = await response.json();

    if (resp.error) {
      validationError = 'Failed to update webhook';
    } else {
      showModal = false;
    }
  }

  onMount(async () => {
    const res = await fetch(`/api/webhook?rid=${loadedPair?.uniqueString}`);
    const data = await res.json();
    if (data.body?.webhookUrl) {
      webhookUrl = data.body.webhookUrl;
    }
  });
</script>

<button
  class="py-auto min-w-18 max-w-18 flex aspect-square flex-row items-center justify-center overflow-clip rounded-sm bg-light-200 dark:bg-dark-900 dark:text-dark-200"
  on:click={() => (showModal = true)}
>
  <span class="flex flex-col items-center justify-center gap-2">
    <span>
      <WebhooksLogo size={20} weight="duotone" />
    </span>
    <span class="bottom-1 whitespace-nowrap text-xs md:text-sm lg:flex"> Webhook </span>
  </span>
</button>

{#if showModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-dark-900/50
    
    "
    on:click|self={() => (showModal = false)}
  >
    <div
      class="w-full max-w-xl rounded-sm
      border border-dark-base bg-light-base p-6
      shadow-md dark:border-light-base dark:bg-dark-base
      "
      transition:scale={{ duration: 100, start: 0.9 }}
    >
      <h2 class="mb-4 text-xl font-semibold">Webhook Settings</h2>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <input
            bind:value={webhookUrl}
            type="url"
            placeholder="Enter webhook URL"
            class="w-full rounded-sm border border-light-400 bg-light-200 p-2 dark:border-dark-600 dark:bg-dark-800 {validationError
              ? 'border-red-500'
              : ''}"
          />
          {#if validationError}
            <small class="text-red-500 text-sm">{validationError}</small>
          {/if}
          <small class="text-sm text-light-800 dark:text-dark-200">
            Receive notifications when new messages arrive
          </small>
        </div>
        <div class="flex justify-end gap-2">
          <button class="cancel-button" on:click={() => (showModal = false)}>
            <X size={20} />
            Cancel
          </button>
          <button class="save-button" on:click={updateWebhook}>
            <FloppyDisk size={20} />
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .save-button {
    @apply flex flex-row items-center justify-center gap-2 rounded-sm border border-light-400 px-4 py-2 dark:border-dark-600;
  }
  .cancel-button {
    @apply flex flex-row items-center justify-center gap-2 rounded-sm border border-light-400 px-4 py-2 dark:border-dark-600;
  }
</style>
