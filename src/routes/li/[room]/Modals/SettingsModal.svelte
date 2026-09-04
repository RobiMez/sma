<script lang="ts">
  import X from 'phosphor-svelte/lib/X';

  import * as Dialog from '$lib/components/ui/dialog';

  import { Button } from '$lib/components/ui/button';
  import { GearSix } from 'phosphor-svelte';
  import ProfanityToggle from './SettingsModal/ProfanityToggle.svelte';
  import VoiceToggle from './SettingsModal/VoiceToggle.svelte';
  import ImagesToggle from './SettingsModal/ImagesToggle.svelte';
  import LimitsSettings from './SettingsModal/LimitsSettings.svelte';
  import { page } from '$app/state';
  import WebhookSettings from './SettingsModal/WebhookSettings.svelte';

  let {
    showModal = $bindable(false),
    profanityEnabled = $bindable(),
    voiceEnabled = $bindable(),
    webhookUrl = $bindable(),
    roomLimits = $bindable()
  } = $props();

  let rid = page.params.room ?? '';
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

    <ProfanityToggle {rid} bind:profanityEnabled />
    <hr />
    <!-- Two content types, one row: each column wrapper keeps the component's
         multiple root elements (h3 + control) from becoming grid items. -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <VoiceToggle {rid} bind:voiceEnabled />
      </div>
      <div class="flex flex-col gap-2">
        <ImagesToggle {rid} bind:limits={roomLimits} />
      </div>
    </div>
    <LimitsSettings {rid} bind:limits={roomLimits} />
    <WebhookSettings {rid} bind:webhookUrl />

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
