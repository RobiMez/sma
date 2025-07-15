<script lang="ts">
  import { onMount } from 'svelte';
  import Clock from 'phosphor-svelte/lib/Clock';
  import ClockCountdown from 'phosphor-svelte/lib/ClockCountdown';

  export let rid: string;
  export let loadedPair: any;

  let slowModeEnabled = false;
  let slowModeDelay = 0;
  let loading = false;

  const delayOptions = [
    { label: '30 seconds', value: 30 },
    { label: '1 minute', value: 60 },
    { label: '3 minutes', value: 180 }
  ];

  const updateSlowMode = async () => {
    if (!loadedPair?.uniqueString || loadedPair.uniqueString !== rid) return;

    loading = true;
    try {
      const response = await fetch('/api/slowmode', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rid,
          slowModeEnabled,
          slowModeDelay
        })
      });

      const resp = await response.json();

      if (resp.error) {
        console.error('Failed to update slow mode:', resp.message);
      } else {
        slowModeEnabled = resp.body.slowModeEnabled;
        slowModeDelay = resp.body.slowModeDelay;
      }
    } catch (error) {
      console.error('Error updating slow mode:', error);
    } finally {
      loading = false;
    }
  };

  const fetchSlowModeSettings = async () => {
    try {
      const response = await fetch(`/api/slowmode?rid=${rid}`);
      const resp = await response.json();

      if (!resp.error) {
        slowModeEnabled = resp.body.slowModeEnabled;
        slowModeDelay = resp.body.slowModeDelay;
      }
    } catch (error) {
      console.error('Error fetching slow mode settings:', error);
    }
  };

  onMount(() => {
    fetchSlowModeSettings();
  });

  // Only show slow mode controls if user is the room owner
  $: isRoomOwner = loadedPair?.uniqueString === rid;
</script>

{#if isRoomOwner}
  <div class="flex flex-col gap-2 rounded-sm border border-light-400 p-2 dark:border-dark-600">
    <div class="flex flex-row items-center justify-between">
      <div class="flex flex-row items-center gap-3">
        {#if slowModeEnabled}
          <ClockCountdown size={16} weight="duotone" />
        {:else}
          <Clock size={16} weight="duotone" />
        {/if}
        <span class="text-sm font-medium">Slow Mode</span>
      </div>

      <input
        type="checkbox"
        class="toggle toggle-sm ml-4"
        bind:checked={slowModeEnabled}
        on:change={updateSlowMode}
        disabled={loading}
      />
    </div>

    {#if slowModeEnabled}
      <div class="flex flex-col gap-1">
        <span class="text-xs text-light-600 dark:text-dark-400">Message delay:</span>
        <select
          bind:value={slowModeDelay}
          on:change={updateSlowMode}
          disabled={loading}
          class="select select-sm w-full border border-light-400 bg-light-200 dark:border-dark-600 dark:bg-dark-800"
        >
          {#each delayOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>
{:else if slowModeEnabled}
  <div class="flex flex-row items-center gap-2 p-2 text-sm text-light-600 dark:text-dark-400">
    <ClockCountdown size={16} weight="duotone" />
    <span
      >Slow mode active: {delayOptions.find((opt) => opt.value === slowModeDelay)?.label ||
        `${slowModeDelay}s`}</span
    >
  </div>
{/if}
