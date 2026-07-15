<script lang="ts">
  import { ShieldCheck, ShieldSlash } from 'phosphor-svelte';
  import { onMount } from 'svelte';

  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import { signedFetch } from '$lib/utils/signedRequest';

  interface Props {
    rid: string;
    profanityEnabled: boolean;
  }

  let { rid, profanityEnabled = $bindable() }: Props = $props();

  const updateProf = async (newVal: boolean) => {
    if (!rid) return;
    try {
      const resp = await signedFetch('/api/profanity', 'PATCH', rid, 'profanity:set', {
        profanityEnabled: newVal ?? false
      });

      if (resp.error || resp.status >= 400) {
        console.error(resp.body ?? resp.message);
      } else {
        profanityEnabled = resp.body.profanityEnabled;
      }
    } catch (e) {
      console.error('Failed to update profanity filter', e);
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
