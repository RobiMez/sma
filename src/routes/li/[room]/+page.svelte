<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import * as openpgp from 'openpgp';
  import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';
  import { apiUrl, wsUrl } from '$lib/api';
  import { signedFetch } from '$lib/utils/signedRequest';
  import { invalidateAll } from '$app/navigation';

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

  // Our own public key, used to verify the signatures on our own replies —
  // see `decryptReplies` for why that isn't as circular as it sounds.
  let cachedOwnPublicKey: openpgp.Key | null = null;
  const getOwnPublicKey = async () => {
    if (!cachedOwnPublicKey && loadedPair) {
      cachedOwnPublicKey = await openpgp.readKey({ armoredKey: loadedPair.pbKey });
    }
    return cachedOwnPublicKey;
  };

  // Decrypt + verify each message once and cache it by server _id, so polls
  // stay cheap. Messages stopped being immutable a while ago — their author
  // can edit the text (see /api/sent) and we can append replies to them (see
  // /api/reply) — so a cached copy is only good while the server still reports
  // the same revision. Neither change moves `timestamp`, which is exactly why
  // this is built from the two fields that do move instead.
  const revisionOf = (m: { editedAt?: string | null; repliedAt?: string | null }) =>
    `${m.editedAt ?? ''}|${m.repliedAt ?? ''}`;

  const decryptedById = new Map<string, any>();
  // Spoofed/undecryptable ids are remembered by revision the same way, so they
  // aren't re-attempted every poll but *are* retried once if they change.
  const skippedIds = new Map<string, string>();
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

  interface DecryptedReply {
    id: string;
    text: string;
    timestamp: string;
  }

  // Replies are ours: we wrote them, encrypted to the sender *and* to
  // ourselves, and signed them (see sendReply). Verifying our own signature on
  // the way back in isn't circular — it's the only thing separating a reply we
  // actually sent from a row written straight into the database, which would
  // otherwise render in our own thread as though we'd said it.
  const decryptReplies = async (rawReplies: any[]): Promise<DecryptedReply[]> => {
    if (!rawReplies?.length) return [];

    const privateKey = await getPrivateKey();
    const ownPublicKey = await getOwnPublicKey();
    if (!privateKey || !ownPublicKey) return [];

    const out: DecryptedReply[] = [];
    for (const raw of rawReplies) {
      try {
        const { data, signatures } = await openpgp.decrypt({
          message: await openpgp.readMessage({ armoredMessage: raw.message }),
          decryptionKeys: privateKey,
          verificationKeys: ownPublicKey,
          config: { allowInsecureDecryptionWithSigningKeys: true }
        });

        if (!signatures || signatures.length === 0) {
          console.warn('Skipping unsigned reply', raw._id);
          continue;
        }
        await signatures[0].verified;

        out.push({ id: raw._id, text: String(data), timestamp: raw.timestamp });
      } catch (e) {
        console.warn('Skipping reply that failed to decrypt or verify', raw?._id, e);
      }
    }
    return out;
  };

  const publish = () => {
    decryptedMessages = [...decryptedById.values()].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  /**
   * Reply to one specific message. Threaded down to Message.svelte as a
   * callback for the same reason decryptAudio is: the keys, the author-key
   * cache and the message cache all live up here, and the leaf component has
   * no business rebuilding any of them.
   */
  const sendReply = async (
    messageId: string,
    senderRid: string,
    text: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!loadedPair) return { ok: false, error: 'No identity loaded.' };

    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: 'Write something first.' };

    try {
      const privateKey = await getPrivateKey();
      const ownPublicKey = await getOwnPublicKey();
      if (!privateKey || !ownPublicKey) return { ok: false, error: 'Could not unlock your key.' };

      // The sender's rid is safe to trust here: this message only reached
      // `decryptedMessages` because its signature verified against the key
      // registered for that rid, so it isn't the self-declared value the
      // server stored — it's a proven one.
      const senderPbKeyArmored = await fetchAuthorPublicKey(senderRid);
      if (!senderPbKeyArmored) {
        return { ok: false, error: "Can't reply: no public key on record for this sender." };
      }
      const senderPublicKey = await openpgp.readKey({ armoredKey: senderPbKeyArmored });

      // Encrypt to them and to ourselves, exactly like the send path does, so
      // the thread stays readable from both ends. Deduped when we're replying
      // to a message we sent to our own room.
      const encryptionKeys =
        senderPbKeyArmored === loadedPair.pbKey
          ? [senderPublicKey]
          : [senderPublicKey, ownPublicKey];

      const armored = (await openpgp.encrypt({
        message: await openpgp.createMessage({ text: trimmed }),
        encryptionKeys,
        signingKeys: privateKey
      })) as string;

      const resp = await signedFetch('/api/reply', 'POST', rid, 'message:reply', {
        room: rid,
        id: messageId,
        message: armored
      });

      if (resp.status !== 200) {
        return {
          ok: false,
          error: typeof resp.body === 'string' ? resp.body : 'Could not send the reply.'
        };
      }

      // Show it now instead of waiting for the ping to come back around. The
      // cached entry is replaced rather than mutated so the $state array
      // actually re-renders, and its revision is advanced to what the server
      // just reported so the next poll doesn't redundantly re-decrypt.
      const cached = decryptedById.get(messageId);
      if (cached) {
        const repliedAt: string | null = resp.body?.repliedAt ?? null;
        const replyId: string = resp.body?.replyId ?? '';
        // The server pings this very room before answering, so unpack() may
        // already have folded this reply in from a poll that landed while the
        // request was in flight. Dedupe on the id the server assigned instead
        // of appending blindly, or it renders twice.
        const already = !!replyId && cached.replies.some((r: DecryptedReply) => r.id === replyId);

        decryptedById.set(messageId, {
          ...cached,
          replies: already
            ? cached.replies
            : [
                ...cached.replies,
                {
                  id: replyId || `${messageId}-local-${cached.replies.length}`,
                  text: trimmed,
                  timestamp: resp.body?.timestamp ?? new Date().toISOString()
                }
              ],
          repliedAt,
          rev: revisionOf({ editedAt: cached.editedAt, repliedAt })
        });
        publish();
      }

      return { ok: true };
    } catch (e) {
      console.error('Failed to send reply', e);
      return { ok: false, error: 'Could not send the reply. See console for details.' };
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
        const editedAt: string | null = encryptedMessage.editedAt ?? null;
        const repliedAt: string | null = encryptedMessage.repliedAt ?? null;
        const rev = revisionOf(encryptedMessage);
        // Advance the poll cursor over everything the server handed us,
        // including messages we skip — retrying those would fail again.
        // Neither an edit nor a reply moves this: both leave `timestamp`
        // alone, and the server matches them on their own fields instead
        // (see GET /api/pgp).
        if (!newestSeen || new Date(encryptedMessage.timestamp) > new Date(newestSeen)) {
          newestSeen = encryptedMessage.timestamp;
        }
        // Already handled at this exact revision — a changed one means the
        // text was rewritten or a reply was appended, so the cached copy is
        // now stale.
        const cached = decryptedById.get(id);
        if (cached && cached.rev === rev) continue;
        if (!cached && skippedIds.get(id) === rev) continue;

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
            skippedIds.set(id, rev);
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
            skippedIds.set(id, rev);
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
            skippedIds.set(id, rev);
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
            timestamp: encryptedMessage.timestamp,
            editedAt,
            repliedAt,
            rev,
            replies: await decryptReplies(encryptedMessage.replies ?? [])
          });
        } catch (error) {
          console.error('Error decrypting message', error);
          skippedIds.set(id, rev);
        }
      }

      publish();

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
    ws.onmessage = (event) => {
      // Two kinds of ping now. A message ping means the inbox changed; a
      // settings ping means the room's own state did, which for this page is
      // the look it wears. They are handled separately because unpack() is
      // the expensive one: it refetches and decrypts, and a palette change
      // has nothing to do with messages.
      let type = 'message';
      try {
        type = JSON.parse(event.data)?.type ?? 'message';
      } catch {
        // Unparseable payload: treat it as the old bare ping it used to be.
      }
      if (type === 'settings') {
        // Re-runs +page.server.ts, so a settings change made on another
        // device or in another tab reaches this one.
        invalidateAll();
        return;
      }
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
  class="container mx-auto flex w-full max-w-4xl grow flex-col items-center justify-start"
>
  {#if roomTitle && loadedPair && rid}
    <!-- No padding here: the header's own rows run to the column edges and
         set their content inset with px-4, the same as every other row. -->
    <div class="flex w-full flex-row">
      <ListenerHeader
        {loadedPair}
        {wsConnected}
        bind:playSound
        bind:unpacking
        bind:pollingInterval
        isProfanityEnabled={data.profanityFilterEnabled}
        isVoiceEnabled={data.voiceEnabled}
        initialLimits={data.roomLimits}
      />
    </div>

    <!-- Vertical only. Horizontal padding here would inset the section
         headers and message rows past the header rows above them, which is
         what had the three of them landing on three different edges. -->
    <div class="flex w-full flex-col py-4">
      {#if unlocked}
        {#each [...decryptedMessages].reverse() as msg (msg.id)}
          <Message {msg} {decryptAudio} {sendReply} />
        {/each}

        {#if !decryptedMessages.length}
          <span
            class="border-border bg-secondary/5 flex flex-col items-center justify-center gap-4 border border-dashed p-12"
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
