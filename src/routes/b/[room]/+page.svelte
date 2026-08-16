<script lang="ts">
  import * as openpgp from 'openpgp';
  import { fly } from 'svelte/transition';
  import type { IKeyPairs } from '$lib/types';

  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';

  import ImageSquare from 'phosphor-svelte/lib/ImagesSquare';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import ImageThumbnail from '../../li/[room]/Message/ImageThumbnail.svelte';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import VoiceRecorder from './VoiceRecorder.svelte';

  import { breakString } from '$lib/utils/utils';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';
  import { apiUrl } from '$lib/api';
  import { X } from 'phosphor-svelte';
  import { Button } from '$lib/components/ui/button';
  import IdentityChip from '$lib/components/IdentityChip.svelte';

  let api_pbKey: string;
  let disableSend = false;

  interface IVectorResponse {
    flaggedFor?: string;
    isProfanity: boolean;
    score: number;
  }

  let keyPairs: IKeyPairs[] | undefined;
  let loadedPair: IKeyPairs | null = $state(null);

  let params = page.params.room ?? '';

  let sending = $state(false);
  let checkingProfanity = $state(false);

  let message = $state('');
  let roomTitle = $state('');
  let loadingRoom = $state(true);
  let imageBase64: string[] = $state([]);
  let voiceBlob: Blob | null = $state(null);
  let voiceDurationSec = $state(0);
  let voiceRendering = $state(false);
  // Opt-in per room (see onMount) — starts false so the recorder never flashes
  // into view on a room that doesn't accept voice.
  let voiceAllowed = $state(false);
  let voiceRecorder: VoiceRecorder | undefined = $state();
  let profanityCheckResponse: IVectorResponse | undefined = $state();
  let profaneBlock = $state(false);

  // A voice note or image is a complete message on its own — text isn't
  // mandatory just because it used to be the only content type.
  let hasContent = $derived(message.trim().length > 0 || imageBase64.length > 0 || !!voiceBlob);

  const checkProfanity = async (message: string) => {
    checkingProfanity = true;
    try {
      const res = await fetch('https://vector.profanity.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      profanityCheckResponse = (await res.json()) as IVectorResponse;
      return profanityCheckResponse.isProfanity;
      // {"isProfanity":true,"score":0.99999964,"flaggedFor":"Fuck"}
    } finally {
      checkingProfanity = false;
    }
  };

  let sendError = $state('');

  // When posting sign the message with the private key and send it to the server
  // Get the private key of myself from localstorage
  const signMessage = async () => {
    if (!loadedPair) return;
    if (!api_pbKey) {
      // Recipient's key never loaded — most commonly because this room
      // isn't actually registered server-side (see fetchKeys). Nothing to
      // encrypt against, so fail loudly instead of letting
      // openpgp.readKey(undefined) throw an opaque, uncaught error further
      // down that leaves `sending` stuck true forever.
      sendError = "Can't send — this room's key hasn't loaded (does it exist?).";
      return;
    }
    sending = true;
    sendError = '';

    try {
      await signMessageInner(loadedPair);
    } catch (e) {
      console.error('Failed to send message', e);
      // Only fall back to the generic message — a rejection the sender can
      // actually act on (e.g. the room doesn't take voice notes) sets a
      // specific one on the way out.
      if (!sendError) sendError = 'Failed to send — see console for details.';
    } finally {
      sending = false;
    }
  };

  const signMessageInner = async (loadedPair: IKeyPairs) => {
    const passphrase = PUBLIC_PGP_PASSPHRASE;
    const uniqueString = loadedPair.uniqueString;
    const publicKey = await openpgp.readKey({ armoredKey: api_pbKey });

    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: loadedPair.prKey }),
      passphrase
    });

    let profanityAllowed = false;

    // Only the typed caption is checked, so there's nothing to look up for an
    // image- or voice-only send. The filter covers text only: voice notes are
    // not transcribed (see CLAUDE.md) and images were never inspected either.
    if (message.trim()) {
      const respn = await fetch(apiUrl(`/api/profanity?rid=${encodeURIComponent(params)}`));

      const re = await respn.json();

      if (re.status !== 200) {
        console.error('Failed to fetch profanity setting:', re.body);
      } else {
        profanityAllowed = re.body.profanityEnabled;
      }
    }
    let profane = false;

    if (!profanityAllowed && message.trim()) {
      profane = await checkProfanity(message);
    }
    if (profane) {
      profaneBlock = true;
      message = '';
      voiceRecorder?.reset();
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

    // Voice notes get the same encrypt-and-sign treatment as the text, not
    // the plain/unsigned handling images get today — voice is far more
    // identifying, so it gets real E2E confidentiality and the inbox's
    // signature check (see /li/[room]) instead of a bare upload.
    let audioData: { dataURI: string[]; duration: number } | undefined;
    if (voiceBlob) {
      const voiceBytes = new Uint8Array(await voiceBlob.arrayBuffer());
      const encryptedVoice = await openpgp.encrypt({
        message: await openpgp.createMessage({ binary: voiceBytes }),
        encryptionKeys: publicKey,
        signingKeys: privateKey
      });
      audioData = { dataURI: breakString(encryptedVoice, 1000), duration: voiceDurationSec };
    }

    const response = await fetch(apiUrl('/api/pgp'), {
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
        audioData,
        r: uniqueString,
        p: params
      })
    });

    const resp = await response.json();

    if (resp.status !== 200) {
      // The 4xx bodies here are plain human-readable strings ("This room does
      // not accept voice messages", ...) — show that rather than a generic
      // failure the sender can't do anything about.
      if (typeof resp.body === 'string') sendError = resp.body;
      throw new Error(`Send failed: ${JSON.stringify(resp.body)}`);
    }
    message = '';
    imageBase64 = [];
    voiceRecorder?.reset();
  };

  // get the public key of the other person from the url
  const fetchKeys = async () => {
    disableSend = true;
    // lim=0 → just the listener record (pbKey); without it this downloaded
    // the recipient's entire encrypted mailbox to read one key.
    const response = await fetch(apiUrl(`/api/pgp?r=${params}&lim=0`));
    const data = await response.json();
    // A 404 here (room not registered — e.g. the sender's own genesis
    // identity failed to register earlier) used to leave api_pbKey
    // `undefined` with no indication why; signMessage would then crash deep
    // inside openpgp.readKey with an opaque error. Surface it here instead.
    if (data.status !== 200) {
      console.error('Failed to fetch recipient key:', data.body);
      sendError = "This room doesn't exist (yet) — check the link, or the recipient's identity may not have finished registering.";
      disableSend = false;
      return;
    }
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

    try {
      const responseTitle = await fetch(apiUrl(`/api/title?rid=${encodeURIComponent(params)}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const respTitle = await responseTitle.json();

      // `.error` never exists on any response this app sends (see
      // CLAUDE.md's `{ status, body }` envelope) — checking it always fell
      // through to the "success" branch, so a 404 (room not registered)
      // reached `respTitle.body.title` where `body` is a plain string,
      // crashing on `.length` of undefined and aborting the rest of this
      // onMount (fetchKeys below never ran, leaving api_pbKey unset).
      if (respTitle.status !== 200) {
        console.error('Failed to fetch room title:', respTitle.body);
        roomTitle = params; // fall back to showing the raw rid
      } else {
        roomTitle = respTitle.body.title.length == 0 ? respTitle.body.rid : respTitle.body.title;
      }
    } catch (e) {
      console.error('Error fetching room title', e);
      roomTitle = params;
    } finally {
      loadingRoom = false;
    }

    // Voice notes are opt-in per room. This only decides whether to offer the
    // recorder at all — the send path enforces it server-side too, so a stale
    // or failed read here can't sneak a clip into a room that said no. Fail
    // closed: if we can't tell, don't offer it.
    try {
      const voiceResp = await fetch(apiUrl(`/api/voice?rid=${encodeURIComponent(params)}`)).then(
        (r) => r.json()
      );
      voiceAllowed = voiceResp.status === 200 && voiceResp.body?.voiceEnabled === true;
    } catch (e) {
      console.error('Failed to fetch voice setting', e);
      voiceAllowed = false;
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
      <span class=" flex items-center justify-center gap-2 rounded-xs p-1 font-light">
        {#if loadingRoom}
          <span
            class="text-muted-foreground border-muted-foreground/40 text-md inline-flex animate-pulse items-center gap-1.5 border border-dashed px-2 tracking-wider uppercase italic md:text-xl"
            aria-live="polite"
          >
            <Spinner class="size-4 animate-spin md:size-5" weight="duotone" />
            loading
          </span>
        {:else if roomTitle}
          <h2 class="text-md md:text-xl">
            [ {roomTitle} ]
          </h2>
          <span class="text-muted-foreground text-md font-light italic md:text-xl">as</span>
        {/if}
        {#if loadedPair}
          <IdentityChip rid={loadedPair.uniqueString} classString="translate-y-[3px] ml-[3px]" />
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
          if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
          // Enter-to-send is a desktop-only convenience: there Shift+Enter is
          // right there when you want a newline. A touch keyboard has no
          // comfortable modifier, so Enter is the only "new line" affordance
          // people reach for — and sending on it fires off half-written
          // messages. On a coarse pointer, let Enter do the obvious thing and
          // leave sending to the Send button.
          if (window.matchMedia('(pointer: coarse)').matches) return;
          // Without this the textarea also inserts the newline we just sent on.
          e.preventDefault();
          signMessage();
        }}
      />

      <button
        class=" border-light-900 dark:border-dark-600
				relative h-fit border border-black p-7 transition-all
				{!hasContent || sending ? 'cursor-not-allowed' : ' bg-primary text-primary-foreground'}"
        disabled={!hasContent || sending || checkingProfanity || voiceRendering}
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

    {#if sendError}
      <span class="bg-destructive/10 text-destructive mb-2 block w-full p-2 text-sm">
        {sendError}
      </span>
    {/if}

    <!-- items-start so the short "Add image" tile doesn't stretch to match the
         (much taller) expanded voice recorder next to it; flex-wrap so the two
         stack instead of overflowing once a clip is recorded on a narrow screen. -->
    <span class=" flex h-full w-full flex-row flex-wrap items-start gap-2 border border-black p-3">
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
      {#if voiceAllowed}
        <VoiceRecorder
          bind:this={voiceRecorder}
          bind:blob={voiceBlob}
          bind:durationSec={voiceDurationSec}
          bind:rendering={voiceRendering}
        />
      {/if}
    </span>
  </div>
</div>
