<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';

  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
  import CheckFat from 'phosphor-svelte/lib/CheckFat';

  import { Button } from '$lib/components/ui/button';
  import Input from '$lib/components/ui/input/input.svelte';
  import { signedFetch } from '$lib/utils/signedRequest';

  interface Props {
    rid: string;
    webhookUrl?: string;
  }

  let { rid, webhookUrl = $bindable('') }: Props = $props();
  let validationError = $state('');
  let saved = $state(false);

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

    validationError = '';

    try {
      const resp = await signedFetch('/api/webhook', 'PATCH', rid, 'webhook:set', { webhookUrl });

      if (resp.error || resp.status >= 400) {
        validationError = typeof resp.body === 'string' ? resp.body : 'Failed to update webhook';
        return;
      }
    } catch {
      validationError = 'Failed to update webhook';
      return;
    }

    saved = true;
    setTimeout(() => (saved = false), 2000);
  }

  onMount(async () => {
    // Reading the webhook is owner-only too, so it's a signed POST.
    try {
      const data = await signedFetch('/api/webhook', 'POST', rid, 'webhook:read');
      if (data.body?.webhookUrl) {
        webhookUrl = data.body.webhookUrl;
      }
    } catch (e) {
      console.warn('Could not load current webhook URL', e);
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
      {#if saved}
        <span in:scale={{ start: 0.9 }} class="flex items-center justify-center gap-2">
          <CheckFat size={20} weight="duotone" />
          Saved
        </span>
      {:else}
        <span in:scale={{ start: 0.9 }} class="flex items-center justify-center gap-2">
          <FloppyDisk size={20} weight="duotone" />
          Save
        </span>
      {/if}
    </Button>
  </div>
</div>
{#if validationError}
  <small class="text-sm text-red-500">{validationError}</small>
{/if}
