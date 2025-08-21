<script lang="ts">
  import * as openpgp from 'openpgp';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';

  import ImageSquare from 'phosphor-svelte/lib/ImagesSquare';
  import Clock from 'phosphor-svelte/lib/Clock';
  import ImageThumbnail from '$lib/_components/Listener/ImageThumbnail.svelte';

  import { breakString, showMessageFeedback } from '$lib/utils/utils';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';
  import type { IKeyPairs, LoadedPair } from '$lib/types';
  import { browser } from '$app/environment';

  let api_pbKey: string;
  let disableSend = false;

  let keyPairs: IKeyPairs[] | undefined;
  let loadedPair: LoadedPair | null = null;

  let params = $page.params.room;
  let sending = false;
  let message = '';
  let imageBase64: string[] = [];
  let cleartextMessage = '';
  let roomTitle: string;

  // Slow mode variables
  let slowModeEnabled = false;
  let slowModeDelay = 0;
  let lastMessageTime = 0;
  let slowModeTimeLeft = 0;
  let slowModeInterval: any;
  let slowModePollingInterval: any;
  let slowModeStatus = 'Slow mode: disabled';

  // Cookie functions for slow mode persistence
  const getSlowModeCookieKey = () => `slowmode_${params}_${loadedPair?.uniqueString}`;

  const saveLastMessageTime = () => {
    if (browser) {
      const cookieKey = getSlowModeCookieKey();
      document.cookie = `${cookieKey}=${lastMessageTime}; path=/; max-age=86400`; // 24 hours
    }
  };

  const restoreLastMessageTime = () => {
    if (browser) {
      const cookieKey = getSlowModeCookieKey();
      const cookies = document.cookie.split(';');
      const cookie = cookies.find((c) => c.trim().startsWith(`${cookieKey}=`));
      if (cookie) {
        const timestamp = parseInt(cookie.split('=')[1]);
        if (!isNaN(timestamp)) {
          lastMessageTime = timestamp;

          // Calculate remaining time if slow mode is active
          if (slowModeEnabled && slowModeDelay > 0) {
            const now = Date.now();
            const timeSinceLastMessage = (now - lastMessageTime) / 1000;
            if (timeSinceLastMessage < slowModeDelay) {
              slowModeTimeLeft = slowModeDelay - timeSinceLastMessage;
              slowModeInterval = setInterval(updateSlowModeCountdown, 1000);
            }
          }
        }
      }
    }
  };

  // Fetch slow mode settings
  const fetchSlowModeSettings = async () => {
    try {
      const response = await fetch(`/api/slowmode?rid=${params}`);
      const resp = await response.json();

      if (!resp.error) {
        slowModeEnabled = resp.body.slowModeEnabled;
        slowModeDelay = resp.body.slowModeDelay;

        // Restore timer after fetching settings
        restoreLastMessageTime();
      }
    } catch (error) {
      console.error('Error fetching slow mode settings:', error);
    }
  };

  // Check if user can send message based on slow mode
  const canSendMessage = () => {
    if (!slowModeEnabled) return true;

    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;
    return timeSinceLastMessage >= slowModeDelay;
  };

  // Update slow mode countdown
  const updateSlowModeCountdown = () => {
    if (!slowModeEnabled) {
      slowModeTimeLeft = 0;
      if (slowModeInterval) {
        clearInterval(slowModeInterval);
        slowModeInterval = null;
      }
      return;
    }

    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;
    slowModeTimeLeft = Math.max(0, slowModeDelay - timeSinceLastMessage);

    if (slowModeTimeLeft <= 0) {
      slowModeTimeLeft = 0;
      if (slowModeInterval) {
        clearInterval(slowModeInterval);
        slowModeInterval = null;
      }
    }
  };

  // When posting sign the message with the private key and send it to the server
  // Get the private key of myself from localstorage
  const SignMessage = async () => {
    if (!loadedPair) return;
    if (!api_pbKey) {
      console.error('No public key available for recipient');
      showMessageFeedback('error', 'No public key found for recipient', 'feedback_container');
      return;
    }

    // Check slow mode
    if (!canSendMessage()) {
      const timeLeft = Math.ceil(slowModeTimeLeft);
      showMessageFeedback(
        'error',
        `Slow mode active. Wait ${timeLeft}s before sending another message`,
        'feedback_container'
      );
      return;
    }

    sending = true;

    const passphrase = 'super long and hard to guess secret';
    const uniqueString = loadedPair.uniqueString;
    const publicKey = await openpgp.readKey({ armoredKey: api_pbKey });

    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: loadedPair.prKey }),
      passphrase
    });

    let profanityFilterEnabled = false;

    const respn = await fetch('/api/prof', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rid: params
      })
    });

    const re = await respn.json();

    if (re.error) {
      console.log(re.message);
    } else {
      profanityFilterEnabled = re.body.profanityEnabled;
      console.log(re);
    }

    cleartextMessage = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: message }),
      encryptionKeys: publicKey,
      signingKeys: privateKey
    });

    const response = await fetch('/api/pgp', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: cleartextMessage,
        imageData: {
          dataURI: imageBase64,
          blurhash: 'LEHLk~WB2yk8pyo0adR*.7kCMdnj',
          nsfw: false
        },
        r: uniqueString,
        p: params
      })
    });

    const resp = await response.json();

    if (resp.error) {
      console.log(resp.message);
    } else {
      console.log(resp.message);
      message = '';
      imageBase64 = [];
      showMessageFeedback('default', '✨ Message delivered ', 'feedback_container');

      // Update last message time for slow mode
      lastMessageTime = Date.now();
      saveLastMessageTime(); // Save to cookies

      // Start countdown if slow mode is enabled
      if (slowModeEnabled && slowModeDelay > 0) {
        slowModeTimeLeft = slowModeDelay;
        slowModeInterval = setInterval(updateSlowModeCountdown, 1000);
      }
    }
    sending = false;
  };

  // get the public key of the other person from the url
  const fetchKeys = async () => {
    disableSend = true;
    const response = await fetch(`/api/pgp?r=${params}`);
    const data = await response.json();
    api_pbKey = data.body.pbKey;
    disableSend = false;
  };

  // On file change generate the base64 and load preview
  function handleFileInput(event: any) {
    const file = event.target.files[0];

    if (file) {
      // Create a FileReader object to read the selected file
      const reader = new FileReader();

      // limit size to 1.5MB
      if (file.size / (1024 * 1024) > 2) {
        alert('Size limit exceeded: 1.5MB MAX');
        return;
      }

      reader.onload = function (e) {
        let imageBase64Str = (e.target?.result ?? '') as string;
        imageBase64 = breakString(imageBase64Str, 1000);
      };

      // Read the selected file as a data URL
      reader.readAsDataURL(file);
    }
  }

  onMount(async () => {
    keyPairs = await getAllFromLS();
    const loaded = await getLoadedPairFromLS();
    loadedPair = loaded || null;

    const responseTitle = await fetch(
      `/api/titl?rid=${encodeURIComponent(loadedPair?.uniqueString as string)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    const respTitle = await responseTitle.json();
    console.log('resp', respTitle);

    if (respTitle.error) {
      console.log(respTitle.message);
    } else {
      roomTitle = respTitle.body.title.length == 0 ? respTitle.body.rid : respTitle.body.title;
    }

    if (params) {
      await fetchKeys();
      await fetchSlowModeSettings();

      // Poll for slow mode settings every 5 seconds
      slowModePollingInterval = setInterval(fetchSlowModeSettings, 5000);
    }
  });

  let powerUser = false;

  // Show slow mode status before sending
  $: slowModeStatus = slowModeEnabled
    ? `Slow mode: ${slowModeDelay}s delay`
    : 'Slow mode: disabled';

  onDestroy(() => {
    if (slowModeInterval) {
      clearInterval(slowModeInterval);
    }
    if (slowModePollingInterval) {
      clearInterval(slowModePollingInterval);
    }
  });
</script>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start p-2 pt-8"
>
  <div class="flex w-full flex-row bg-light-200 dark:bg-dark-800">
    <h1 class="md:text-md relative w-full p-4 text-left text-sm font-semibold lg:text-xl">
      Send to
      <span class=" rounded-sm bg-light-300 p-1 font-extralight dark:bg-dark-900">
        {params}
        {#if roomTitle}
          ( {roomTitle} )
        {/if}
      </span>
    </h1>
  </div>
  <div class="flex w-full justify-between pt-2">
    <span class="text-left text-sm font-light">{message.length}/1000</span>
    <div class="flex flex-col items-end gap-1">
      <span class="text-gray-600 dark:text-gray-400 text-right text-sm font-light">
        {slowModeStatus}
      </span>
      {#if slowModeEnabled && slowModeTimeLeft > 0}
        <span
          class="text-orange-600 dark:text-orange-400 flex items-center gap-1 text-right text-sm font-light"
        >
          <Clock size={14} weight="duotone" />
          {Math.ceil(slowModeTimeLeft)}s remaining
        </span>
      {/if}
    </div>
  </div>
  <div class="mb-2 w-full">
    <span class="relative mb-2 flex h-full w-full flex-row gap-2 pb-4 pt-2">
      <input
        bind:value={message}
        type="text"
        placeholder="Enter your message here "
        class="border-black
        h-full w-full
        border border-light-400
        bg-light-200 p-8
        placeholder-light-800 dark:border-dark-600 dark:bg-dark-800 dark:placeholder-dark-200"
        maxlength="1000"
        on:keydown={(e) => {
          if (e.key === 'Enter') SignMessage();
        }}
      />

      <button
        class=" border-black border
				border-light-900 p-7 transition-all dark:border-dark-600
				{!message || sending || disableSend || !api_pbKey || (slowModeEnabled && !canSendMessage())
          ? 'cursor-not-allowed'
          : ' hover:bg-light-900 hover:text-light-200 hover:dark:bg-dark-900 hover:dark:text-dark-200'}"
        disabled={!message ||
          sending ||
          disableSend ||
          !api_pbKey ||
          (slowModeEnabled && !canSendMessage())}
        on:click={SignMessage}
      >
        {#if sending}
          Sending
        {:else if slowModeEnabled && !canSendMessage()}
          Wait {Math.ceil(slowModeTimeLeft)}s
        {:else}
          Send
        {/if}
      </button>
    </span>

    <span
      class="border-black text-zinc-400/50 flex h-full w-full flex-row gap-2
      border
				border-light-900
    p-3 dark:border-dark-600"
    >
      {#if imageBase64.length}
        <ImageThumbnail imageBase64={imageBase64.join('')} variant="md" />
      {:else}
        <span class="text-stone-300 dark:bg-red-900 bottom-0 left-2 rounded-sm">
          <label for="image-input" class="cursor-pointer">
            <ImageSquare size="24" weight="duotone" />
          </label>
          <input
            id="image-input"
            type="file"
            class="hidden"
            accept="image/*"
            on:change={handleFileInput}
          />
        </span>
      {/if}
    </span>
  </div>

  <div id="feedback_container" class="flex w-full items-center justify-center"></div>

  <!-- 
  <button
    class="btn btn-sm my-4"
    on:click={() => {
      powerUser = !powerUser;
    }}
  >
    {powerUser ? 'Hide' : 'Show'}
    PGP tools</button
  > -->

  <!-- {#if powerUser && loadedPair}
    <div transition:slide class="flex flex-col gap-4 py-4">
      <div class="border-black bg-base-100 relative border p-2">
        <small class="text-primary absolute -top-3 rounded-sm bg-light-300 px-1 dark:bg-dark-800"
          >{loadedPair.prKey ? 'Signing with Private key :' : ''}
        </small>
        <h1 class=" text-xs blur-sm transition-all duration-1000 hover:blur-none">
          {loadedPair.prKey ?? ''}
        </h1>
      </div>
      <div class="border-black bg-base-100 relative border p-2">
        <small class="text-primary absolute -top-3 rounded-sm bg-light-300 px-1 dark:bg-dark-800"
          >Encrypted Message :
        </small>
        <h1 class=" text-xs">{cleartextMessage ?? ''}</h1>
      </div>
    </div>
  {/if} -->
</div>
