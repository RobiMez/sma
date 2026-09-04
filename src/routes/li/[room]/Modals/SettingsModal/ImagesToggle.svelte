<script lang="ts">
  import ImagesSquare from 'phosphor-svelte/lib/ImagesSquare';
  import ImageBroken from 'phosphor-svelte/lib/ImageBroken';

  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import { signedFetch } from '$lib/utils/signedRequest';
  import type { IRoomLimits } from '$lib/types';

  interface Props {
    rid: string;
    limits: IRoomLimits;
  }

  let { rid, limits = $bindable() }: Props = $props();

  // Same limits:set action the Abuse limits section uses: images are stored
  // on the same settings object, this control just lives next to the voice
  // toggle in the modal. Local state comes from the response, not the
  // optimistic value, same as VoiceToggle.
  const updateImages = async (newVal: boolean) => {
    if (!rid) return;
    try {
      const resp = await signedFetch('/api/limits', 'PATCH', rid, 'limits:set', {
        imagesEnabled: newVal
      });

      if (resp.status !== 200) {
        console.error('Failed to update images setting:', resp.body);
      } else {
        limits = resp.body;
      }
    } catch (e) {
      console.error('Failed to update images setting', e);
    }
  };
</script>

<h3 class="text-sm">Images</h3>
<div class="flex items-center justify-start gap-2">
  <ToggleGroup.Root
    type="single"
    value={limits.imagesEnabled ? 'on' : 'off'}
    onValueChange={(value) => {
      if (value) updateImages(value === 'on');
    }}
  >
    <ToggleGroup.Item
      value="off"
      class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      ><ImageBroken size={24} weight="duotone" color="currentColor" />
      <p>Images off</p></ToggleGroup.Item
    >
    <ToggleGroup.Item
      value="on"
      class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      ><ImagesSquare size={24} weight="duotone" color="currentColor" />
      <p>Images on</p></ToggleGroup.Item
    >
  </ToggleGroup.Root>
</div>
