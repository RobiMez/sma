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

<!-- The controls row, built like the nav bar: cells butted together with a
     shared rule, no gaps, no box. Copy link takes the free space because it is
     the primary action here and the only one a room owner needs before anyone
     has written to them. -->
<span class="border-border flex w-full flex-row items-stretch border-b">
  <span class="border-border flex-1 border-r">
    <CopyLink />
  </span>
  <span class="flex flex-row items-stretch">
    <SettingsModal
      bind:profanityEnabled
      bind:voiceEnabled
      bind:webhookUrl
      bind:roomLimits
    />
    <Mute bind:playSound />
  </span>
</span>
