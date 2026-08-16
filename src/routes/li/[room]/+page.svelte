<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import * as openpgp from 'openpgp';
  import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';
  import { apiUrl, wsUrl } from '$lib/api';

  import Message from './Message/Message.svelte';

  import type { IKeyPairs } from '$lib/types';

  import { page } from '$app/state';

  import ListenerHeader from './ListenerHeader.svelte';
  import { FolderDashed } from 'phosphor-svelte';

  let rid = page.params.room ?? '';
  let { data } = $props();

  let keyPairs: IKeyPairs[] | undefined = undefined;
  let loadedPair: IKeyPairs | undefined = $state(undefined);

  let unlocked = $state(false);
  let unpacking = $state(false);
  let roomTitle = $state(rid);

  let pollingInterval = $state(10);
  let timeoutId: NodeJS.Timeout | undefined = $state();

  let decryptedMessages: any[] = $state([]);
  let passphrase = PUBLIC_PGP_PASSPHRASE;

  // Decrypting the private key runs the passphrase KDF, which is deliberately
  // slow — do it once and reuse it for every message and every poll.
  let cachedPrivateKey: openpgp.PrivateKey | null = null;
  const getPrivateKey = async () => {
    if (!cachedPrivateKey && loadedPair) {
      cachedPrivateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: loadedPair.prKey }),
        passphrase
      });
    }
    return cachedPrivateKey;
  };

  // Messages are immutable, so each one only needs to be decrypted and
  // verified once, ever. Keyed by server _id. Spoofed/undecryptable ids are
  // remembered too so they aren't re-attempted every poll.
  const decryptedById = new Map<string, any>();
  const skippedIds = new Set<string>();
  // Newest timestamp processed so far — polls ask the server only for newer.
  let newestSeen: string | null = null;

  // Cache author rid -> armored public key so we don't refetch on every poll.
  const authorKeyCache = new Map<string, string | null>();

  const fetchAuthorPublicKey = async (authorRid: string): Promise<string | null> => {
    if (!authorRid) return null;
    if (authorKeyCache.has(authorRid)) return authorKeyCache.get(authorRid) ?? null;
    try {
      const res = await fetch(apiUrl(`/api/pgp?r=${encodeURIComponent(authorRid)}&lim=0`));
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

  // Voice messages are decrypted lazily (see VoiceMessage.svelte), only once
  // the recipient taps play, not during every poll like text — so this is
  // exposed as a callback rather than folded into `unpack()`. It reuses the
  // same cached private key and author-key cache text decryption uses, and
  // applies the identical "no signature / wrong signer = spoof" rule.
  const decryptAudio = async (
    armoredCiphertext: string,
    claimedAuthorRid: string
  ): Promise<Uint8Array | null> => {
    try {
      const privateKey = await getPrivateKey();
      if (!privateKey) return null;

      const authorPbKeyArmored = await fetchAuthorPublicKey(claimedAuthorRid);
      if (!authorPbKeyArmored) return null;
      const authorPublicKey = await openpgp.readKey({ armoredKey: authorPbKeyArmored });

      const readMsg = await openpgp.readMessage({ armoredMessage: armoredCiphertext });
      const { data: decrypted, signatures } = await openpgp.decrypt({
        message: readMsg,
        decryptionKeys: privateKey,
        verificationKeys: authorPublicKey,
        format: 'binary',
        config: { allowInsecureDecryptionWithSigningKeys: true }
      });

      if (!signatures || signatures.length === 0) return null;
      try {
        await signatures[0].verified;
      } catch {
        return null;
      }

      return decrypted as Uint8Array;
    } catch (e) {
      console.error('Failed to decrypt/verify voice message', e);
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

  // Fetch new messages and decrypt only the ones we haven't processed yet.
  const unpack = async () => {
    if (!loadedPair) return;
    if (!unlocked) {
      console.log('not unlocked yet');
      return;
    }
    console.log('Refreshing');
    unpacking = true;
    try {
      const since = newestSeen ? `&since=${encodeURIComponent(newestSeen)}` : '';
      const response = await fetch(apiUrl(`/api/pgp?r=${rid}${since}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const resp = await response.json();

      // Every response here is `{ status, body }`, never `{ error, message }`.
      if (resp.status !== 200) {
        console.error('Failed to poll inbox:', resp.body);
        return;
      }

      const incoming = resp.body.messages ?? [];

      for (const encryptedMessage of incoming) {
        const id = encryptedMessage._id;
        // Advance the poll cursor over everything the server handed us,
        // including messages we skip — retrying those would fail again.
        if (!newestSeen || new Date(encryptedMessage.timestamp) > new Date(newestSeen)) {
          newestSeen = encryptedMessage.timestamp;
        }
        if (decryptedById.has(id) || skippedIds.has(id)) continue;

        try {
          const readMsg = await openpgp.readMessage({
            armoredMessage: encryptedMessage.message
          });

          const privateKey = await getPrivateKey();
          if (!privateKey) return;

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
            skippedIds.add(id);
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
            skippedIds.add(id);
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
            skippedIds.add(id);
            continue;
          }

          decryptedById.set(id, {
            id,
            msg: String(decrypted),
            image: {
              id: encryptedMessage.image?._id,
              blurhash: encryptedMessage.image?.blurhash,
              nsfw: encryptedMessage.image?.nsfw
            },
            audio: {
              id: encryptedMessage.audio?._id,
              duration: encryptedMessage.audio?.duration
            },
            r: claimedAuthorRid,
            timestamp: encryptedMessage.timestamp
          });
        } catch (error) {
          console.error('Error decrypting message', error);
          skippedIds.add(id);
        }
      }

      decryptedMessages = [...decryptedById.values()].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      if (decryptedMessages.length > previousMessageCount) {
        playSound = true;
        previousMessageCount = decryptedMessages.length;
      }
    } finally {
      unpacking = false;
    }
  };

  // While the WebSocket is connected the server pushes a ping on every new
  // message, so the timer poll is off entirely — no 10s loop. Polling only
  // runs as a fallback when the socket is down (or never opened).
  let ws: WebSocket | undefined;
  let wsConnected = $state(false);
  let wsRetry = 0;
  let destroyed = false;

  const startPolling = () => {
    if (timeoutId) clearTimeout(timeoutId);
    unpack();
    timeoutId = setTimeout(startPolling, pollingInterval * 1000);
  };

  const stopPolling = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = undefined;
  };

  const connectWs = () => {
    if (destroyed || typeof window === 'undefined') return;
    try {
      ws = new WebSocket(wsUrl(`/ws?rid=${encodeURIComponent(rid)}`));
    } catch (e) {
      console.warn('WS connect failed, polling only', e);
      startPolling();
      return;
    }

    ws.onopen = () => {
      wsConnected = true;
      wsRetry = 0;
      // Socket is live: stop the timer and pull once to catch anything that
      // arrived during connection setup.
      stopPolling();
      unpack();
    };
    ws.onmessage = () => {
      // Any ping means "your inbox changed" — pull immediately.
      unpack();
    };
    ws.onclose = () => {
      wsConnected = false;
      if (destroyed) return;
      // Socket dropped: fall back to polling and reconnect with backoff.
      startPolling();
      wsRetry = Math.min(wsRetry + 1, 6);
      setTimeout(connectWs, 1000 * wsRetry);
    };
    ws.onerror = () => ws?.close();
  };

  // if the pgp hash of the values in the localstorage are equal to the hash in the url , then unlock the page

  onMount(async () => {
    // These make sure that the creds are set internally
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
    // Check if the user has a PGP identity
    if (rid) unlocked = await CheckIfUnlockable();
    console.log('ONMOUNT : ', unlocked);

    if (unlocked) {
      // Poll once immediately for first paint; the socket takes over on open.
      startPolling();
      connectWs();
    }
  });

  onDestroy(() => {
    destroyed = true;
    stopPolling();
    ws?.close();
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
        {wsConnected}
        bind:playSound
        bind:unpacking
        bind:pollingInterval
        isProfanityEnabled={data.profanityFilterEnabled}
        isVoiceEnabled={data.voiceEnabled}
      />
    </div>

    <div class="flex w-full flex-col p-4 pt-8">
      {#if unlocked}
        {#each [...decryptedMessages].reverse() as msg (msg.id)}
          <Message {msg} {decryptAudio} />
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
