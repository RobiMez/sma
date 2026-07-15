// Pragmatic SSRF guard for user-supplied webhook URLs. Blocks non-http(s)
// schemes and internal/loopback/link-local targets, including decimal and
// shorthand IP encodings. Not a defence against DNS rebinding — pair with
// redirect: 'error' and a timeout at fetch time.
export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  // URL keeps IPv6 literals bracketed in hostname ("[::1]"); strip for matching.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.local') || host.endsWith('.internal')) return false;

  // Plain dotted-decimal IPv4: allow only public ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  // Every other all-digit/dotted or hex-prefixed host is an IP-literal trick
  // (http://2130706433/, http://127.1/, http://0x7f000001/).
  if (/^[\d.]+$/.test(host) || host.includes('0x')) return false;

  // IPv6 literals: loopback, unspecified, link-local, unique-local, v4-mapped.
  if (host.includes(':')) {
    return !(
      host === '::' ||
      host === '::1' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.includes('::ffff:')
    );
  }

  return true;
}
