import { ResetPgpIdentity } from "./pgp";

export const saveToLS = (prKey: string, pbKey: string, RC: string, uniqueString: string) => {
  if (typeof window === 'undefined') return;
  const existingEntries = localStorage.getItem('keyPairs');
  const keyPairs = existingEntries ? JSON.parse(existingEntries) : {};
  keyPairs[uniqueString] = { prKey, pbKey, RC, uniqueString };
  localStorage.setItem('keyPairs', JSON.stringify(keyPairs));
};


export const getFromLS = async (uniqueString: string) => {
  if (typeof window === 'undefined') return;
  const existingEntries = localStorage.getItem('keyPairs');
  if (!existingEntries) return;
  const keyPairs = JSON.parse(existingEntries);
  const keyPair = keyPairs[uniqueString];
  if (!keyPair) return;
  return keyPair as {
    prKey: string;
    pbKey: string;
    RC: string;
    uniqueString: string;
  };
};

export const getAllFromLS = async () => {
  if (typeof window === 'undefined') return;
  let existingEntries = localStorage.getItem('keyPairs');
  // if no keypair in keypairs , generate one and set it 
  if (!existingEntries) {
    const newPair = await ResetPgpIdentity();
    if (!newPair) throw new Error("Error generating genesis identity in getAllFromLS");
    saveToLS(
      newPair?.privateKey,
      newPair?.publicKey,
      newPair?.revocationCertificate,
      newPair?.uniqueString);

    existingEntries = localStorage.getItem('keyPairs');
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const keyPairs = JSON.parse(existingEntries!);

  return Object.values(keyPairs) as Array<{
    prKey: string;
    pbKey: string;
    RC: string;
    uniqueString: string;
  }>;
};

export const postPgpKey = async (pbKey: string, rid: string) => {
  const response = await fetch('/api/pgp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pbKey,
      rid: rid
    })
  });

  const resp = await response.json();

  if (resp.error) {
    console.log(resp.message);
  } else {
    console.log(resp.message);
  }
};

// Function to load a key pair by uniqueString and store it in local storage
export const loadPair = (uniqueString: string) => {
  if (typeof window === 'undefined') return;
  const existingEntries = localStorage.getItem('keyPairs');
  if (!existingEntries) return;
  const keyPairs = JSON.parse(existingEntries);
  const keyPair = keyPairs[uniqueString];
  if (!keyPair) return;
  localStorage.setItem('loadedPair', JSON.stringify(keyPair));
};

// Utility function to fetch the loaded pair from local storage
export const getLoadedPairFromLS = async () => {
  if (typeof window === 'undefined') return null;
  const loadedPair = localStorage.getItem('loadedPair');
  // if there is no localstorage item with the key 'loadedPair'
  // set the first keypair in localstorage as the loaded pair
  if (!loadedPair) {
    const keyPairs = await getAllFromLS();
    // make a new keypair if none exist in ls 

    if (!keyPairs) return null;
    localStorage.setItem('loadedPair', JSON.stringify(keyPairs[0]));
    return keyPairs[0];
  }

  return loadedPair ? JSON.parse(loadedPair) as {
    prKey: string;
    pbKey: string;
    RC: string;
    uniqueString: string;
  } : null;
};