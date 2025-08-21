<script lang="ts">
  import { run } from 'svelte/legacy';

  import { onDestroy, onMount } from 'svelte';

  import * as openpgp from 'openpgp';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';

  import Title from '$lib/_components/Listener/Header/Title.svelte';
  import Message from '$lib/_components/Listener/Message.svelte';
  import CopyLink from '$lib/_components/Listener/Header/CopyLink.svelte';
  import ProfanityToggle from '$lib/_components/Listener/ProfanityToggle.svelte';
  import PollingDurationSelector from '$lib/_components/Listener/PollingDurationSelector.svelte';

  import type { IKeyPairs, LoadedPair } from '$lib/types';

  import WebhookModal from '$lib/_components/Listener/Header/WebhookModal.svelte';
  import { page } from '$app/stores';
  import Mute from '$lib/_components/Listener/Header/Mute.svelte';

  let rid = $page.params.room;

  let keyPairs: IKeyPairs[] | undefined = undefined;
  let loadedPair: LoadedPair | undefined = $state(undefined);

  let unlocked = $state(false);
  let unpacking = $state(false);
  let unlockKey = '';
  let roomTitle = $state(rid);

  let pollingInterval = $state(10);
  let intervalId: any = $state();

  let encryptedMessages: any[] = [];
  let decryptedMessages: any[] = $state([]);
  let passphrase = 'super long and hard to guess secret';

  let previousMessageCount = 0;
  let playSound = $state(false);
  let soundEnabled = $state(false);

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

          try {
            // Decrypt the message with the private key
            const { data: decrypted } = await openpgp.decrypt({
              message: readMsg,
              decryptionKeys: privateKey,
              config: { allowInsecureDecryptionWithSigningKeys: true }
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
          } catch (error) {
            console.error('Error decrypting message', error);
          }
        }
        // Update 'decryptedMessages' to trigger reactivity in Svelte
        decryptedMessages = decryptedMessages;

        // After processing messages, check if there are new ones
        if (decryptedMessages.length > previousMessageCount) {
          playSound = true;
          previousMessageCount = decryptedMessages.length;
        }
      }
      // Set 'unpacking' to false
      unpacking = false;
    } else {
      console.log('not unlocked yet');
    }
  };

  run(() => {
    unlocked = unlockKey === 'unlock';
  });
  // if the pgp hash of the values in the localstorage are equal to the hash in the url , then unlock the page

  run(() => {
    if (pollingInterval > 3 && unlocked) {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(unpack, pollingInterval * 1000);
    }
  });

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
    console.log('loadedPair', loadedPair);
    // Check if the user has a PGP identity
    if (rid) {
      unlocked = await CheckIfUnlockable();
    }
    if (unlocked) unpack();
    pollForMessages();
  });
  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

<audio preload="auto" src="/notify.wav" style="display: none;"></audio>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start p-1 pt-12"
>
  <div class="flex w-full flex-row gap-2 p-1 pb-1">
    <Title bind:roomTitle {unlocked} {unpacking} {rid} {loadedPair}>
      <PollingDurationSelector bind:pollingInterval onIntervalChange={unpack} />
    </Title>
    <CopyLink />
    <span class="flex flex-col gap-2">
      <WebhookModal {loadedPair} />
      <Mute bind:soundEnabled bind:playSound />
    </span>
  </div>

  <ProfanityToggle pbKey={loadedPair?.pbKey} {rid} />

  <div class="flex w-full flex-col gap-3 p-4">
    {#if unlocked}
      {#each [...decryptedMessages].reverse() as msg (msg)}
        <Message {msg} />
      {/each}

      {#if !decryptedMessages.length}
        <span class="p-12"> No messages sent to your inbox yet </span>
      {/if}
    {/if}
  </div>
</div>
