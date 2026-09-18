<script lang="ts">
  import HeaderRow from '$lib/components/HeaderRow.svelte';
  import * as openpgp from 'openpgp';
  import { fly } from 'svelte/transition';
  import type { IKeyPairs } from '$lib/types';

  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';

  import ImageSquare from 'phosphor-svelte/lib/ImagesSquare';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import ImageThumbnail from '../../li/[room]/Message/ImageThumbnail.svelte';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import VoiceRecorder from './VoiceRecorder.svelte';
  import SentMessages from './SentMessages.svelte';

  import { breakString } from '$lib/utils/utils';
  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';
  import {
    checkProfanity as runProfanityCheck,
    fetchProfanityAllowed,
    type IVectorResponse
  } from '$lib/utils/profanity';
  import { apiUrl, wsUrl } from '$lib/api';
  import { X } from 'phosphor-svelte';
  import { Button } from '$lib/components/ui/button';
  import IdentityChip from '$lib/components/IdentityChip.svelte';

  // $state because SentMessages takes it as a prop and needs it to re-encrypt
  // an edit — it lands asynchronously in onMount, after that child mounts.
  let api_pbKey = $state('');
  let disableSend = false;

  let keyPairs: IKeyPairs[] | undefined;
  let loadedPair: IKeyPairs | null = $state(null);

  let params = page.params.room ?? '';

  let sending = $state(false);
  let checkingProfanity = $state(false);

  let message = $state('');
  let roomTitle = $state('');
  let loadingRoom = $state(true);
  let imageBase64: string[] = $state([]);
  let imageError = $state('');
  let voiceBlob: Blob | null = $state(null);
  let voiceDurationSec = $state(0);
  let voiceRendering = $state(false);
  // Opt-in per room (see onMount) — starts false so the recorder never flashes
  // into view on a room that doesn't accept voice.
  let voiceAllowed = $state(false);
  // Per-room limits (see onMount). All of these are the UI half only — the
  // send path re-enforces each one server-side — so they default to the
  // permissive value: a failed read must not lock a working room's composer.
  let roomPaused = $state(false);
  let imagesAllowed = $state(true);
  let maxMessageLength = $state(0); // 0 = no owner cap
  // The composer's hard ceiling is 1000 either way; an owner cap lowers it.
  let effectiveMaxLength = $derived(
    maxMessageLength > 0 ? Math.min(maxMessageLength, 1000) : 1000
  );
  // The attachments strip earns its border only when it has something to
  // show: an attached image (or its error), the attach tile, or the recorder.
  // A room with images off and voice off would otherwise render an empty box.
  let showAttachRow = $derived(
    !roomPaused && (imageBase64.length > 0 || !!imageError || imagesAllowed || voiceAllowed)
  );
  let voiceRecorder: VoiceRecorder | undefined = $state();
  let sentMessages: SentMessages | undefined = $state();
  let profanityCheckResponse: IVectorResponse | undefined = $state();
  let profaneBlock = $state(false);

  // A voice note or image is a complete message on its own — text isn't
  // mandatory just because it used to be the only content type.
  let hasContent = $derived(message.trim().length > 0 || imageBase64.length > 0 || !!voiceBlob);

  // Thin wrapper over the shared check (also used when editing a sent
  // message) that drives this page's "Checking" indicator.
  const checkProfanity = async (message: string) => {
    checkingProfanity = true;
    try {
      profanityCheckResponse = await runProfanityCheck(message);
      return profanityCheckResponse.isProfanity;
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
      sendError = "Can't send: this room's key hasn't loaded (does it exist?).";
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
      if (!sendError) sendError = 'Failed to send. See console for details.';
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

    // Encrypt to the sender as well as the recipient. PGP just adds a second
    // session-key packet — the recipient's copy is untouched — but it's the
    // difference between the sender holding a blob they can never open again
    // and being able to read back (and edit) what they sent. Skipped when
    // they're the same key, i.e. sending to your own room.
    const myPublicKey = await openpgp.readKey({ armoredKey: loadedPair.pbKey });
    const encryptionKeys = api_pbKey === loadedPair.pbKey ? [publicKey] : [publicKey, myPublicKey];

    let profanityAllowed = false;

    // Only the typed caption is checked, so there's nothing to look up for an
    // image- or voice-only send. The filter covers text only: voice notes are
    // not transcribed (see CLAUDE.md) and images were never inspected either.
    if (message.trim()) {
      profanityAllowed = await fetchProfanityAllowed(params);
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
      encryptionKeys,
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
        encryptionKeys,
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

    // Rejections from the layers *around* SvelteKit — adapter-node's
    // BODY_SIZE_LIMIT, a proxy — never carry the app's { status, body }
    // envelope, so check the real HTTP status before trusting that shape.
    // Reading `resp.status` off a 413's `{ message: 'Payload Too Large' }`
    // yields undefined, which is how an oversized attachment used to surface
    // as the same opaque "Send failed: undefined" as everything else.
    if (!response.ok) {
      sendError =
        response.status === 413
          ? 'That attachment is too large to send. Try a shorter recording or a smaller image.'
          : `Send failed (HTTP ${response.status}). Please try again.`;
      throw new Error(`Send failed: HTTP ${response.status}`);
    }

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
    imageError = '';
    voiceRecorder?.reset();
    // Pull the new message into the sender's own history right away rather
    // than making them reload to see (and edit) what they just sent.
    await sentMessages?.refresh();
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
      sendError = "This room doesn't exist (yet). Check the link, or the recipient's identity may not have finished registering.";
      disableSend = false;
      return;
    }
    api_pbKey = data.body.pbKey;
    disableSend = false;
  };

  // Stays under the server's MAX_IMAGE_CHARS (3M base64 chars ≈ 2.25MB of
  // bytes), so anything accepted here also survives PATCH /api/pgp.
  const MAX_IMAGE_MB = 2;

  // Generate the base64 and load the preview. Shared by the file picker and
  // the clipboard paste path — both end up holding a File and want the same
  // size cap and chunking.
  function loadImageFile(file: File) {
    if (file.size / (1024 * 1024) > MAX_IMAGE_MB) {
      imageError = `That image is too large (${MAX_IMAGE_MB}MB max).`;
      return;
    }
    imageError = '';

    const reader = new FileReader();
    reader.onload = function (e) {
      let imageBase64Str = (e.target?.result ?? '') as string;
      imageBase64 = breakString(imageBase64Str, 1000);
    };

    // Read the selected file as a data URL
    reader.readAsDataURL(file);
  }

  function handleFileInput(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) loadImageFile(file);
  }

  // Screenshots and copied images land on the clipboard as files, so a paste
  // can fill the attachment slot the picker otherwise would. Bound on the
  // window (paste bubbles up from the textarea) so it works whether or not the
  // message field has focus — this page has no other input to steal it from.
  function handlePaste(event: ClipboardEvent) {
    // Rooms that turned images off shouldn't accept one through the side door
    // either — let the paste fall through to the textarea as plain text.
    if (!imagesAllowed) return;

    const items = Array.from(event.clipboardData?.items ?? []);

    // A text/plain entry means this is really a text paste that happens to
    // carry an image alongside it (copying a rich snippet does this). Let the
    // textarea have it rather than swallowing the text and attaching a picture
    // the sender didn't ask for.
    if (items.some((i) => i.kind === 'string' && i.type === 'text/plain')) return;

    const file = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile();
    if (!file) return;

    event.preventDefault();
    loadImageFile(file);
  }

  // Everything the room's owner controls that this page renders. Split out of
  // onMount so it can be called again: an owner who pauses the room, turns
  // voice off or renames it while someone is typing should not need that
  // person to reload before it takes effect.
  const loadRoomSettings = async () => {
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

    // The room's abuse limits: paused, images on/off, message length cap.
    // Unlike voice these fail OPEN — their defaults are the permissive state,
    // and every one of them is enforced again server-side, so a failed read
    // here degrades to a rejected send with a clear error, not a wrongly
    // locked composer.
    try {
      const limitsResp = await fetch(apiUrl(`/api/limits?rid=${encodeURIComponent(params)}`)).then(
        (r) => r.json()
      );
      if (limitsResp.status === 200) {
        roomPaused = limitsResp.body?.paused === true;
        imagesAllowed = limitsResp.body?.imagesEnabled !== false;
        maxMessageLength =
          typeof limitsResp.body?.maxMessageLength === 'number'
            ? limitsResp.body.maxMessageLength
            : 0;
      }
    } catch (e) {
      console.error('Failed to fetch room limits', e);
    }

    await invalidateAll();
  };

  // Settings arrive over the same socket the inbox and the sent list use,
  // subscribed to the ROOM's rid rather than this sender's. That is a
  // deliberate second subscription: SentMessages listens on the sender's own
  // rid for replies, and the two feeds answer different questions.
  //
  // Only `settings` is acted on. The room's socket also carries a `message`
  // ping every time anyone writes to it, and a sender has no business
  // re-reading half a dozen endpoints because a stranger sent something.
  // Hearing that ping at all reveals nothing new either way: the room's
  // ciphertext, and therefore its message count and timings, is already
  // readable by anyone holding the share link.
  //
  // No polling fallback here, unlike the message paths. A missed settings
  // change costs a stale composer until the next reload, and every one of
  // these limits is enforced again server-side, so the worst case is a send
  // rejected with a clear reason rather than anything slipping through.
  const SETTINGS_GAP_MS = 1_000;
  let settingsWs: WebSocket | undefined;
  let settingsRetry = 0;
  let settingsQueued = false;
  let pageDestroyed = false;

  const reloadSettingsSoon = () => {
    if (pageDestroyed || settingsQueued) return;
    settingsQueued = true;
    setTimeout(() => {
      settingsQueued = false;
      if (!pageDestroyed) loadRoomSettings();
    }, SETTINGS_GAP_MS);
  };

  const connectSettingsWs = () => {
    if (pageDestroyed || typeof window === 'undefined' || !params) return;
    try {
      settingsWs = new WebSocket(wsUrl(`/ws?rid=${encodeURIComponent(params)}`));
    } catch (e) {
      console.warn('Settings socket unavailable, room settings will not live update', e);
      return;
    }

    settingsWs.onopen = () => {
      settingsRetry = 0;
    };
    settingsWs.onmessage = (event) => {
      try {
        if (JSON.parse(event.data)?.type === 'settings') reloadSettingsSoon();
      } catch {
        // A payload we cannot parse is not a reason to refetch.
      }
    };
    settingsWs.onclose = () => {
      if (pageDestroyed) return;
      settingsRetry = Math.min(settingsRetry + 1, 6);
      setTimeout(connectSettingsWs, 1000 * settingsRetry);
    };
    settingsWs.onerror = () => settingsWs?.close();
  };

  onMount(async () => {
    keyPairs = await getAllFromLS();
    loadedPair = (await getLoadedPairFromLS()) ?? null;

    await loadRoomSettings();
    connectSettingsWs();

    if (params) {
      await fetchKeys();
    }
  });

  onDestroy(() => {
    pageDestroyed = true;
    settingsWs?.close();
  });
</script>

<svelte:window onpaste={handlePaste} />

<div
  class="container mx-auto flex w-full max-w-4xl grow flex-col items-center justify-start"
>
  <HeaderRow variant="page">
    Send to
    <!-- Two groups, not one line: the room's name, then who you are sending
         as. A narrow phone breaks between them instead of running the
         identity chip off the right edge. The chip is whitespace-nowrap by
         design (a truncated rid is not an identity), so it can only wrap,
         never shrink, and "as" has to travel with it: wrapping four loose
         siblings strands "as" at the end of the line above. -->
    <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-light">
      {#if loadingRoom}
        <span
          class="text-muted-foreground border-muted-foreground/40 text-md inline-flex animate-pulse items-center gap-1.5 border border-dashed px-2 tracking-wider uppercase italic md:text-xl"
          aria-live="polite"
        >
          <Spinner class="size-4 animate-spin md:size-5" weight="duotone" />
          loading
        </span>
      {:else if roomTitle}
        <h2 class="text-md whitespace-nowrap md:text-xl">
          [ {roomTitle} ]
        </h2>
      {/if}
      {#if loadedPair}
        <span class="flex shrink-0 items-center gap-2">
          <!-- "as" belongs to the chip, so it lives in here. It used to sit
               in the title branch, where it also rendered before an identity
               had loaded, qualifying nothing. -->
          {#if !loadingRoom && roomTitle}
            <span class="text-muted-foreground text-md font-light italic md:text-xl">as</span>
          {/if}
          <IdentityChip rid={loadedPair.uniqueString} classString="translate-y-[3px] ml-[3px]" />
        </span>
      {/if}
    </span>
  </HeaderRow>
  {#if roomPaused}
    <span class="bg-destructive/10 text-destructive mt-2 block w-full px-4 py-3 text-sm">
      This room is paused. The owner isn't accepting messages right now.
    </span>
  {/if}
  <span class="w-full px-4 pt-2 text-left text-sm font-light"
    >{message.length}/{effectiveMaxLength}</span
  >
  <div class="mb-2 w-full">
    <!-- Send drops onto its own row on a narrow phone. The button is a fixed
         97px and the textarea carries p-8, so side by side the composer's
         usable measure is whatever is left: 259px of text at a 480px viewport,
         179px at 400px, 99px at 320px, which is where the placeholder starts
         wrapping one word per line. 480px is the width below which that stops
         being a text box. Stretched rather than end-aligned when stacked,
         since align-items runs horizontally in a column and "end" would pin
         Send to the right edge instead of filling the row. -->
    <span
      class="relative mb-2 flex h-full w-full flex-col items-stretch gap-2 px-4 pt-2 pb-4 min-[480px]:flex-row min-[480px]:items-end"
    >
      <Textarea
        bind:value={message}
        placeholder="Enter your message here, then press send. "
        class="placeholder:text-md h-full
        w-full border border-border p-8"
        disabled={roomPaused}
        maxlength={effectiveMaxLength}
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
				relative h-fit border border-border p-7 transition-all
				{!hasContent || sending ? 'cursor-not-allowed' : ' bg-primary text-primary-foreground'}"
        disabled={!hasContent || sending || checkingProfanity || voiceRendering || roomPaused}
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
      <span class="bg-destructive/10 text-destructive mb-2 block w-full px-4 py-2 text-sm">
        {sendError}
      </span>
    {/if}


    <!-- A cell row, like the header rows: no box around it, no padding on the
         row, no gaps, each control carrying its own padding and a divider.
         border-t only, never border-b: every band below this one draws its own
         top rule, and carrying both put 2px of hairline between them.
         items-start still, so the short "Add image" cell doesn't stretch to
         match the (much taller) expanded voice recorder beside it; flex-wrap
         so the two stack instead of overflowing once a clip is recorded on a
         narrow screen. Hidden entirely while the room is paused (dead
         controls) or when the room's limits leave it nothing to offer. -->
    <span
      class="border-border flex h-full w-full flex-row flex-wrap items-start border-t"
      class:hidden={!showAttachRow}
    >
      {#if imageBase64.length}
        <ImageThumbnail imageBase64={imageBase64.join('')} variant="md" />
        <Button
          onclick={() => {
            imageBase64 = [];
            imageError = '';
          }}
        >
          <X /> <span> Clear image </span>
        </Button>
      {:else if imagesAllowed}
        <span class="border-border hover:bg-secondary border-r transition-colors">
          <label for="image-input" class="flex cursor-pointer items-center gap-2 px-4 py-3">
            <ImageSquare size="24" weight="duotone" />
            <span class="text-sm">Add image </span>
            <span class="text-muted-foreground hidden text-xs sm:inline">or paste one</span>
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
      {#if imageError}
        <span class="bg-destructive/10 text-destructive w-full px-4 py-2 text-sm">
          {imageError}
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

    <!-- Only this browser can read this list: it's decrypted with the loaded
         identity's private key, which never leaves it. -->
    {#if loadedPair && params}
      <SentMessages
        bind:this={sentMessages}
        room={params}
        {loadedPair}
        recipientPbKey={api_pbKey}
        maxLen={effectiveMaxLength}
      />
    {/if}
  </div>
</div>
