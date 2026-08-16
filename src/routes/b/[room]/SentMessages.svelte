<script lang="ts">
  import * as openpgp from 'openpgp';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';

  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import LockKey from 'phosphor-svelte/lib/LockKey';
  import Microphone from 'phosphor-svelte/lib/Microphone';
  import ImagesSquare from 'phosphor-svelte/lib/ImagesSquare';

  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import { Button } from '$lib/components/ui/button';

  import { signedFetch } from '$lib/utils/signedRequest';
  import { checkProfanity, fetchProfanityAllowed } from '$lib/utils/profanity';
  import type { IKeyPairs } from '$lib/types';

  interface Props {
    /** rid of the room these messages were sent to. */
    room: string;
    /** The identity that sent them — its private key opens them. */
    loadedPair: IKeyPairs;
    /** Recipient's armored public key; an edit is re-encrypted to it. */
    recipientPbKey: string;
  }

  let { room, loadedPair, recipientPbKey }: Props = $props();

  interface SentEntry {
    id: string;
    text: string;
    /** Ciphertext this identity can't open — see `load()`. */
    locked: boolean;
    timestamp: string;
    editedAt: string | null;
    image: { id?: string } | null;
    audio: { id?: string; duration?: number } | null;
  }

  let entries: SentEntry[] = $state([]);
  let loading = $state(true);
  let loadError = $state('');

  let editingId: string | null = $state(null);
  let draft = $state('');
  let savingId: string | null = $state(null);
  let editError = $state('');

  // Same reasoning as the inbox: decrypting the private key runs a deliberately
  // slow passphrase KDF, so do it once for the whole list.
  let cachedPrivateKey: openpgp.PrivateKey | null = null;
  const getPrivateKey = async () => {
    if (!cachedPrivateKey) {
      cachedPrivateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: loadedPair.prKey }),
        passphrase: PUBLIC_PGP_PASSPHRASE
      });
    }
    return cachedPrivateKey;
  };

  export const refresh = async () => {
    await load();
  };

  const load = async () => {
    if (!room || !loadedPair) return;
    loading = true;
    loadError = '';

    try {
      const resp = await signedFetch('/api/sent', 'POST', loadedPair.uniqueString, 'sent:list', {
        room
      });

      if (resp.status !== 200) {
        // 404 here means the room isn't registered at all; anything else is a
        // real failure. Either way the body is a human-readable string.
        loadError =
          typeof resp.body === 'string' ? resp.body : 'Could not load your sent messages.';
        return;
      }

      const privateKey = await getPrivateKey();
      const myPublicKey = await openpgp.readKey({ armoredKey: loadedPair.pbKey });

      const decrypted: SentEntry[] = [];
      for (const raw of resp.body.messages ?? []) {
        let text = '';
        let locked = false;

        try {
          const { data, signatures } = await openpgp.decrypt({
            message: await openpgp.readMessage({ armoredMessage: raw.message }),
            decryptionKeys: privateKey,
            verificationKeys: myPublicKey,
            config: { allowInsecureDecryptionWithSigningKeys: true }
          });

          // The `author` field the server filtered on is self-declared, so
          // verifying our own signature is what actually proves this is ours
          // — anyone can stamp someone else's rid on a message they send.
          if (!signatures?.length) throw new Error('unsigned');
          await signatures[0].verified;

          text = String(data);
        } catch {
          // Two ways to land here, and they're indistinguishable from the
          // ciphertext alone: messages sent before this feature existed were
          // encrypted to the recipient only, so the sender genuinely cannot
          // open them; and a message someone else sent while claiming this
          // rid won't carry a matching signature. Both are shown, neither is
          // editable — an edit would have to overwrite text we can't read.
          locked = true;
        }

        decrypted.push({
          id: raw._id,
          text,
          locked,
          timestamp: raw.timestamp,
          editedAt: raw.editedAt ?? null,
          image: raw.image?._id ? { id: raw.image._id } : null,
          audio: raw.audio?._id ? { id: raw.audio._id, duration: raw.audio.duration } : null
        });
      }

      entries = decrypted;
    } catch (e) {
      console.error('Failed to load sent messages', e);
      loadError = 'Could not load your sent messages.';
    } finally {
      loading = false;
    }
  };

  const startEdit = (entry: SentEntry) => {
    editingId = entry.id;
    draft = entry.text;
    editError = '';
  };

  const cancelEdit = () => {
    editingId = null;
    draft = '';
    editError = '';
  };

  const save = async (entry: SentEntry) => {
    if (savingId) return;
    editError = '';

    if (!draft.trim() && !entry.image && !entry.audio) {
      editError = "A message can't be empty — delete isn't a thing here, but you can rewrite it.";
      return;
    }
    if (draft === entry.text) {
      cancelEdit();
      return;
    }

    savingId = entry.id;
    try {
      // The same courtesy check a fresh send goes through, on the same room
      // setting. Unlike the send path this doesn't wipe the box on a hit —
      // that would throw away an edit the sender has been typing.
      if (draft.trim() && !(await fetchProfanityAllowed(room))) {
        const verdict = await checkProfanity(draft);
        if (verdict.isProfanity) {
          const flagged = verdict.flaggedFor ? ` (${verdict.flaggedFor})` : '';
          editError = `🤬 Profanity${flagged} — this room doesn't allow it.`;
          return;
        }
      }

      // Re-encrypt exactly like a first send: to the recipient *and* to
      // ourselves, signed with our private key. Skipping either half would
      // make the edit unreadable to one of us, or make the inbox reject it
      // as a spoof.
      const privateKey = await getPrivateKey();
      const recipientKey = await openpgp.readKey({ armoredKey: recipientPbKey });
      const myPublicKey = await openpgp.readKey({ armoredKey: loadedPair.pbKey });

      const armored = (await openpgp.encrypt({
        message: await openpgp.createMessage({ text: draft }),
        encryptionKeys:
          recipientPbKey === loadedPair.pbKey ? [recipientKey] : [recipientKey, myPublicKey],
        signingKeys: privateKey
      })) as string;

      const resp = await signedFetch(
        '/api/sent',
        'PATCH',
        loadedPair.uniqueString,
        'message:edit',
        { room, id: entry.id, message: armored }
      );

      if (resp.status !== 200) {
        editError = typeof resp.body === 'string' ? resp.body : 'Could not save the edit.';
        return;
      }

      entries = entries.map((e) =>
        e.id === entry.id ? { ...e, text: draft, editedAt: resp.body?.editedAt ?? null } : e
      );
      editingId = null;
      draft = '';
    } catch (e) {
      console.error('Failed to edit message', e);
      editError = 'Could not save the edit — see console for details.';
    } finally {
      savingId = null;
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  onMount(load);
</script>

<div class="mt-6 w-full border border-black">
  <div class="border-primary/20 flex items-center justify-between border-b p-3">
    <h3 class="text-sm font-semibold tracking-wider uppercase">Sent by you</h3>
    <span class="text-muted-foreground flex items-center gap-2 text-xs">
      {#if loading}
        <Spinner class="size-4 animate-spin" weight="duotone" />
      {:else}
        {entries.length}
        {entries.length === 1 ? 'message' : 'messages'}
      {/if}
    </span>
  </div>

  {#if loadError}
    <span class="bg-destructive/10 text-destructive block p-3 text-sm">{loadError}</span>
  {:else if !loading && !entries.length}
    <p class="text-muted-foreground p-4 text-sm">
      Nothing yet. Messages you send to this room show up here — only on this device, and only for
      this identity.
    </p>
  {/if}

  <ul>
    {#each entries as entry (entry.id)}
      <li class="border-primary/10 border-b p-3 last:border-b-0">
        {#if editingId === entry.id}
          <div transition:slide={{ duration: 150 }} class="flex flex-col gap-2">
            <Textarea bind:value={draft} maxlength={1000} class="w-full border border-black p-3" />
            {#if editError}
              <span class="bg-destructive/10 text-destructive p-2 text-sm">{editError}</span>
            {/if}
            <div class="flex items-center gap-2">
              <Button onclick={() => save(entry)} disabled={savingId === entry.id}>
                {#if savingId === entry.id}
                  <Spinner class="size-4 animate-spin" weight="duotone" />
                  Saving
                {:else}
                  Save
                {/if}
              </Button>
              <Button variant="ghost" onclick={cancelEdit} disabled={savingId === entry.id}>
                Cancel
              </Button>
              <span class="text-muted-foreground ml-auto text-xs">{draft.length}/1000</span>
            </div>
          </div>
        {:else}
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 flex-col gap-1">
              {#if entry.locked}
                <span
                  class="text-muted-foreground flex items-center gap-1.5 text-sm italic"
                  title="Sent before this browser kept a copy you can open"
                >
                  <LockKey class="size-4" weight="duotone" />
                  Can't be shown — sent without a copy for you
                </span>
              {:else if entry.text}
                <p class="text-sm break-words whitespace-pre-wrap">{entry.text}</p>
              {:else}
                <span class="text-muted-foreground text-sm italic">(no text)</span>
              {/if}

              <span class="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span>{formatTime(entry.timestamp)}</span>
                {#if entry.editedAt}
                  <span class="italic">· edited {formatTime(entry.editedAt)}</span>
                {/if}
                {#if entry.image}
                  <span class="flex items-center gap-1">
                    <ImagesSquare class="size-3.5" weight="duotone" /> image
                  </span>
                {/if}
                {#if entry.audio}
                  <span class="flex items-center gap-1">
                    <Microphone class="size-3.5" weight="duotone" />
                    voice{entry.audio.duration ? ` ${Math.round(entry.audio.duration)}s` : ''}
                  </span>
                {/if}
              </span>
            </div>

            {#if !entry.locked}
              <button
                class="border-primary bg-background hover:bg-secondary/60 flex h-7 shrink-0 items-center gap-1.5 border px-2 text-xs transition-all disabled:opacity-40"
                onclick={() => startEdit(entry)}
                disabled={!recipientPbKey}
                title={recipientPbKey ? 'Edit this message' : "Recipient's key hasn't loaded yet"}
              >
                <PencilSimple class="size-4" weight="duotone" />
                Edit
              </button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>

  {#if entries.some((e) => e.image || e.audio)}
    <p class="text-muted-foreground border-primary/10 border-t p-3 text-xs">
      Editing replaces the text. An attached image or voice note stays as it was sent.
    </p>
  {/if}
</div>
