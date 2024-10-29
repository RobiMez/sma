<script lang="ts">
  import { onMount } from 'svelte';

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

<div class="flex flex-row items-center justify-center">
  <span class="p-2 text-sm">{profanityFilterEnabled ? 'Unblock' : 'Block'} Profanity :</span>
  <input
    type="checkbox"
    class="toggle toggle-sm"
    on:change={(e) => updateProf(e)}
    checked={profanityFilterEnabled}
  />
</div>
