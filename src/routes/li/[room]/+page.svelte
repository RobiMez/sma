<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy, onMount } from 'svelte';

  import colors from '$lib/utils/colors.json';

  import * as openpgp from 'openpgp';
  import Message from '$lib/_components/Message.svelte';

  import PencilSimpleLine from 'phosphor-svelte/lib/PencilSimpleLine';
  import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
  import X from 'phosphor-svelte/lib/X';
  import CopyLink from '$lib/_components/CopyLink.svelte';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';

  let rid = $page.params.room;

  let keyPairs:
    | {
        prKey: string;
        pbKey: string;
        RC: string;
        uniqueString: string;
      }[]
    | undefined;

  let loadedPair: {
    prKey: string;
    pbKey: string;
    RC: string;
    uniqueString: string;
  } | null = null;

  let unlocked = false;
  let unpacking = false;
  let unlockKey = '';
  let profanityFilterEnabled = false;
  let roomTitle = rid;
  let isEditingTitle = false;

  let pollingInterval = 10;
  let intervalId: any;
  let copied = false;

  let encryptedMessages: any[] = [];
  let decryptedMessages: any[] = [];
  let passphrase = 'super long and hard to guess secret';

  async function createShortHash(input: string, length: number): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));

    const base64url = hashString.replace('+', '-').replace('/', '_').replace(/=+$/, '');
    return base64url.substring(0, length);
  }

  const CheckIfUnlockable = async () => {
    if (!loadedPair) return false;
    console.log(' checking unlock ');

    const hash = await createShortHash(loadedPair.prKey + loadedPair.pbKey, 12);
    console.log('hash', hash, loadedPair.uniqueString);
    return hash === rid && loadedPair.uniqueString === rid;
  };

  function generateConsistentIndices(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }

    let index1 = Math.abs(hash % 992);
    let index2 = Math.abs(hash % 5);

    return colors[index1][index2];
  }

  // Define an asynchronous function named 'unpack'
  const unpack = async () => {
    if (!loadedPair) return;
    console.log('Refreshing');
    // Check if 'unlocked' is true
    if (unlocked) {
      // Set 'unpacking' to true
      unpacking = true;
      // Fetch the encrypted messages from the server
      const response = await fetch(`/api/pgp?r=${rid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Parse the JSON response
      const resp = await response.json();

      // If there's an error in the response, log the message
      if (resp.error) {
        console.log(resp.message);
      } else {
        // Otherwise, set 'encryptedMessages' to the messages from the response
        encryptedMessages = resp.body.messages;
        if (!encryptedMessages) {
          console.log('No messages');
          encryptedMessages = [];
          return;
        }
        encryptedMessages.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Loop over each encrypted message
        for (const encryptedMessage of encryptedMessages) {
          // Read the encrypted message
          const readMsg = await openpgp.readMessage({
            armoredMessage: encryptedMessage.message
          });

          // Decrypt the private key
          const privateKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: loadedPair?.prKey }),
            passphrase
          });

          // Decrypt the message with the private key
          const { data: decrypted } = await openpgp.decrypt({
            message: readMsg,
            decryptionKeys: privateKey
          });

          // Create an object with the decrypted message and its 'r' property
          const msgObj = {
            id: encryptedMessage._id,
            msg: String(decrypted),
            image: {
              id: encryptedMessage.image?._id,
              blurhash: encryptedMessage.image?.blurhash,
              nsfw: encryptedMessage.image?.nsfw
            },
            r: encryptedMessage.author,
            timestamp: encryptedMessage.timestamp
          };

          // If 'decryptedMessages' doesn't already contain this message, add it
          if (
            !decryptedMessages.some(
              (obj) =>
                obj.msg === msgObj.msg && obj.r === msgObj.r && obj.timestamp === msgObj.timestamp
            )
          ) {
            decryptedMessages.push(msgObj);
          }
        }
        // Update 'decryptedMessages' to trigger reactivity in Svelte
        decryptedMessages = decryptedMessages;
      }
      // Set 'unpacking' to false
      unpacking = false;
    } else {
      console.log('not unlocked yet');
    }
  };

  async function copyLink() {
    await navigator.clipboard.writeText($page.url.origin + '/b/' + rid);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  const toggleEditTitle = () => {
    isEditingTitle = !isEditingTitle;
  };

  async function updateRoomTitle() {
    const responseUpdateTitle = await fetch('/api/titl', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pbKey: loadedPair?.pbKey,
        title: roomTitle
      })
    });

    const respUpdateTitle = await responseUpdateTitle.json();

    if (respUpdateTitle.error) {
      console.log(respUpdateTitle.message);
    } else {
      roomTitle = respUpdateTitle.body.title;
    }
  }

  async function fetchRoomTitle() {
    const responseTitle = await fetch(`/api/titl?rid=${rid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const respTitle = await responseTitle.json();
    console.log('resp', respTitle);

    if (respTitle.error) {
      console.log(respTitle.message);
    } else {
      roomTitle = respTitle.body.title.length == 0 ? respTitle.body.rid : respTitle.body.title;
    }
  }

  const updateProf = async (e: any) => {
    if (!loadedPair) return;
    const response = await fetch('/api/prof', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pbKey: loadedPair.pbKey,
        profanityEnabled: e.target.checked ?? false
      })
    });

    const resp = await response.json();

    if (resp.error) {
      console.log(resp.message);
    } else {
      profanityFilterEnabled = resp.body.profanityEnabled;
      console.log(resp.body.profanityEnabled);
    }
  };

  $: unlocked = unlockKey === 'unlock';
  // if the pgp hash of the values in the localstorage are equal to the hash in the url , then unlock the page

  $: {
    if (pollingInterval > 3 && unlocked) {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(unpack, pollingInterval * 1000);
    }
  }
  const pollForMessages = () => {
    if (!unlocked) return;
    if (pollingInterval < 3) pollingInterval = 3;
    try {
      intervalId = setInterval(() => {
        unpack();
      }, pollingInterval * 10);
    } catch (error) {
      console.log('Error in polling for messages', error);
    }
  };

  onMount(async () => {
    // These make sure that the creds are set internally
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
    // Check if the user has a PGP identity
    if (rid) {
      unlocked = await CheckIfUnlockable();
    }
    if (unlocked) {
      unpack();
    }

    pollForMessages();

    // if none set , default to false
    profanityFilterEnabled = false;

    await fetchRoomTitle();

    const response = await fetch('/api/prof', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rid: rid })
    });

    const resp = await response.json();

    if (resp.error) {
      console.log(resp.message);
    } else {
      console.log(resp);
      profanityFilterEnabled = resp.body.profanityEnabled;
    }
  });
  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start p-1 pt-12"
>
  <div class="flex w-full flex-row gap-2 p-1 pb-1">
    <h1
      class="
			border-black relative flex w-full flex-row items-center justify-start
		gap-2 border p-1 text-left text-base font-semibold md:p-2 md:text-xl
		lg:p-4 lg:text-2xl dark:border-dark-400"
    >
      Room
      {#if isEditingTitle}
        <input
          bind:value={roomTitle}
          type="text"
          minlength="1"
          maxlength="24"
          on:keydown={(e) => {
            if (e.key === 'Enter') {
              if (roomTitle.length <= 0) return;
              updateRoomTitle();
              toggleEditTitle();
            }
          }}
          class="  text-base-content focus:bg-base-100 min-h-8 rounded-sm border-none p-1 font-extralight focus:outline-none"
          size={roomTitle.length > 5 ? roomTitle.length : 5}
          style={`font-size: ${Math.ceil(roomTitle.length / 50)}em`}
        />
        <button
          on:click={() => {
            if (roomTitle.length <= 0) return;
            updateRoomTitle();
            toggleEditTitle();
          }}
          class="btn btn-square btn-sm"
        >
          <FloppyDisk size="24" weight="duotone" />
        </button>
        <button
          on:click={() => {
            toggleEditTitle();
          }}
          class="btn btn-square btn-sm"
        >
          <X size="24" weight="duotone" />
        </button>
      {:else}
        <span
          class="  text-base-content pointer-events-none rounded-sm border-none p-1 font-extralight"
        >
          {roomTitle}
        </span>
        <button on:click={toggleEditTitle} class="btn btn-sm my-4">
          <PencilSimpleLine size="24" weight="duotone" />
        </button>
      {/if}
      {#if unlocked}
        <span
          class=" absolute -top-1 left-1 rounded-sm
					bg-light-900 px-2 py-1 text-xs font-light text-dark-100 dark:bg-dark-800 dark:text-light-100"
          >Your
        </span>
      {/if}
      {#if unpacking}
        <span
          class="absolute -bottom-3 left-1 rounded-sm
					bg-light-200 p-1 px-2
					text-xs font-normal dark:bg-dark-900 dark:text-dark-200"
          >Loading ...
        </span>
      {/if}
      <span
        class="
			absolute -bottom-2 right-1
			rounded-sm bg-light-200 p-1 px-2 text-xs font-normal text-light-900 dark:bg-dark-800 dark:text-dark-200"
      >
        Fetch every

        <input
          bind:value={pollingInterval}
          class=" input-outline w-8 appearance-none bg-dark-content dark:bg-light-content"
          type="number"
          min="3"
          max="99"
        />
        s
      </span>
    </h1>
    <CopyLink on:click={copyLink} {copied} />
  </div>

  <div class="flex flex-row items-center justify-center">
    <span class="p-2 text-sm">{profanityFilterEnabled ? 'Unblock' : 'Block'} Profanity :</span>
    <input
      type="checkbox"
      class="toggle toggle-sm"
      on:change={(e) => updateProf(e)}
      checked={profanityFilterEnabled}
    />
  </div>

  <div class="flex w-full flex-col gap-3 p-4">
    {#if unlocked}
      {#each [...decryptedMessages].reverse() as msg (msg)}
        {@const color = generateConsistentIndices(msg.r)}
        <Message {msg} {color} />
      {/each}

      {#if !decryptedMessages.length}
        <span class="p-12"> No messages sent to your inbox yet </span>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Hide the up and down arrows in a number input field */
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  /* Firefox */
  input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
