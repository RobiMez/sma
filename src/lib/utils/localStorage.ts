import type { IKeyPairs } from '$lib/types';
import { ResetPgpIdentity } from './pgp';

/**
 * Clears all items from localStorage except for a few critical items:
 * - loadedPair: Currently active PGP key pair
 * - keyPairs: All stored PGP key pairs

 * - theme: Current UI theme setting
 *
 * This is used to clean up localStorage while preserving essential application state.
 * The function first saves the critical items, clears everything, then restores just those items.
 */
export const clearLS = () => {
  // Check if we're running in a browser environment
  if (typeof window === 'undefined') {
    console.log('clearLS: Not in browser environment, returning early');
    return;
  }

  console.log('clearLS: Starting localStorage cleanup');

  // Save critical items before clearing
  const loadedPair = localStorage.getItem('loadedPair');
  const keyPairs = localStorage.getItem('keyPairs');

  const theme = localStorage.getItem('theme');

  console.log('clearLS: Saved critical items:', {
    hasLoadedPair: loadedPair,
    hasKeyPairs: keyPairs,
    hasTheme: theme
  });

  // Clear all localStorage
  localStorage.clear();
  console.log('clearLS: Cleared localStorage');

  // Restore critical items if they existed
  if (loadedPair) {
    localStorage.setItem('loadedPair', loadedPair);
    console.log('clearLS: Restored loadedPair');
  }
  if (keyPairs) {
    localStorage.setItem('keyPairs', keyPairs);
    console.log('clearLS: Restored keyPairs');
  }

  if (theme) {
    localStorage.setItem('theme', theme);
    console.log('clearLS: Restored theme');
  }

  console.log('clearLS: Cleanup complete');
};

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
  return keyPair as IKeyPairs;
};

export const getAllFromLS = async () => {
  if (typeof window === 'undefined') return [];
  let existingEntries = localStorage.getItem('keyPairs');
  // if no keypair in keypairs , generate one and set it
  if (!existingEntries) {
    const newPair = await ResetPgpIdentity();
    if (!newPair) throw new Error('Error generating genesis identity in getAllFromLS');
    saveToLS(
      newPair?.privateKey,
      newPair?.publicKey,
      newPair?.revocationCertificate,
      newPair?.uniqueString
    );

    existingEntries = localStorage.getItem('keyPairs');
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const keyPairs = JSON.parse(existingEntries!);

  return Object.values(keyPairs) as IKeyPairs[];
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
  if (typeof window === 'undefined') return undefined;
  const loadedPair = localStorage.getItem('loadedPair');
  // if there is no localstorage item with the key 'loadedPair'
  // set the first keypair in localstorage as the loaded pair
  if (!loadedPair) {
    const keyPairs = await getAllFromLS();
    // make a new keypair if none exist in ls

    if (!keyPairs) return undefined;
    localStorage.setItem('loadedPair', JSON.stringify(keyPairs[0]));
    return keyPairs[0];
  }

  return JSON.parse(loadedPair) as IKeyPairs | undefined;
};
