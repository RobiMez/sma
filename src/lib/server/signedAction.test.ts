import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import * as openpgp from 'openpgp';

vi.mock('../../models/listener.schema', () => ({
  default: { findOne: vi.fn() }
}));

import Listener from '../../models/listener.schema';
import { verifySignedAction } from './signedAction';

const RID = 'test-rid-1234';
const PASSPHRASE = 'test-passphrase';

let ownerPublicKey: string;
let ownerPrivateKey: string;
let attackerPrivateKey: string;

const generatePair = async () => {
  return openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: 'Anon', email: 'Sma@robi.work' }],
    passphrase: PASSPHRASE,
    format: 'armored'
  });
};

// Mirrors signAction in $lib/utils/signedRequest.ts.
const sign = async (
  armoredPrivateKey: string,
  payload: Record<string, unknown>
): Promise<string> => {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey }),
    passphrase: PASSPHRASE
  });
  return (await openpgp.sign({
    message: await openpgp.createMessage({ text: JSON.stringify(payload) }),
    signingKeys: privateKey
  })) as string;
};

beforeAll(async () => {
  const owner = await generatePair();
  ownerPublicKey = owner.publicKey;
  ownerPrivateKey = owner.privateKey;
  const attacker = await generatePair();
  attackerPrivateKey = attacker.privateKey;
});

beforeEach(() => {
  vi.mocked(Listener.findOne).mockReset();
  vi.mocked(Listener.findOne).mockResolvedValue({ rid: RID, pbKey: ownerPublicKey });
});

describe('verifySignedAction', () => {
  it('accepts a fresh payload signed by the room owner', async () => {
    const signed = await sign(ownerPrivateKey, {
      action: 'webhook:set',
      rid: RID,
      ts: Date.now(),
      params: { webhookUrl: 'https://example.com/hook' }
    });

    const verdict = await verifySignedAction({ rid: RID, signed }, 'webhook:set');
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.params.webhookUrl).toBe('https://example.com/hook');
    }
  });

  it('rejects a payload signed by a different key', async () => {
    const signed = await sign(attackerPrivateKey, {
      action: 'webhook:set',
      rid: RID,
      ts: Date.now(),
      params: { webhookUrl: 'https://evil.example/hook' }
    });

    const verdict = await verifySignedAction({ rid: RID, signed }, 'webhook:set');
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects an unsigned/garbage payload', async () => {
    const verdict = await verifySignedAction(
      { rid: RID, signed: 'not-a-pgp-message' },
      'webhook:set'
    );
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects a signature replayed for a different action', async () => {
    const signed = await sign(ownerPrivateKey, {
      action: 'profanity:set',
      rid: RID,
      ts: Date.now(),
      params: {}
    });

    const verdict = await verifySignedAction({ rid: RID, signed }, 'webhook:set');
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects a payload whose rid does not match the request rid', async () => {
    const signed = await sign(ownerPrivateKey, {
      action: 'webhook:set',
      rid: 'other-room-99',
      ts: Date.now(),
      params: {}
    });

    const verdict = await verifySignedAction({ rid: RID, signed }, 'webhook:set');
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects an expired payload', async () => {
    const signed = await sign(ownerPrivateKey, {
      action: 'webhook:set',
      rid: RID,
      ts: Date.now() - 10 * 60 * 1000,
      params: {}
    });

    const verdict = await verifySignedAction({ rid: RID, signed }, 'webhook:set');
    expect(verdict).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects non-string rid/signed (query-selector injection shapes)', async () => {
    const verdict = await verifySignedAction({ rid: { $ne: null }, signed: 'x' }, 'webhook:set');
    expect(verdict).toMatchObject({ ok: false, status: 400 });
    expect(Listener.findOne).not.toHaveBeenCalled();
  });

  it('404s for an unknown listener', async () => {
    vi.mocked(Listener.findOne).mockResolvedValue(null);
    const verdict = await verifySignedAction({ rid: RID, signed: 'x' }, 'webhook:set');
    expect(verdict).toMatchObject({ ok: false, status: 404 });
  });
});
