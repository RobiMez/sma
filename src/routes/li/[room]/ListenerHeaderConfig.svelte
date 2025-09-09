<script lang="ts">
  import CopyLink from './Header/CopyLink.svelte';
  import Mute from './Header/Mute.svelte';

  import SettingsModal from './Modals/SettingsModal.svelte';

  let {
    unpack,
    playSound = $bindable(),
    pollingInterval = $bindable(),
    profanityEnabled = $bindable(),
    webhookUrl = $bindable()
  } = $props();
</script>

<span class="flex flex-col gap-2">
  <CopyLink />
  <span class="flex flex-row gap-2">
    <SettingsModal {unpack} bind:pollingInterval bind:profanityEnabled bind:webhookUrl />
    <Mute bind:playSound />
  </span>
</span>
