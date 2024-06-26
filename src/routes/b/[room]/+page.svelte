<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import * as openpgp from 'openpgp';
  import { slide } from 'svelte/transition';
  import checkProfanity from '$lib/profanityFilter';
  import { ImageSquare } from 'phosphor-svelte';
  import ImageThumbnail from '$lib/_components/ImageThumbnail.svelte';
  import { breakString, showMessageFeedback } from '$lib/utils/utils';

  let prKey: string;
  let pbKey: string;
  let api_pbKey: string;
  let RC: string;
  let uniqueString: string;

  async function createShortHash(input: string, length: number): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));

    const base64url = hashString.replace('+', '-').replace('/', '_').replace(/=+$/, '');
    return base64url.substring(0, length);
  }

  const GetPgpIdentity = async () => {
    console.log('Getting Pgp Identity from localStorage');
    prKey = localStorage.getItem('prKey')!;
    pbKey = localStorage.getItem('pbKey')!;
    RC = localStorage.getItem('RC')!;
    uniqueString = localStorage.getItem('uniqueString')!;

    return { prKey, pbKey, RC, uniqueString };
  };

  let params = $page.params.room;
  let disableSend = false;
  let message = '';
  let imageBase64: string[] = [];
  let cleartextMessage = '';

  $: disableSend = !message;

  // When posting sign the message with the private key and send it to the server

  // get the private key of myself from localstorage
  const SignMessage = async () => {
    disableSend = true;
    prKey = localStorage.getItem('prKey')!;

    const passphrase = 'super long and hard to guess secret';
    const uniqueString = localStorage.getItem('uniqueString')!;
    const publicKey = await openpgp.readKey({ armoredKey: api_pbKey });

    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: prKey }),
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

    if (profanityFilterEnabled) {
      const profanityCheck = await checkProfanity(message);
      if (profanityCheck.isProfanity) {
        message = '';
        showMessageFeedback(
          'error',
          "⚠️ Message has not been sent because the room host doesn't allow profanity.",
          'feedback_container'
        );
        return;
      }
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
    }
    disableSend = false;
  };

  // get the public key of the other person from the url
  const fetchKeys = async () => {
    disableSend = true;
    prKey = localStorage.getItem('prKey')!;
    const response = await fetch(`/api/pgp?r=${params}`);
    const data = await response.json();
    api_pbKey = data.body.pbKey;
    console.log('Fetch done,', api_pbKey);
    disableSend = false;
  };

  // On click , ill generate the required hashes and links and redir the user to that page
  const ResetPgpIdentity = () => {
    (async () => {
      const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
        type: 'ecc',
        curve: 'curve25519',
        userIDs: [{ name: 'Anon', email: 'Sma@robi.work' }],
        passphrase: 'super long and hard to guess secret',
        format: 'armored'
      });
      prKey = privateKey;
      pbKey = publicKey;
      RC = revocationCertificate;

      uniqueString = await createShortHash(privateKey + publicKey, 12);

      localStorage.setItem('prKey', prKey);
      localStorage.setItem('pbKey', pbKey);
      localStorage.setItem('RC', RC);
      localStorage.setItem('uniqueString', uniqueString);

      const response = await fetch('/api/pgp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pbKey,
          rid: uniqueString
        })
      });

      const resp = await response.json();

      if (resp.error) {
        console.log(resp.message);
      } else {
        console.log(resp.message);
      }

      // Create a unique string based on the keys
    })();
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
    if (params) {
      console.log('Fetching public key');
      await fetchKeys();
    }
    // Check if the user has a PGP identity
    if (!prKey || !pbKey || !RC || !uniqueString) {
      ({ prKey, pbKey, RC, uniqueString } = await GetPgpIdentity());
    }
    if (!prKey || !pbKey || !RC || !uniqueString) {
      console.log('No Pgp Identity found , creating one now');
      ResetPgpIdentity();
    }
  });

  let powerUser = false;
</script>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start p-2 pt-8"
>
  <div class="flex w-full flex-row">
    <h1
      class=" relative w-full bg-base-200 p-4 text-left text-xl font-semibold text-primary transition-all md:text-2xl lg:text-4xl"
    >
      Send to <span class="rounded-sm bg-base-300 p-1 font-extralight text-primary">
        {params}
      </span>
    </h1>
  </div>
  <span class="w-full pt-2 text-left text-sm font-light">{message.length}/1000</span>
  <div class="mb-2 w-full">
    <span class="relative mb-2 flex h-full w-full flex-row gap-2 pb-4 pt-2">
      <input
        bind:value={message}
        type="text"
        placeholder="Enter your message here "
        class="h-full w-full border border-black bg-base-200/40 p-8 placeholder-base-content/70"
        maxlength="1000"
        on:keydown={(e) => {
          if (e.key === 'Enter') SignMessage();
        }}
      />

      <span class="absolute bottom-0 left-3 rounded-sm bg-zinc-800">
        <label for="image-input" class="cursor-pointer">
          <ImageSquare size="34" weight="duotone" />
        </label>
        <input
          id="image-input"
          type="file"
          class="hidden"
          accept="image/*"
          on:change={handleFileInput}
        />
      </span>

      <button
        class=" border border-black p-7 text-primary
				transition-all
				{!disableSend ? 'hover:bg-primary hover:text-primary-content' : ' hover:bg-base-200 '}"
        disabled={disableSend}
        on:click={SignMessage}
      >
        Send
      </button>
    </span>

    <span class="flex h-full w-full flex-row gap-2 border border-black p-3 text-zinc-400/50">
      {#if imageBase64.length}
        <!-- <img src={imageBase64} alt="Image to send..." /> -->
        <ImageThumbnail imageBase64={imageBase64.join('')} variant="md" />
      {:else}
        <p>No images</p>
      {/if}
    </span>
  </div>

  <div id="feedback_container" class="flex w-full items-center justify-center"></div>

  <button
    class="btn btn-sm my-4"
    on:click={() => {
      powerUser = !powerUser;
    }}
  >
    {powerUser ? 'Hide' : 'Show'}
    PGP tools</button
  >

  {#if powerUser}
    <div transition:slide class="flex flex-col gap-4 py-4">
      <div class="relative border border-black bg-base-100 p-2">
        <small class="absolute -top-3 rounded-sm bg-primary-content px-1 text-primary"
          >{prKey ? 'Signing with Private key :' : ''}
        </small>
        <h1 class=" text-xs blur-sm transition-all duration-1000 hover:blur-none">{prKey ?? ''}</h1>
      </div>
      <div class="relative border border-black bg-base-100 p-2">
        <small class="absolute -top-3 rounded-sm bg-primary-content px-1 text-primary"
          >Encrypted Message :
        </small>
        <h1 class=" text-xs">{cleartextMessage ?? ''}</h1>
      </div>
    </div>
  {/if}
</div>
