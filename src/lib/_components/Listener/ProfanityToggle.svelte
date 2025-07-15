<script lang="ts">
  import { onMount } from 'svelte';
  import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
  import ShieldSlash from 'phosphor-svelte/lib/ShieldSlash';

  export let pbKey: string | undefined;
  export let rid: string;

  let profanityFilterEnabled = false;

  const updateProf = async (e: any) => {
    if (!pbKey) return;
    const response = await fetch('/api/prof', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pbKey,
        profanityEnabled: e.target.checked ?? false
      })
    });

    const resp = await response.json();

    if (resp.error) {
      console.log(resp.message);
    } else {
      profanityFilterEnabled = resp.body.profanityEnabled;
    }
  };

  // Fetch initial profanity setting
  async function fetchProfanitySetting() {
    const response = await fetch('/api/prof', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rid })
    });

    const resp = await response.json();
    if (!resp.error) {
      profanityFilterEnabled = resp.body.profanityEnabled;
    }
  }

  onMount(() => {
    fetchProfanitySetting();
  });
</script>

<div class="flex flex-col gap-2 rounded-sm border border-light-400 p-2 dark:border-dark-600">
  <div class="flex flex-row items-center justify-between">
    <div class="flex flex-row items-center gap-3">
      {#if profanityFilterEnabled}
        <ShieldCheck size={16} weight="duotone" />
      {:else}
        <ShieldSlash size={16} weight="duotone" />
      {/if}
      <span class="text-sm font-medium">Profanity Filter</span>
    </div>

    <input
      type="checkbox"
      class="toggle toggle-sm ml-4"
      on:change={(e) => updateProf(e)}
      checked={profanityFilterEnabled}
    />
  </div>
</div>
