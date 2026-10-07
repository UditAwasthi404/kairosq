import { assertPublicHttpUrl, isPrivateOrLocalIp } from './url-ingest';

describe('url-ingest security', () => {
  it('accepts public https URLs', () => {
    expect(assertPublicHttpUrl('https://example.com/path').hostname).toBe(
      'example.com',
    );
  });

  it('rejects non-http schemes and localhost', () => {
    expect(() => assertPublicHttpUrl('ftp://example.com')).toThrow();
    expect(() => assertPublicHttpUrl('http://localhost/x')).toThrow();
    expect(() => assertPublicHttpUrl('http://127.0.0.1/x')).toThrow();
    expect(() => assertPublicHttpUrl('http://192.168.1.10/x')).toThrow();
    expect(() =>
      assertPublicHttpUrl('http://169.254.169.254/latest'),
    ).toThrow();
  });

  it('detects private IP ranges', () => {
    expect(isPrivateOrLocalIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('172.16.5.1')).toBe(true);
    expect(isPrivateOrLocalIp('192.168.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrLocalIp('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateOrLocalIp('::ffff:8.8.8.8')).toBe(false);
  });
});
