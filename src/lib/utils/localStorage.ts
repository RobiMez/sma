
export const saveToLS = (prKey: string, pbKey: string, RC: string, uniqueString: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('prKey', prKey);
  localStorage.setItem('pbKey', pbKey);
  localStorage.setItem('RC', RC);
  localStorage.setItem('uniqueString', uniqueString);
};


export const getFromLS = async () => {
  if (typeof window === 'undefined') return;
  const prKey = localStorage.getItem('prKey');
  const pbKey = localStorage.getItem('pbKey');
  const RC = localStorage.getItem('RC');
  const uniqueString = localStorage.getItem('uniqueString');
  return { prKey, pbKey, RC, uniqueString } as { prKey: string, pbKey: string, RC: string, uniqueString: string };
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