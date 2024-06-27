import * as openpgp from 'openpgp';
import { createShortHash } from './hashing';

export const ResetPgpIdentity = async () => {
  const data = {
    privateKey: "",
    publicKey: "",
    revocationCertificate: "",
    uniqueString: ""
  };
  let resp: any = null;


  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name: 'Anon', email: 'Sma@robi.work' }],
    passphrase: 'super long and hard to guess secret',
    format: 'armored'
  });

  data.privateKey = privateKey;
  data.publicKey = publicKey;
  data.revocationCertificate = revocationCertificate;
  data.uniqueString = await createShortHash(privateKey + publicKey, 12);

  // Save the data to the server
  const response = await fetch('/api/pgp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pbkey: data.publicKey,
      rid: data.uniqueString
    })
  });

  resp = await response.json();

  if (!resp) return;

  if (resp.error) {
    console.log(resp.message);
  } else {
    console.log(resp.message);
    console.log('data: ', data);
    return data;
  }

};
