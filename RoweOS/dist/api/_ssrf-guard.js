// v35.12: Shared SSRF guard extracted from fetch-site-meta.js (v34.111) so the
// email attachment-download paths (gmail-proxy.js, resend-welcome.js) can reuse
// the same hardening. Files prefixed with `_` are helper modules, NOT Vercel
// serverless functions (same convention as _email-log-helper.js), so this does
// not count against the function limit.
//
// Rejects IPv4 in private + reserved ranges (RFC 1918, loopback, link-local,
// broadcast, multicast, cloud metadata 169.254.169.254). Re-validates the
// hostname on every redirect hop so an allowed public URL can't 302 into the
// cloud metadata endpoint or a private host.

function isPublicIPv4(ip) {
  var parts = String(ip).split('.');
  if (parts.length !== 4) return false;
  var a = parseInt(parts[0], 10);
  var b = parseInt(parts[1], 10);
  var c = parseInt(parts[2], 10);
  var d = parseInt(parts[3], 10);
  if ([a, b, c, d].some(function(n) { return isNaN(n) || n < 0 || n > 255; })) return false;
  if (a === 0) return false;                                  // 0.0.0.0/8
  if (a === 10) return false;                                 // 10.0.0.0/8 RFC1918
  if (a === 127) return false;                                // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return false;                   // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;          // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 0 && c === 0) return false;          // 192.0.0.0/24 IETF
  if (a === 192 && b === 0 && c === 2) return false;          // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return false;                   // 192.168.0.0/16 RFC1918
  if (a === 198 && (b === 18 || b === 19)) return false;      // 198.18.0.0/15 benchmark
  if (a === 198 && b === 51 && c === 100) return false;       // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false;        // TEST-NET-3
  if (a >= 224 && a <= 239) return false;                     // multicast
  if (a >= 240) return false;                                 // reserved + broadcast
  return true;
}

// Hostname is safe if it is not an obvious private literal. Bare IPv4 literals
// are validated against the range table. Named hosts pass here (a malicious DNS
// could still resolve to a private IP; for full coverage a resolve-then-check
// would be needed, but this blocks the common metadata/loopback attacks and
// matches the fetch-site-meta.js posture).
function isPublicHostname(hostname) {
  if (!hostname) return false;
  var h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
  if (h.indexOf(':') !== -1) {
    // IPv6 — block loopback (::1), link-local (fe80::), unique-local (fc00::/fd00::),
    // and IPv4-mapped metadata.
    if (h === '::1' || h === '::' ) return false;
    if (h.indexOf('fe80') === 0 || h.indexOf('fc') === 0 || h.indexOf('fd') === 0) return false;
    if (h.indexOf('::ffff:') === 0) return isPublicIPv4(h.split(':').pop());
    return true;
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return isPublicIPv4(h);
  return true;
}

// Fetch that rejects private/local/metadata targets and re-checks every redirect
// hop. Also restricts to http/https on standard ports. Throws on any violation.
async function fetchSafe(initialUrl, options, maxHops) {
  var first;
  try { first = new URL(initialUrl); } catch (e) { throw new Error('Invalid URL'); }
  if (first.protocol !== 'http:' && first.protocol !== 'https:') throw new Error('Only http(s) URLs allowed');
  if (first.port && first.port !== '' && first.port !== '80' && first.port !== '443') throw new Error('Non-standard port blocked');
  if (!isPublicHostname(first.hostname)) throw new Error('Private/local host blocked');

  var current = first.href;
  var hops = 0;
  var opts = Object.assign({}, options || {}, { redirect: 'manual' });
  while (true) {
    var resp = await fetch(current, opts);
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
      hops++;
      if (hops > (maxHops || 5)) throw new Error('Too many redirects');
      var loc;
      try { loc = new URL(resp.headers.get('location'), current); } catch (e2) { throw new Error('Bad redirect target'); }
      if (loc.protocol !== 'http:' && loc.protocol !== 'https:') throw new Error('Redirect to non-http(s) blocked');
      if (loc.port && loc.port !== '' && loc.port !== '80' && loc.port !== '443') throw new Error('Redirect to custom port blocked');
      if (!isPublicHostname(loc.hostname)) throw new Error('Redirect to private/local host blocked');
      current = loc.href;
      continue;
    }
    return resp;
  }
}

module.exports = { isPublicIPv4: isPublicIPv4, isPublicHostname: isPublicHostname, fetchSafe: fetchSafe };
