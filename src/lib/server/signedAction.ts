import * as openpgp from 'openpgp';
import Listener from '../../models/listener.schema';

// How long a signed mutation stays valid. The protected actions are all
// idempotent (set title / webhook / flag), so a bounded replay window is an
// acceptable trade against keeping a server-side nonce store.
const SIGNATURE_TTL_MS = 5 * 60 * 1000;

interface SignedActionOk {
  ok: true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listener: any;
  params: Record<string, unknown>;
}

interface SignedActionErr {
  ok: false;
  status: number;
  message: string;
}

// Verifies that a mutation was signed by the private key matching the
// listener's registered pbKey. The rid alone is public (it's in the share
// link), so it must never authorize anything by itself. Params are taken
// from the signed payload — never from unsigned parts of the request.
export async function verifySignedAction(
  body: unknown,
  expectedAction: string
): Promise<SignedActionOk | SignedActionErr> {
  const { rid, signed } = (body ?? {}) as { rid?: unknown; signed?: unknown };
  if (typeof rid !== 'string' || typeof signed !== 'string') {
    return { ok: false, status: 400, message: 'Missing rid or signed payload' };
  }

  const listener = await Listener.findOne({ rid });
  if (!listener) return { ok: false, status: 404, message: 'Listener not found' };

  let payloadText: string;
  try {
    const publicKey = await openpgp.readKey({ armoredKey: listener.pbKey });
    const message = await openpgp.readMessage({ armoredMessage: signed });
    const { data, signatures } = await openpgp.verify({
      message,
      verificationKeys: publicKey,
      expectSigned: true
    });
    await signatures[0].verified;
    payloadText = String(data);
  } catch {
    return { ok: false, status: 403, message: 'Invalid signature' };
  }

  let payload: { action?: unknown; rid?: unknown; ts?: unknown; params?: unknown };
  try {
    payload = JSON.parse(payloadText);
  } catch {
    return { ok: false, status: 400, message: 'Malformed signed payload' };
  }

  if (payload.action !== expectedAction || payload.rid !== rid) {
    return { ok: false, status: 403, message: 'Signed payload does not match request' };
  }
  if (typeof payload.ts !== 'number' || Math.abs(Date.now() - payload.ts) > SIGNATURE_TTL_MS) {
    return { ok: false, status: 403, message: 'Signed payload expired' };
  }

  const params =
    payload.params && typeof payload.params === 'object'
      ? (payload.params as Record<string, unknown>)
      : {};

  return { ok: true, listener, params };
}
