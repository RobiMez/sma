<script lang="ts">
  import { ShieldCheck, ShieldSlash } from 'phosphor-svelte';
  import { onMount } from 'svelte';

  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';

  interface Props {
    rid: string;
    profanityEnabled: boolean;
  }

  let { rid, profanityEnabled = $bindable() }: Props = $props();

  const updateProf = async (newVal: boolean) => {
    if (!rid) return;
    const response = await fetch('/api/profanity', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rid,
        profanityEnabled: newVal ?? false
      })
    });

    const resp = await response.json();

    if (resp.error) {
      console.error(resp.message);
    } else {
      profanityEnabled = resp.body.profanityEnabled;
      console.log(profanityEnabled)
    }
  };
</script>

<hr />
<h3 class="text-sm">Profanity filter</h3>
<div class="flex items-center justify-start gap-2">
    <ToggleGroup.Root
      type="single"
      value={profanityEnabled ? 'on' : 'off'}
      onValueChange={(value) => {
        updateProf(value == 'on' ? true : false);
      }}
    >
      <ToggleGroup.Item
        value="on"
        class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground "
        ><ShieldSlash size={24} weight="duotone" color="currentColor" />
        <p>Profanity filter off</p></ToggleGroup.Item
      >
      <ToggleGroup.Item
        value="off"
        class="data-[state=on]:bg-primary data-[state=on] data-[state=on]:text-primary-foreground"
        ><ShieldCheck size={24} weight="duotone" color="currentColor" />
        <p>Profanity filter on</p></ToggleGroup.Item
      >
    </ToggleGroup.Root>
</div>
