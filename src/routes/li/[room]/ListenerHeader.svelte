<script lang="ts">
  import ListenerHeaderTitle from './ListenerHeaderTitle.svelte';

  import { page } from '$app/state';

  import ListenerHeaderConfig from './ListenerHeaderConfig.svelte';

  let {
    unpack,
    loadedPair,
    wsConnected = false,
    playSound = $bindable(),
    unpacking = $bindable(),
    pollingInterval = $bindable(),
    isProfanityEnabled,
    isVoiceEnabled = false
  } = $props();

  let profanityEnabled = $state(isProfanityEnabled);
  let voiceEnabled = $state(isVoiceEnabled);
  let webhookUrl = $state('');
  let rid = page.params.room;
  let roomTitle = $state(rid);
</script>

{#if roomTitle && loadedPair && rid}
  <!-- Side by side once there's room for it; stacked on a phone, where the
       button column was taking nearly half the width away from the title. -->
  <div class="flex w-full min-w-0 flex-col gap-2 border p-1 pb-1 sm:flex-row">
    <ListenerHeaderTitle
      bind:roomTitle
      bind:pollingInterval
      {unpacking}
      {wsConnected}
      {rid}
      {loadedPair}
      {profanityEnabled}
      {webhookUrl}
    />
    <ListenerHeaderConfig
      {unpack}
      bind:playSound
      bind:pollingInterval
      bind:profanityEnabled
      bind:voiceEnabled
      bind:webhookUrl
    />
  </div>
{/if}
