import { describe, it, expect } from 'vitest';
import { serializeBackup, deserializeBackup } from './backup';

const sample = {
  abcdefghijkl: { prKey: 'PRIV-A', pbKey: 'PUB-A', RC: 'RC-A', uniqueString: 'abcdefghijkl' },
  mnopqrstuvwx: { prKey: 'PRIV-B', pbKey: 'PUB-B', RC: 'RC-B', uniqueString: 'mnopqrstuvwx' }
};

describe('backup serialize/deserialize', () => {
  it('round-trips unencrypted', async () => {
    const text = await serializeBackup(sample);
    const env = JSON.parse(text);
    expect(env.app).toBe('sma-backup');
    expect(env.encrypted).toBe(false);
    expect(await deserializeBackup(text)).toEqual(sample);
  });

  it('round-trips encrypted with the right password', async () => {
    const text = await serializeBackup(sample, 'correct horse');
    const env = JSON.parse(text);
    expect(env.encrypted).toBe(true);
    // Ciphertext must not leak the private keys.
    expect(text).not.toContain('PRIV-A');
    expect(await deserializeBackup(text, 'correct horse')).toEqual(sample);
  });

  it('rejects a wrong password', async () => {
    const text = await serializeBackup(sample, 'correct horse');
    await expect(deserializeBackup(text, 'battery staple')).rejects.toThrow(/wrong password/i);
  });

  it('requires a password for an encrypted backup', async () => {
    const text = await serializeBackup(sample, 'pw');
    await expect(deserializeBackup(text)).rejects.toThrow(/password-protected/i);
  });

  it('rejects non-backup JSON and garbage', async () => {
    await expect(deserializeBackup('{"hello":1}')).rejects.toThrow(/not an sma backup/i);
    await expect(deserializeBackup('not json at all')).rejects.toThrow(/not a valid backup/i);
  });

  it('refuses to export an empty identity set', async () => {
    await expect(serializeBackup({})).rejects.toThrow(/no identities/i);
  });

  it('drops malformed identities and re-keys by uniqueString', async () => {
    const messy = {
      good: { prKey: 'P', pbKey: 'B', RC: 'R', uniqueString: 'good' },
      // wrong outer key + missing prKey — the bad one must be filtered out
      WRONGKEY: { pbKey: 'B2', uniqueString: 'bad' }
    } as never;
    const text = await serializeBackup(messy);
    const out = await deserializeBackup(text);
    expect(Object.keys(out)).toEqual(['good']);
  });
});
