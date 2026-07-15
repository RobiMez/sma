import { describe, it, expect } from 'vitest';
import { isSafeWebhookUrl } from './webhookGuard';

describe('isSafeWebhookUrl', () => {
  it('allows normal public http(s) URLs', () => {
    expect(isSafeWebhookUrl('https://discord.com/api/webhooks/123/abc')).toBe(true);
    expect(isSafeWebhookUrl('http://example.com/hook')).toBe(true);
    expect(isSafeWebhookUrl('https://8.8.8.8/hook')).toBe(true);
  });

  it('rejects non-http(s) schemes and garbage', () => {
    expect(isSafeWebhookUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeWebhookUrl('ftp://example.com')).toBe(false);
    expect(isSafeWebhookUrl('gopher://example.com')).toBe(false);
    expect(isSafeWebhookUrl('not a url')).toBe(false);
    expect(isSafeWebhookUrl('')).toBe(false);
  });

  it('rejects loopback and internal hostnames', () => {
    expect(isSafeWebhookUrl('http://localhost:3000/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://foo.localhost/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://printer.local/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://db.internal/hook')).toBe(false);
  });

  it('rejects private and reserved IPv4 ranges', () => {
    expect(isSafeWebhookUrl('http://127.0.0.1/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://10.1.2.3/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://172.16.0.1/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://172.31.255.255/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://192.168.1.1/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeWebhookUrl('http://100.100.0.1/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://0.0.0.0/hook')).toBe(false);
  });

  it('rejects alternate IP encodings', () => {
    expect(isSafeWebhookUrl('http://2130706433/hook')).toBe(false); // decimal 127.0.0.1
    expect(isSafeWebhookUrl('http://127.1/hook')).toBe(false); // shorthand
    expect(isSafeWebhookUrl('http://0x7f000001/hook')).toBe(false); // hex
  });

  it('rejects internal IPv6 literals', () => {
    expect(isSafeWebhookUrl('http://[::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://[fe80::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://[fd00::1]/hook')).toBe(false);
    expect(isSafeWebhookUrl('http://[::ffff:127.0.0.1]/hook')).toBe(false);
  });
});
