<script lang="ts">
  import ListenerHeaderTitle from './ListenerHeaderTitle.svelte';

  import { page } from '$app/state';

  import ListenerHeaderConfig from './ListenerHeaderConfig.svelte';

  let {
    loadedPair,
    wsConnected = false,
    playSound = $bindable(),
    unpacking = $bindable(),
    pollingInterval = $bindable(),
    isProfanityEnabled,
    isVoiceEnabled = false,
    initialLimits = {
      paused: false,
      imagesEnabled: true,
      maxMessageLength: 0,
      rateLimitCount: 0,
      rateLimitPeriod: 'hour'
    }
  } = $props();

  let profanityEnabled = $state(isProfanityEnabled);
  let voiceEnabled = $state(isVoiceEnabled);
  let webhookUrl = $state('');
  // Intentionally the initial value: the load-function read seeds the modal's
  // controls once, and the signed PATCH responses own the state after that
  // (same pattern as profanityEnabled/voiceEnabled above).
  // svelte-ignore state_referenced_locally
  let roomLimits = $state({ ...initialLimits });
  let rid = page.params.room;
  let roomTitle = $state(rid);
</script>

{#if roomTitle && loadedPair && rid}
  <div class="flex w-full flex-row gap-2 border p-1 pb-1">
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
      bind:playSound
      bind:profanityEnabled
      bind:voiceEnabled
      bind:webhookUrl
      bind:roomLimits
    />
  </div>
{/if}
