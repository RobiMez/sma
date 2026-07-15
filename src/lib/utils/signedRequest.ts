import * as openpgp from 'openpgp';
import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';
import { getFromLS } from './localStorage';
import { apiUrl } from '$lib/api';

// Owner-only API mutations are authorized by a PGP signature, not by knowing
// the rid — the rid is public, it's in the share link. The signed payload
// carries the action name, rid, params and a timestamp; the server verifies
// it against the pbKey registered for that rid.
export const signAction = async (
  rid: string,
  action: string,
  params: Record<string, unknown> = {}
): Promise<{ rid: string; signed: string }> => {
  const pair = await getFromLS(rid);
  if (!pair) throw new Error(`No keypair stored in this browser for room ${rid}`);

  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: pair.prKey }),
    passphrase: PUBLIC_PGP_PASSPHRASE
  });

  const payload = JSON.stringify({ action, rid, ts: Date.now(), params });
  const signed = (await openpgp.sign({
    message: await openpgp.createMessage({ text: payload }),
    signingKeys: privateKey
  })) as string;

  return { rid, signed };
};

export const signedFetch = async (
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  rid: string,
  action: string,
  params: Record<string, unknown> = {}
) => {
  const body = await signAction(rid, action, params);
  const response = await fetch(apiUrl(url), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
};
