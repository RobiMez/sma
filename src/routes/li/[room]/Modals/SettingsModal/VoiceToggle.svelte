<script lang="ts">
  import { Microphone, MicrophoneSlash } from 'phosphor-svelte';

  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import { signedFetch } from '$lib/utils/signedRequest';

  interface Props {
    rid: string;
    voiceEnabled: boolean;
  }

  let { rid, voiceEnabled = $bindable() }: Props = $props();

  const updateVoice = async (newVal: boolean) => {
    if (!rid) return;
    try {
      const resp = await signedFetch('/api/voice', 'PATCH', rid, 'voice:set', {
        voiceEnabled: newVal ?? false
      });

      if (resp.status !== 200) {
        console.error('Failed to update voice setting:', resp.body);
      } else {
        voiceEnabled = resp.body.voiceEnabled;
      }
    } catch (e) {
      console.error('Failed to update voice messages setting', e);
    }
  };
</script>

<hr />
<h3 class="text-sm">Voice messages</h3>
<div class="flex items-center justify-start gap-2">
  <ToggleGroup.Root
    type="single"
    value={voiceEnabled ? 'on' : 'off'}
    onValueChange={(value) => {
      updateVoice(value == 'on' ? true : false);
    }}
  >
    <ToggleGroup.Item
      value="off"
      class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      ><MicrophoneSlash size={24} weight="duotone" color="currentColor" />
      <p>Voice off</p></ToggleGroup.Item
    >
    <ToggleGroup.Item
      value="on"
      class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      ><Microphone size={24} weight="duotone" color="currentColor" />
      <p>Voice on</p></ToggleGroup.Item
    >
  </ToggleGroup.Root>
</div>
