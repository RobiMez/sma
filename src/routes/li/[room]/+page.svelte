<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import * as openpgp from 'openpgp';
  import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';

  import Message from './Message/Message.svelte';

  import type { IKeyPairs } from '$lib/types';

  import { page } from '$app/state';

  import ListenerHeader from './ListenerHeader.svelte';
  import { FolderDashed } from 'phosphor-svelte';

  let rid = page.params.room;
  let { data } = $props();

  let keyPairs: IKeyPairs[] | undefined = undefined;
  let loadedPair: IKeyPairs | undefined = $state(undefined);

  let unlocked = $state(false);
  let unpacking = $state(false);
  let roomTitle = $state(rid);

  let pollingInterval = $state(10);
  let timeoutId: NodeJS.Timeout | undefined = $state();

  let encryptedMessages: any[] = [];
  let decryptedMessages: any[] = $state([]);
  let passphrase = PUBLIC_PGP_PASSPHRASE;

  // Cache author rid -> armored public key so we don't refetch on every poll.
  const authorKeyCache = new Map<string, string | null>();

  const fetchAuthorPublicKey = async (authorRid: string): Promise<string | null> => {
    if (!authorRid) return null;
    if (authorKeyCache.has(authorRid)) return authorKeyCache.get(authorRid) ?? null;
    try {
      const res = await fetch(`/api/pgp?r=${encodeURIComponent(authorRid)}&lim=0`);
      const json = await res.json();
      const pbKey = json?.body?.pbKey ?? null;
      authorKeyCache.set(authorRid, pbKey);
      return pbKey;
    } catch (e) {
      console.error('Failed to fetch author public key', authorRid, e);
      authorKeyCache.set(authorRid, null);
      return null;
    }
  };

  let previousMessageCount = 0;
  let playSound = $state(false);

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

      console.log(resp);
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
            // Look up the claimed author's public key so we can verify the
            // PGP signature. The `author` field on the server is attacker-
            // controlled; the signature is what actually proves identity.
            const claimedAuthorRid = encryptedMessage.author;
            const authorPbKeyArmored = await fetchAuthorPublicKey(claimedAuthorRid);
            if (!authorPbKeyArmored) {
              console.warn(
                'Skipping message: no public key on record for claimed author',
                claimedAuthorRid
              );
              continue;
            }
            const authorPublicKey = await openpgp.readKey({ armoredKey: authorPbKeyArmored });

            // Decrypt and verify in one pass. If `signatures` ends up empty or
            // `verified` rejects, the message was unsigned or signed by a key
            // that doesn't match the claimed author — treat both as a spoof.
            const { data: decrypted, signatures } = await openpgp.decrypt({
              message: readMsg,
              decryptionKeys: privateKey,
              verificationKeys: authorPublicKey,
              config: { allowInsecureDecryptionWithSigningKeys: true }
            });

            if (!signatures || signatures.length === 0) {
              console.warn('Skipping unsigned message from claimed author', claimedAuthorRid);
              continue;
            }
            try {
              await signatures[0].verified;
            } catch (verifyError) {
              console.warn(
                'Skipping message: signature does not match claimed author',
                claimedAuthorRid,
                verifyError
              );
              continue;
            }

            // Create an object with the decrypted message and its 'r' property
            const msgObj = {
              id: encryptedMessage._id,
              msg: String(decrypted),
              image: {
                id: encryptedMessage.image?._id,
                blurhash: encryptedMessage.image?.blurhash,
                nsfw: encryptedMessage.image?.nsfw
              },
              r: claimedAuthorRid,
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

  const recursiveFetch = () => {
    unpack();
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(recursiveFetch, pollingInterval * 1000);
  };

  // if the pgp hash of the values in the localstorage are equal to the hash in the url , then unlock the page

  onMount(async () => {
    // These make sure that the creds are set internally
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
    // Check if the user has a PGP identity
    if (rid) unlocked = await CheckIfUnlockable();
    console.log('ONMOUNT : ', unlocked);

    if (unlocked) recursiveFetch();
  });

  onDestroy(() => {
    if (timeoutId) clearInterval(timeoutId);
  });
</script>

<audio preload="auto" src="/notify.wav" style="display: none;"></audio>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl grow flex-col items-center justify-start p-1 pt-12"
>
  {#if roomTitle && loadedPair && rid}
    <div class="flex w-full flex-row gap-2 p-1 pb-1">
      <ListenerHeader
        {unpack}
        {loadedPair}
        bind:playSound
        bind:unpacking
        bind:pollingInterval
        isProfanityEnabled={data.profanityFilterEnabled}
      />
    </div>

    <div class="flex w-full flex-col  p-4 pt-8">
      {#if unlocked}
        {#each [...decryptedMessages].reverse() as msg (msg)}
          <Message {msg} />
        {/each}

        {#if !decryptedMessages.length}
          <span
            class="border-primary bg-secondary/5 flex flex-col items-center justify-center gap-4 border border-dashed p-12"
          >
            <FolderDashed class="size-18 md:size-32 " weight="duotone" />
            <h3 class="text-md font-light md:text-xl">No messages sent to your inbox yet</h3>
            <span class="text-primary/60 text-sm">
              Copy and share your link to get new messages !
            </span>
          </span>
        {/if}
      {/if}
    </div>
  {/if}
</div>
