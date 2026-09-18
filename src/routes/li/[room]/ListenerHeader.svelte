<script lang="ts">
  import ListenerHeaderTitle from './ListenerHeaderTitle.svelte';

  import { page } from '$app/state';

  import ListenerHeaderConfig from './ListenerHeaderConfig.svelte';
  import ListenerStatus from './ListenerStatus.svelte';

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
  // `page.params.room` is string | undefined. Pinning it to a string here is
  // what lets roomTitle be a plain string: the old `roomTitle &&` in the guard
  // below was doubling as that narrowing, so removing it from the guard would
  // otherwise break the bind. An empty rid is still caught by the guard.
  const rid = page.params.room ?? '';
  let roomTitle = $state(rid);
</script>

<!-- Deliberately NOT gated on roomTitle. It used to be, and roomTitle is
     bound straight to the rename field: clearing that field made the whole
     header unmount, taking the input being typed in with it, with no way back
     short of a reload. What decides whether this room can render is the key
     and the rid, never the text of its title. -->
{#if loadedPair && rid}
  <!-- A stack of rows at every width. The side-by-side md: arrangement is
       gone along with the box around it: the content column already frames
       this, so the header only needs rules between its rows. -->
  <div class="flex w-full flex-col">
    <ListenerHeaderTitle bind:roomTitle {rid} {loadedPair} />
    <ListenerHeaderConfig
      bind:playSound
      bind:profanityEnabled
      bind:voiceEnabled
      bind:webhookUrl
      bind:roomLimits
    />
    <!-- Below the controls, not above them: the room's identity comes first,
         then what you can do with it, then how it is currently behaving. -->
    <ListenerStatus {wsConnected} {pollingInterval} {webhookUrl} {profanityEnabled} {unpacking} />
  </div>
{/if}
