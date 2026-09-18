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

<Button onclick={() => (showModal = true)} variant="ghost" class="border-border h-full rounded-none border-l p-0">
  <span class="flex h-full w-full flex-col items-center justify-center gap-0.5 px-5 py-2">
    <span>
      <GearSix size={20} weight="duotone" />
    </span>
    <span class="flex text-xs whitespace-nowrap md:text-sm"> Settings </span>
  </span>
</Button>

<Dialog.Root bind:open={showModal}>
  <!-- Bounded and scrollable: a settings modal grows over time, and a centred
       dialog taller than the screen is cut off at BOTH ends, which puts the
       last sections out of reach entirely.

       A fixed 4xl rather than the 40vw it used to be, which matches the app's
       own content column so the modal is the width of the page behind it. A
       viewport-proportional width meant the same settings form was 400px on a
       laptop and 1000px on a large monitor: cramped for most people, sprawling
       for the rest, and impossible to lay out for. The primitive's own
       max-w-[calc(100%-2rem)] still handles phones.

       The min() is not decoration. The primitive clamps itself to the viewport
       with a BASE max-w, and any sm: width here overrides that clamp rather
       than cooperating with it: plain sm:max-w-4xl left a 900px-wide window
       with 2px of margin either side. Carrying the clamp inside the same
       declaration is the only way both rules survive. -->
  <Dialog.Content class="sm:max-w-[min(56rem,calc(100vw-4rem))] max-h-[85vh] overflow-y-auto">
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
