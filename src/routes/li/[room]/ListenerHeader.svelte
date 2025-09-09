<script lang="ts">
  import ListenerHeaderTitle from './ListenerHeaderTitle.svelte';

  import { page } from '$app/state';

  import ListenerHeaderConfig from './ListenerHeaderConfig.svelte';

  let {
    unpack,
    loadedPair,
    playSound = $bindable(),
    unpacking = $bindable(),
    pollingInterval = $bindable(),
    isProfanityEnabled
  } = $props();

  let profanityEnabled = $state(isProfanityEnabled);
  let webhookUrl = $state('');
  let rid = page.params.room;
  let roomTitle = $state(rid);
</script>

{#if roomTitle && loadedPair && rid}
  <div class="flex w-full flex-row gap-2 border p-1 pb-1">
    <ListenerHeaderTitle
      bind:roomTitle
      bind:pollingInterval
      {unpacking}
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
      bind:webhookUrl
    />
  </div>
{/if}
