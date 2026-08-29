<script lang="ts">
  import CopyLink from './Header/CopyLink.svelte';
  import Mute from './Header/Mute.svelte';

  import SettingsModal from './Modals/SettingsModal.svelte';

  let {
    unpack,
    playSound = $bindable(),
    pollingInterval = $bindable(),
    profanityEnabled = $bindable(),
    voiceEnabled = $bindable(),
    webhookUrl = $bindable()
  } = $props();
</script>

<!-- A row under the title on a phone, the column beside it everywhere else. -->
<span class="flex shrink-0 flex-row gap-2 sm:flex-col">
  <CopyLink />
  <span class="flex shrink-0 flex-row gap-2">
    <SettingsModal
      {unpack}
      bind:pollingInterval
      bind:profanityEnabled
      bind:voiceEnabled
      bind:webhookUrl
    />
    <Mute bind:playSound />
  </span>
</span>
