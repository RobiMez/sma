import * as openpgp from 'openpgp';
import { PUBLIC_PGP_PASSPHRASE } from '$env/static/public';
import { createShortHash } from './hashing';
import { apiUrl } from '$lib/api';

export const ResetPgpIdentity = async () => {
  const data = {
    privateKey: '',
    publicKey: '',
    revocationCertificate: '',
    uniqueString: ''
  };
  let resp: any = null;

  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: 'Anon', email: 'Sma@robi.work' }],
    passphrase: PUBLIC_PGP_PASSPHRASE,
    format: 'armored'
  });

  data.privateKey = privateKey;
  data.publicKey = publicKey;
  data.revocationCertificate = revocationCertificate;
  data.uniqueString = await createShortHash(privateKey + publicKey, 12);

  // Save the data to the server
  const response = await fetch(apiUrl('/api/pgp'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pbKey: data.publicKey,
      rid: data.uniqueString
    })
  });

  resp = await response.json();

  if (!resp) return;

  // The server never sends an `.error` field — every response here is
  // `{ status, body }` (see CLAUDE.md). Checking `.error` was always false,
  // so a failed registration (e.g. the DB unreachable) was silently treated
  // as success and the resulting identity got saved to localStorage anyway
  // — an identity the server has no record of, permanently unable to
  // receive messages until re-registered. Check the real status field.
  if (resp.status !== 200) {
    console.error('Failed to register PGP identity:', resp.body);
    return;
  }

  console.log(resp.body);
  return data;
};
