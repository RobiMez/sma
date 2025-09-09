<script lang="ts">
  import { onMount } from 'svelte';

  import X from 'phosphor-svelte/lib/X';

  import * as Dialog from '$lib/components/ui/dialog';

  import { Button } from '$lib/components/ui/button';
  import { GearSix } from 'phosphor-svelte';
  import PollingDurationSelector from './SettingsModal/PollingDurationSelector.svelte';
  import ProfanityToggle from './SettingsModal/ProfanityToggle.svelte';
  import { page } from '$app/state';
  import WebhookSettings from './SettingsModal/WebhookSettings.svelte';

  let {
    unpack,
    showModal = $bindable(false),
    pollingInterval = $bindable(),
    profanityEnabled = $bindable(),
    webhookUrl = $bindable()
  } = $props();

  let rid = page.params.room ?? '';
  onMount(async () => {});
</script>

<Button onclick={() => (showModal = true)} class="h-auto p-0" variant="default">
  <span class="flex aspect-square size-18 flex-col items-center justify-center">
    <span>
      <GearSix size={20} weight="duotone" />
    </span>
    <span class="hidden text-xs whitespace-nowrap md:text-sm lg:flex"> Settings </span>
  </span>
</Button>

<Dialog.Root bind:open={showModal}>
  <Dialog.Content class="sm:max-w-[40vw]">
    <Dialog.Header>
      <Dialog.Title>Settings</Dialog.Title>
      <Dialog.Description class="flex flex-row items-center justify-between">
        Manage Settings of this room
      </Dialog.Description>
    </Dialog.Header>

    <PollingDurationSelector bind:pollingInterval onIntervalChange={unpack} />
    <ProfanityToggle {rid} bind:profanityEnabled />
    <WebhookSettings bind:webhookUrl />

    <Dialog.Footer>
      <div class="flex justify-end gap-2">
        <Button onclick={() => (showModal = false)} variant="outline">
          <X size={20} />
          Cancel
        </Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
