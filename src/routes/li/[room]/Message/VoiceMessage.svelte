<script lang="ts">
  import { onDestroy } from 'svelte';
  import { apiUrl } from '$lib/api';
  import VoicePlayer from '$lib/components/VoicePlayer.svelte';

  // Lazy: the list poll (`GET /api/pgp`) excludes the audio ciphertext (see
  // the `-dataURI` populate in that route) so it stays small, same reason
  // full images are fetched on demand via BlurhashThumbnail. Decrypt +
  // signature verification only happen once the recipient taps play.
  interface Props {
    audioId: string;
    authorRid: string;
    duration?: number;
    decryptAudio: (armored: string, authorRid: string) => Promise<Uint8Array | null>;
  }
  let { audioId, authorRid, duration = 0, decryptAudio }: Props = $props();

  let objectUrl: string | undefined;

  /**
   * Handed to VoicePlayer, which calls it the first time play is pressed. The
   * URL is created here rather than there so this component stays the one that
   * owns it, and can revoke it on destroy.
   *
   * Returning null means "refuse the clip", which the player renders as the
   * spoof warning: an unsigned clip, or one signed by a key that does not
   * match the claimed author, is never played.
   */
  async function load(): Promise<string | null> {
    if (objectUrl) return objectUrl;
    try {
      const res = await fetch(apiUrl(`/api/audio?id=${audioId}`));
      const resp = await res.json();
      // Every response here is `{ status, body }`, never `{ error, message }`.
      if (resp.status !== 200) throw new Error(`Fetching audio failed: ${resp.body}`);

      const armored = (resp.body.dataURI as string[]).join('');
      const decrypted = await decryptAudio(armored, authorRid);
      if (!decrypted) return null;

      // .slice() (not the raw Uint8Array) so its buffer is typed as a plain
      // ArrayBuffer — Blob's constructor type doesn't accept the more
      // general ArrayBufferLike a decrypted openpgp Uint8Array carries.
      objectUrl = URL.createObjectURL(new Blob([decrypted.slice()], { type: 'audio/wav' }));
      return objectUrl;
    } catch (e) {
      console.error('Failed to load voice message', e);
      return null;
    }
  }

  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

<VoicePlayer
  {load}
  {duration}
  class="w-[260px]"
  errorTitle="Signature didn't verify against the claimed sender, possibly spoofed"
/>
