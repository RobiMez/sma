export const createShortHash = async (input: string, length: number): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));

  const base64url = hashString.replace('+', '-').replace('/', '_').replace(/=+$/, '');
  return base64url.substring(0, length);
};
