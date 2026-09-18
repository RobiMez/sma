// Deleting an identity, which is a stranger operation here than it looks.
//
// A room is not an account: it is a keypair the browser holds, and the server
// side of it is one Listener document plus the messages people sent to it.
// Deleting means the messages go, the room stops accepting new ones, and
// every setting the owner ever chose is wiped.
//
// One thing deliberately survives, and it is the whole subtlety of this file.
//
// THE PUBLIC KEY STAYS. Messages this identity sent to OTHER people's rooms
// are not ours to delete: they belong to the inboxes that received them, and
// a sender who could erase everything they ever sent by deleting their own
// room would be a retraction button dressed up as account deletion. But those
// inboxes verify each message's signature against the author's public key,
// fetched by rid — so dropping the Listener row entirely would not leave those
// messages intact, it would make every one of them fail verification and be
// silently skipped as a spoof. Keeping `pbKey` and `rid` is what stops a
// deletion over here from quietly corrupting somebody else's inbox over
// there. A public key was public by construction anyway: it was handed to
// everyone who ever opened the share link.
//
// Everything else is UNSET rather than reset to a chosen value. That makes
// this automatically complete: a field added to the schema later is deleted
// by existing, instead of surviving until somebody remembers to add it here.
// It is safe because every read in the app already tolerates an absent field
// (`voiceEnabled !== true`, `imagesEnabled !== false`, `title !== rid`), which
// is the same defensiveness that let each of those fields be introduced
// without migrating a single existing room.

/**
 * What a deleted Listener keeps. `_id` and `__v` are Mongo's; `rid` and
 * `pbKey` are the pair that keeps other people's inboxes readable; `deletedAt`
 * is the tombstone itself.
 */
export const KEPT_ON_DELETE = ['_id', '__v', 'rid', 'pbKey', 'deletedAt'];

export interface DeletionUpdate {
  $set: { deletedAt: Date };
  $unset: Record<string, ''>;
}

/**
 * The update that empties a Listener, built from the schema's own paths so it
 * cannot fall behind the schema.
 */
export function deletionUpdate(schemaPaths: string[], now: Date = new Date()): DeletionUpdate {
  const kept = new Set(KEPT_ON_DELETE);
  const $unset: Record<string, ''> = {};
  for (const path of schemaPaths) {
    // Subdocument paths arrive dotted (`payoutMethods.provider`); unsetting
    // the top level takes the whole thing.
    const top = path.split('.')[0];
    if (!top || kept.has(top)) continue;
    $unset[top] = '';
  }
  return { $set: { deletedAt: now }, $unset };
}

/**
 * Whether this room is a tombstone. Read by `verifySignedAction`, so one
 * check covers every signed endpoint at once: a deleted identity can no
 * longer rename its room, wear a theme, publish payout details or reply to
 * anything, without each of those endpoints having to remember.
 */
export function isDeleted(listener: { deletedAt?: unknown } | null | undefined): boolean {
  return !!listener?.deletedAt;
}
