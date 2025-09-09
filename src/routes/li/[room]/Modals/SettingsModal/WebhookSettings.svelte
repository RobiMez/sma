<script lang="ts">
  import type { IKeyPairs } from '$lib/types';

  import { onMount } from 'svelte';

  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';

  import { Button } from '$lib/components/ui/button';
  import Input from '$lib/components/ui/input/input.svelte';

  interface Props {
    loadedPair?: IKeyPairs | undefined;
    webhookUrl?: string;
  }

  let { loadedPair = undefined, webhookUrl = $bindable('') }: Props = $props();
  let validationError = $state('');

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

<hr />
<h3 class="text-sm">Webhook Settings</h3>

<div class="flex flex-row gap-4">
  <Input
    bind:value={webhookUrl}
    type="url"
    placeholder="Enter webhook URL"
    class=" w-full rounded-xs border p-2 {validationError ? 'border-red-500' : ''}"
  />

  <div class="flex justify-end gap-2">
    <Button onclick={updateWebhook}>
      <FloppyDisk size={20} weight="duotone" />
      Save
    </Button>
  </div>
</div>
{#if validationError}
  <small class="text-sm text-red-500">{validationError}</small>
{/if}
