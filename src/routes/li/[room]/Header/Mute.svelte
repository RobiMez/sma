<script lang="ts">
  import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
  import SpeakerSlash from 'phosphor-svelte/lib/SpeakerSlash';

  import { onDestroy } from 'svelte';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    playSound?: boolean;
  }

  let { playSound = $bindable(false) }: Props = $props();

  let soundEnabled = $state(false);
  let notifySound: HTMLAudioElement;

  const toggleSound = () => {
    soundEnabled = !soundEnabled;
  };

  const initializeSound = () => {
    if (!notifySound) {
      notifySound = new Audio('/notify.wav');
    }
    // Test play (will be silent) to handle the permission
    notifySound.volume = 0;
    notifySound
      .play()
      .then(() => {
        if (playSound) {
          notifySound.volume = 1;
        }
      })
      .catch(console.error);
  };
  const playNotificationSound = () => {
    if (notifySound) {
      notifySound.volume = 1;
      notifySound.play();
    }
  };

  // set playSound to false after playing sound
  $effect(() => {
    if (playSound) {
      playNotificationSound();
      setTimeout(() => {
        playSound = false;
      }, 1000);
    }
  });

  $effect(() => {
    if (soundEnabled) {
      initializeSound();
      playNotificationSound();
    }
  });

  onDestroy(() => {
    if (notifySound) {
      notifySound.pause();
      notifySound.currentTime = 0;
    }
  });
</script>

<Button onclick={toggleSound} variant="ghost" class="border-border h-full rounded-none border-l p-0">
  <span class="flex h-full w-full flex-col items-center justify-center gap-0.5 px-5 py-2">
    <span>
      {#if soundEnabled}
        <SpeakerHigh size={20} weight="duotone" />
      {:else}
        <SpeakerSlash size={20} weight="duotone" />
      {/if}
    </span>
    <span class="flex text-xs whitespace-nowrap md:text-sm">
      {soundEnabled ? 'Mute' : 'Unmute'}
    </span>
  </span>
</Button>
