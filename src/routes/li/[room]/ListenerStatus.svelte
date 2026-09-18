<script lang="ts">
  import { fly, slide } from 'svelte/transition';
  import { quintInOut } from 'svelte/easing';
  import { Broadcast, ClockCountdown, WebhooksLogo } from 'phosphor-svelte';
  import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
  import ShieldSlash from 'phosphor-svelte/lib/ShieldSlash';

  // Split out of ListenerHeaderTitle so it can sit below the controls row.
  // It has no business being inside the title component beyond the accident
  // of where it used to be pinned, and as its own component the header's row
  // order is decided in one place: ListenerHeader's markup.

  interface Props {
    wsConnected?: boolean;
    pollingInterval: number;
    webhookUrl: string;
    profanityEnabled: boolean;
    unpacking: boolean;
  }

  let {
    wsConnected = false,
    pollingInterval,
    webhookUrl,
    profanityEnabled,
    unpacking
  }: Props = $props();
</script>

<!-- Status and loading state, the last row of the header. These are the parts
     that arrive late and change size as they do: the socket connects and
     "10 s" becomes "WebSocket connected", the webhook pill appears once the
     settings read lands, the profanity flag resolves. min-h reserves the
     row so an empty one and a full one measure the same. -->
<div
  class="border-border flex min-h-8 w-full flex-row flex-wrap items-stretch border-b"
>
  <span
    in:fly={{ y: -4, duration: 400, easing: quintInOut }}
    out:fly={{ y: 4, easing: quintInOut }}
    class="flex flex-wrap items-stretch"
  >
    <!-- Cells, not chips: the row runs to the column's edges like the title
         and controls rows above it, so these need dividers between them
         rather than boxes around them and a padded row to float in.

         Labels show at every width, and are kept to one word so they fit a
         phone without collapsing back to bare icons. The `title` on each cell
         carries the full sentence, so brevity costs nothing: "Connected" and
         "Filtered"/"Unfiltered" say which state, the tooltip says what it
         means. Cells wrap rather than overflow if a webhook is set. -->
    {#if wsConnected}
      <span
        class="border-border flex items-center justify-center gap-1 border-r px-4 py-1.5 text-sm"
        title="Connected: live updates over WebSocket, no polling"
      >
        <Broadcast />
        <span class="whitespace-nowrap">Connected</span>
      </span>
    {:else}
      <!-- Not collapsed: the interval is a number that changes, and an icon
           cannot say "30 s". It is also short enough not to be the problem. -->
      <span
        class="border-border flex items-center justify-center gap-1 border-r px-4 py-1.5 text-sm whitespace-nowrap"
        title="Polling (WebSocket not connected)"
        ><ClockCountdown /> {pollingInterval} s
      </span>
    {/if}
    {#if webhookUrl}
      <!-- Only when one is set: an empty pill said nothing and still took
           space. Capped because a webhook URL is arbitrarily long and would
           overrun the row on its own, at any screen size. -->
      <span
        class="border-border flex items-center justify-center gap-1 border-r px-4 py-1.5 text-sm"
        title="Webhook fires on new messages: {webhookUrl}"
      >
        <WebhooksLogo />
        <span class="max-w-32 truncate">{webhookUrl}</span>
      </span>
    {/if}
    <span
      class="border-border flex items-center justify-center gap-1 border-r px-4 py-1.5 text-sm"
      title={profanityEnabled
        ? 'Unfiltered: profanity is allowed in this room'
        : 'Filtered: the profanity filter is on'}
    >
      <!-- Same two icons the settings toggle uses, so the header and the
           control that changes it read as the same thing. -->
      {#if profanityEnabled}<ShieldSlash />{:else}<ShieldCheck />{/if}
      <span class="whitespace-nowrap">
        {profanityEnabled ? 'Unfiltered' : 'Filtered'}
      </span>
    </span>
  </span>
  {#if unpacking}
    <span
      in:fly={{ y: -4, duration: 400, easing: quintInOut, opacity: 1 }}
      out:fly={{ y: 4, easing: quintInOut, opacity: 1 }}
      class="border-border ml-auto flex items-center border-l px-4 py-1.5 text-sm"
    >
      Loading ...
    </span>
  {/if}
</div>

<!-- The poll track is always in the DOM and always h-1, so the bar arriving
     or leaving never changes the header's height. Only its fill is
     conditional; the sweep tracks the poll interval and is meaningless once
     the socket is live and there is no timer. -->
<div class="h-1 w-full">
  {#key pollingInterval}
    {#if !wsConnected && !unpacking}
      <span
        in:slide={{ axis: 'x', duration: pollingInterval * 1000, easing: quintInOut }}
        out:slide={{ axis: 'y', duration: 300 }}
        class="bg-muted-foreground/50 block h-full w-full"
      >
      </span>
    {/if}
  {/key}
</div>
