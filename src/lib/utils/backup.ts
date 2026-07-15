import * as openpgp from 'openpgp';
import type { IKeyPairs } from '$lib/types';

// SMA identities (the PGP private keys in `keyPairs`) live only in the
// browser's localStorage. Clear the browser or lose the device and every
// room tied to those keys is gone forever — the server only ever holds public
// keys. This module lets a user export all identities to a file and restore
// them elsewhere, optionally encrypted with a password they choose.
//
// Note the private keys are stored passphrase-protected with the *shared*
// PUBLIC_PGP_PASSPHRASE, which is not secret — so an un-encrypted export is
// effectively cleartext private keys. Always encourage a password.

const BACKUP_MAGIC = 'sma-backup';
const BACKUP_VERSION = 1;

type IdentityMap = Record<string, IKeyPairs>;

interface BackupEnvelope {
  app: string;
  version: number;
  exportedAt: string;
  encrypted: boolean;
  // Armored OpenPGP message when encrypted; the raw identity map otherwise.
  data: string | IdentityMap;
}

const isIdentity = (v: unknown): v is IKeyPairs => {
  const k = v as Record<string, unknown> | null;
  return (
    !!k &&
    typeof k.prKey === 'string' &&
    typeof k.pbKey === 'string' &&
    typeof k.uniqueString === 'string'
  );
};

// Pure: identity map -> backup file text. Testable without a browser.
export const serializeBackup = async (
  keyPairs: IdentityMap,
  password?: string,
  now: string = new Date().toISOString()
): Promise<string> => {
  if (!Object.keys(keyPairs).length) throw new Error('No identities to back up');

  const payload = JSON.stringify(keyPairs);
  let data: string | IdentityMap = keyPairs;
  let encrypted = false;

  if (password && password.length > 0) {
    data = (await openpgp.encrypt({
      message: await openpgp.createMessage({ text: payload }),
      passwords: [password],
      format: 'armored'
    })) as string;
    encrypted = true;
  }

  const envelope: BackupEnvelope = {
    app: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: now,
    encrypted,
    data
  };
  return JSON.stringify(envelope, null, 2);
};

// Pure: backup file text -> validated identity map. Testable without a browser.
export const deserializeBackup = async (
  fileText: string,
  password?: string
): Promise<IdentityMap> => {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(fileText);
  } catch {
    throw new Error('Not a valid backup file');
  }
  if (envelope?.app !== BACKUP_MAGIC) throw new Error('Not an SMA backup file');
  if (envelope.version > BACKUP_VERSION) {
    throw new Error('Backup was made by a newer version of SMA');
  }

  let keyPairs: IdentityMap;
  if (envelope.encrypted) {
    if (!password) throw new Error('This backup is password-protected — enter its password');
    try {
      const message = await openpgp.readMessage({ armoredMessage: envelope.data as string });
      const { data: decrypted } = await openpgp.decrypt({ message, passwords: [password] });
      keyPairs = JSON.parse(String(decrypted));
    } catch {
      throw new Error('Wrong password or corrupted backup');
    }
  } else {
    keyPairs = envelope.data as IdentityMap;
  }

  const valid = Object.values(keyPairs ?? {}).filter(isIdentity);
  if (!valid.length) throw new Error('Backup contains no valid identities');

  // Re-key by uniqueString so a tampered map can't smuggle mismatched keys.
  return Object.fromEntries(valid.map((k) => [k.uniqueString, k]));
};

// --- browser glue -------------------------------------------------------

export const exportIdentities = async (password?: string): Promise<void> => {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem('keyPairs');
  const keyPairs: IdentityMap = raw ? JSON.parse(raw) : {};
  const text = await serializeBackup(keyPairs, password);

  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sma-identities-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// Merges restored identities into whatever is already stored (never destroys
// existing ones). Returns how many were newly added vs. already present.
export const importIdentities = async (
  fileText: string,
  password?: string
): Promise<{ added: number; total: number }> => {
  if (typeof window === 'undefined') return { added: 0, total: 0 };
  const restored = await deserializeBackup(fileText, password);

  const existingRaw = localStorage.getItem('keyPairs');
  const existing: IdentityMap = existingRaw ? JSON.parse(existingRaw) : {};

  let added = 0;
  for (const [id, pair] of Object.entries(restored)) {
    if (!existing[id]) added++;
    existing[id] = pair;
  }
  localStorage.setItem('keyPairs', JSON.stringify(existing));
  return { added, total: Object.keys(restored).length };
};
