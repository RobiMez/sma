/**
 * The shape of the batch room read (GET /api/rooms), shared by the endpoint
 * and by the browser that calls it.
 *
 * In `$lib/config` rather than `$lib/server`: SvelteKit refuses a server-only import in
 * client code, and the page listing a browser's identities needs both the type
 * and the batch cap to chunk its request correctly.
 */
export interface RoomSummary {
  rid: string;
  title: string | null;
  /** Message count. Already public per-rid, see the endpoint comment. */
  messages: number;
  theme: { id: string; name: string } | null;
}

/**
 * How many rooms one call may ask about. A browser holding more identities
 * than this is already unusual; the cap exists so a single request cannot turn
 * into an unbounded `$in`.
 */
export const MAX_RIDS = 60;
