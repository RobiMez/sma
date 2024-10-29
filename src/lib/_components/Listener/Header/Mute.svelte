<script lang="ts">
  import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
  import SpeakerSlash from 'phosphor-svelte/lib/SpeakerSlash';

  import { onDestroy, onMount } from 'svelte';

  export let soundEnabled = false;
  export let playSound = false;

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
  $: if (playSound) {
    playNotificationSound();
    setTimeout(() => {
      playSound = false;
    }, 1000);
  }

  $: if (soundEnabled) {
    initializeSound();
    playNotificationSound();
  }

  onMount(async () => {});

  onDestroy(() => {
    if (notifySound) {
      notifySound.pause();
      notifySound.currentTime = 0;
    }
  });
</script>

<button
  on:click={toggleSound}
  class="py-auto min-w-18 max-w-18 flex aspect-square w-full flex-row items-center justify-center overflow-clip rounded-sm bg-light-200 p-1 dark:bg-dark-900 dark:text-dark-200"
>
  <span class="flex flex-col items-center justify-center gap-1">
    <span>
      {#if soundEnabled}
        <SpeakerHigh size={20} weight="duotone" />
      {:else}
        <SpeakerSlash size={20} weight="duotone" />
      {/if}
    </span>
    <span class="bottom-1 whitespace-nowrap text-xs md:text-sm lg:flex">
      {soundEnabled ? 'Mute' : 'Unmute'}
    </span>
  </span>
</button>
