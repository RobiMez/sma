<script lang="ts">
  import CopyLink from './Header/CopyLink.svelte';
  import Mute from './Header/Mute.svelte';

  import SettingsModal from './Modals/SettingsModal.svelte';

  let {
    playSound = $bindable(),
    profanityEnabled = $bindable(),
    voiceEnabled = $bindable(),
    webhookUrl = $bindable(),
    roomLimits = $bindable()
  } = $props();
</script>

<span class="flex flex-col gap-2">
  <CopyLink />
  <span class="flex flex-row gap-2">
    <SettingsModal
      bind:profanityEnabled
      bind:voiceEnabled
      bind:webhookUrl
      bind:roomLimits
    />
    <Mute bind:playSound />
  </span>
</span>
