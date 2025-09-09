<script lang="ts">
  import * as openpgp from 'openpgp';
  import { fly } from 'svelte/transition';
  import type { IKeyPairs } from '$lib/types';

  import { page } from '$app/state';
  import { onMount } from 'svelte';

  import ImageSquare from 'phosphor-svelte/lib/ImagesSquare';
  import ImageThumbnail from '../../li/[room]/Message/ImageThumbnail.svelte';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';

  import { breakString } from '$lib/utils/utils';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';
  import { X } from 'phosphor-svelte';
  import { Button } from '$lib/components/ui/button';

  let api_pbKey: string;
  let disableSend = false;

  interface IVectorResponse {
    flaggedFor?: string;
    isProfanity: boolean;
    score: number;
  }

  let keyPairs: IKeyPairs[] | undefined;
  let loadedPair: IKeyPairs | null = null;

  let params = page.params.room;

  let sending = $state(false);
  let checkingProfanity = $state(false);

  let message = $state('');
  let roomTitle = $state('');
  let imageBase64: string[] = $state([]);
  let profanityCheckResponse: IVectorResponse | undefined = $state();
  let profaneBlock = $state(false);

  const checkProfanity = async (message: string) => {
    checkingProfanity = true;
    const res = await fetch('https://vector.profanity.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    profanityCheckResponse = (await res.json()) as IVectorResponse;
    checkingProfanity = false;
    return profanityCheckResponse.isProfanity;
    // {"isProfanity":true,"score":0.99999964,"flaggedFor":"Fuck"}
  };

  // When posting sign the message with the private key and send it to the server
  // Get the private key of myself from localstorage
  const signMessage = async () => {
    if (!loadedPair) return;
    sending = true;

    const passphrase = 'super long and hard to guess secret';
    const uniqueString = loadedPair.uniqueString;
    const publicKey = await openpgp.readKey({ armoredKey: api_pbKey });

    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: loadedPair.prKey }),
      passphrase
    });

    let profanityAllowed = false;

    const respn = await fetch('/api/profanity', {
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
      console.error(re.message);
    } else {
      profanityAllowed = re.body.profanityEnabled;
      console.log(re);
    }
    let profane = false;

    if (!profanityAllowed) {
      profane = await checkProfanity(message);
    }
    if (profane) {
      profaneBlock = true;
      message = '';
      setTimeout(() => {
        profaneBlock = false;
      }, 2000);
      return;
    }

    let cleartextMessage = await openpgp.encrypt({
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
    loadedPair = (await getLoadedPairFromLS()) ?? null;

    const responseTitle = await fetch(
      `/api/title?rid=${encodeURIComponent(loadedPair?.uniqueString as string)}`,
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
    }
  });
</script>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl grow flex-col items-center justify-start p-2 pt-8"
>
  <div class="bg-background border-primary flex w-full flex-row border">
    <div
      class="md:text-md relative flex w-full items-center justify-baseline p-4 text-left text-sm font-semibold lg:text-xl"
    >
      Send to
      <span class=" flex items-baseline justify-center gap-2 rounded-xs p-1 font-light">
        {#if roomTitle}
          <h2 class="text-md md:text-xl">
            [ {roomTitle} ]
          </h2>
          <span class="text-sm">
            {params}
          </span>
        {:else}
          {params}
        {/if}
      </span>
    </div>
  </div>
  <span class="w-full pt-2 text-left text-sm font-light">{message.length}/1000</span>
  <div class="mb-2 w-full">
    <span class="relative mb-2 flex h-full w-full flex-row items-end gap-2 pt-2 pb-4">
      <Textarea
        bind:value={message}
        placeholder="Enter your message here, then press send. "
        class="placeholder:text-md h-full
        w-full border border-black p-8"
        maxlength={1000}
        onkeydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            signMessage();
          }
        }}
      />

      <button
        class=" border-light-900 dark:border-dark-600
				relative h-fit border border-black p-7 transition-all
				{!message || sending ? 'cursor-not-allowed' : ' bg-primary text-primary-foreground'}"
        disabled={!message || sending || checkingProfanity}
        onclick={signMessage}
      >
        {#if checkingProfanity}
          <span
            in:fly={{ y: 4 }}
            out:fly={{ y: -4 }}
            class="bg-primary text-primary-foreground absolute -top-6 left-0 w-full"
          >
            Checking
          </span>
        {/if}
        {#if profaneBlock}
          <span
            in:fly={{ y: 4 }}
            out:fly={{ y: -4 }}
            class="bg-destructive/10 text-destructive absolute -top-6 left-0 w-full"
          >
            🤬 Profanity
          </span>
        {/if}

        {sending ? 'Sending' : 'Send'}
      </button>
    </span>

    <span class=" flex h-full w-full flex-row gap-2 border border-black p-3">
      {#if imageBase64.length}
        <ImageThumbnail imageBase64={imageBase64.join('')} variant="md" />
        <Button
          onclick={() => {
            imageBase64 = [];
          }}
        >
          <X /> <span> Clear image </span>
        </Button>
      {:else}
        <span
          class="bg-secondary/60 border-primary/30 hover:bg-secondary/80 text-secondary-foreground bottom-0 left-2 rounded-xs border p-2 transition-all"
        >
          <label for="image-input" class="flex cursor-pointer items-center gap-2">
            <ImageSquare size="24" weight="duotone" />
            <span class="text-sm">Add image </span>
          </label>
          <input
            id="image-input"
            type="file"
            class="hidden"
            accept="image/*"
            onchange={handleFileInput}
          />
        </span>
      {/if}
    </span>
  </div>
</div>
