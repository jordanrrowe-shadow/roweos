// v18.9: Fetch website metadata for Digital Presence import
// Extracts title, description, OG tags, favicon, and social media links from a URL

// v34.111: SSRF defenses. Reject IPv4 in private + reserved ranges (RFC 1918,
// loopback, link-local, broadcast, multicast, cloud metadata 169.254.169.254),
// IPv6 loopback ::1, IPv6 link-local fe80::/10, IPv6 unique-local fc00::/7,
// and known cloud metadata hostnames (metadata.google.internal etc).
function isPublicHostname(hostnameRaw) {
  if (!hostnameRaw) return false;
  // strip IPv6 brackets
  var h = String(hostnameRaw).toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  // hostname-based blocks
  if (h === 'localhost' || h === 'metadata.google.internal' || h === 'metadata') return false;
  if (h.indexOf('.localhost') === h.length - '.localhost'.length && h.length > '.localhost'.length) return false;
  // IPv6 - any colon means IPv6 literal here
  if (h.indexOf(':') !== -1) {
    if (h === '::' || h === '::1' || h === '0:0:0:0:0:0:0:0' || h === '0:0:0:0:0:0:0:1') return false;
    // link-local fe80::/10
    if (/^fe[89ab][0-9a-f]?:/.test(h)) return false;
    // unique-local fc00::/7
    if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return false;
    // IPv4-mapped IPv6 ::ffff:a.b.c.d - extract and re-check
    var mapped = h.match(/^::ffff:([0-9.]+)$/);
    if (mapped && !isPublicIPv4(mapped[1])) return false;
    return true;
  }
  // pure IPv4 dotted quad
  if (/^[0-9.]+$/.test(h)) {
    return isPublicIPv4(h);
  }
  // hostname (DNS name) - allowed. The actual address resolution happens in
  // node fetch; the safe-redirect layer re-validates each redirect hop, but
  // a malicious DNS could still resolve to a private IP. For full coverage
  // we'd need a DNS lookup + revalidation here; the redirect re-check covers
  // the common attack vector (open redirect to metadata host).
  return true;
}

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
  if (a >= 240) return false;                                 // reserved + broadcast 255.255.255.255
  return true;
}

// Manual redirect follower. Re-validates the hostname on every hop so a public
// allowed URL can't 302 you into the cloud metadata endpoint or a private host.
async function fetchWithSafeRedirects(initialUrl, options, maxHops) {
  var current = initialUrl;
  var hops = 0;
  var opts = Object.assign({}, options || {}, { redirect: 'manual' });
  while (true) {
    var resp = await fetch(current, opts);
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
      hops++;
      if (hops > (maxHops || 5)) {
        throw new Error('Too many redirects');
      }
      var loc;
      try { loc = new URL(resp.headers.get('location'), current); } catch (e) {
        throw new Error('Bad redirect target');
      }
      if (loc.protocol !== 'http:' && loc.protocol !== 'https:') {
        throw new Error('Redirect to non-http(s) blocked');
      }
      if (loc.port && loc.port !== '' && loc.port !== '80' && loc.port !== '443') {
        throw new Error('Redirect to custom port blocked');
      }
      if (!isPublicHostname(loc.hostname)) {
        throw new Error('Redirect to private/local host blocked');
      }
      current = loc.href;
      continue;
    }
    return resp;
  }
}

export default async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    var url = body && body.url;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Basic URL validation
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    url = url.replace(/\/+$/, ''); // Strip trailing slashes

    var parsed;
    try { parsed = new URL(url); } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // v34.111: Hardened SSRF block. Previous version missed IPv6 loopback,
    // link-local 169.254.x.x (cloud metadata at 169.254.169.254 returns IAM
    // creds on AWS/GCP/Azure), 0.0.0.0, the proper 172.16-31 private range,
    // and the bare-prefix `172.` rule was both incorrect (172.0.x and
    // 172.32-255.x are NOT private) and incomplete. Also adds an IPv4-octet
    // allow check + protocol allowlist + port restriction. Redirects are
    // now manually re-validated per hop instead of `redirect: 'follow'`.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only http(s) URLs allowed' });
    }
    if (parsed.port && parsed.port !== '' && parsed.port !== '80' && parsed.port !== '443') {
      return res.status(400).json({ error: 'Custom ports not allowed' });
    }
    if (!isPublicHostname(parsed.hostname)) {
      return res.status(400).json({ error: 'Private or local URLs not allowed' });
    }

    // Fetch with timeout. Manual redirect handling so each hop is re-validated
    // - prevents an allowed public host from redirecting into 169.254.169.254.
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 8000);
    var response = await fetchWithSafeRedirects(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RoweOS-MetaFetcher/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    }, 5);
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch: HTTP ' + response.status });
    }

    var contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('text/html') === -1 && contentType.indexOf('application/xhtml') === -1) {
      return res.status(400).json({ error: 'URL did not return HTML content' });
    }

    // v20.6: Read full HTML for content extraction
    // Strip heavy binary elements BEFORE truncating (base64 img tags can be 100KB+ each)
    var fullHtml = await response.text();

    var mode = body && body.mode || 'meta';
    if (mode === 'content') {
      // Step 1: Strip img tags first (biggest payload — base64 data URLs)
      // Use regex that handles both closed <img .../> and unclosed truncation
      var text = fullHtml
        .replace(/<img\b[^>]*(?:>|$)/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<picture[\s\S]*?<\/picture>/gi, '')
        .replace(/<video[\s\S]*?<\/video>/gi, '')
        .replace(/<audio[\s\S]*?<\/audio>/gi, '')
        .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      // Cap at 12000 chars for AI context
      if (text.length > 12000) text = text.substring(0, 12000) + '...';
      var titleMatch2 = fullHtml.substring(0, 50000).match(/<title[^>]*>([^<]*)<\/title>/i);
      return res.status(200).json({
        url: parsed.href,
        title: titleMatch2 ? titleMatch2[1].trim() : '',
        content: text
      });
    }

    if (mode === 'deep') {
      // Extract page content (same stripping logic as content mode)
      var textDeep = fullHtml
        .replace(/<img\b[^>]*(?:>|$)/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<picture[\s\S]*?<\/picture>/gi, '')
        .replace(/<video[\s\S]*?<\/video>/gi, '')
        .replace(/<audio[\s\S]*?<\/audio>/gi, '')
        .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (textDeep.length > 12000) textDeep = textDeep.substring(0, 12000) + '...';

      // Use first 100KB for tag parsing
      var htmlDeep = fullHtml.substring(0, 100000);

      // Extract title
      var titleMatchDeep = htmlDeep.match(/<title[^>]*>([^<]*)<\/title>/i);
      var titleDeep = titleMatchDeep ? titleMatchDeep[1].trim() : '';

      // Extract meta tags (description, og:image)
      var descDeep = '';
      var ogImageDeep = '';
      var metaRegexDeep = /<meta\s+[^>]*>/gi;
      var metaMatchDeep;
      while ((metaMatchDeep = metaRegexDeep.exec(htmlDeep)) !== null) {
        var tagDeep = metaMatchDeep[0];
        var nameMatchDeep = tagDeep.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
        var contentMatchDeep = tagDeep.match(/content\s*=\s*["']([^"']+)["']/i);
        if (nameMatchDeep && contentMatchDeep) {
          var nameDeep = nameMatchDeep[1].toLowerCase();
          var contentDeep = contentMatchDeep[1];
          if ((nameDeep === 'description' || nameDeep === 'og:description') && !descDeep) descDeep = contentDeep;
          if (nameDeep === 'og:title' && !titleDeep) titleDeep = contentDeep;
          if (nameDeep === 'og:image' && !ogImageDeep) ogImageDeep = contentDeep;
        }
      }

      // Extract favicon
      var faviconDeep = '';
      var faviconMatchDeep = htmlDeep.match(/<link[^>]*rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href\s*=\s*["']([^"']+)["']/i);
      if (!faviconMatchDeep) faviconMatchDeep = htmlDeep.match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
      if (faviconMatchDeep) {
        var faviconUrlDeep = faviconMatchDeep[1];
        if (faviconUrlDeep.startsWith('//')) faviconUrlDeep = 'https:' + faviconUrlDeep;
        else if (faviconUrlDeep.startsWith('/')) faviconUrlDeep = parsed.origin + faviconUrlDeep;
        else if (!faviconUrlDeep.startsWith('http')) faviconUrlDeep = parsed.origin + '/' + faviconUrlDeep;
        faviconDeep = faviconUrlDeep;
      }
      if (!faviconDeep) faviconDeep = parsed.origin + '/favicon.ico';

      // Make ogImage absolute
      if (ogImageDeep && !ogImageDeep.startsWith('http')) {
        if (ogImageDeep.startsWith('//')) ogImageDeep = 'https:' + ogImageDeep;
        else if (ogImageDeep.startsWith('/')) ogImageDeep = parsed.origin + ogImageDeep;
        else ogImageDeep = parsed.origin + '/' + ogImageDeep;
      }

      // Extract social links
      var socialLinksDeep = {};
      var linkRegexDeep = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
      var linkMatchDeep;
      var socialPatternsDeep = {
        x: [/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/],
        threads: [/threads\.net\/@?([a-zA-Z0-9_.]+)/],
        instagram: [/instagram\.com\/([a-zA-Z0-9_.]+)/],
        facebook: [/facebook\.com\/([a-zA-Z0-9_.]+)/],
        linkedin: [/linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_-]+)/],
        youtube: [/youtube\.com\/(?:@|channel\/|c\/)?([a-zA-Z0-9_-]+)/],
        tiktok: [/tiktok\.com\/@([a-zA-Z0-9_.]+)/]
      };
      while ((linkMatchDeep = linkRegexDeep.exec(htmlDeep)) !== null) {
        var hrefDeep = linkMatchDeep[1];
        for (var platformDeep in socialPatternsDeep) {
          var patternsDeep = socialPatternsDeep[platformDeep];
          for (var pi = 0; pi < patternsDeep.length; pi++) {
            var mDeep = hrefDeep.match(patternsDeep[pi]);
            if (mDeep && mDeep[1] && !socialLinksDeep[platformDeep]) {
              var handleDeep = mDeep[1].toLowerCase();
              if (['share', 'intent', 'sharer', 'home', 'explore', 'search', 'about', 'help', 'login', 'signup', 'policy', 'terms'].indexOf(handleDeep) === -1) {
                socialLinksDeep[platformDeep] = { handle: mDeep[1], url: hrefDeep };
              }
            }
          }
        }
      }

      // Discover internal links
      var internalLinks = [];
      var seenDeep = {};
      var skipExtDeep = /\.(pdf|zip|png|jpg|jpeg|gif|webp|svg|mp4|mp3|mov|avi|exe|dmg|pkg|docx?|xlsx?|pptx?)(\?|$)/i;
      var aTagRegex = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      var aMatch;
      var priorityPatternsDeep = [
        { re: /\/(about|team|people|who-we-are)\b/i, priority: 1 },
        { re: /\/(services|products|offerings|solutions|pricing|features|what-we-do)\b/i, priority: 2 },
        { re: /\/(blog|news|press|media|articles|resources|insights)\b/i, priority: 3 },
        { re: /\/(contact|location|get-in-touch|support)\b/i, priority: 4 }
      ];
      while ((aMatch = aTagRegex.exec(htmlDeep)) !== null) {
        var rawHref = aMatch[1].trim();
        var rawText = aMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) continue;
        if (skipExtDeep.test(rawHref)) continue;
        var absDeep;
        try {
          absDeep = new URL(rawHref, parsed.origin).href;
        } catch (e) { continue; }
        var absUrlDeep = new URL(absDeep);
        if (absUrlDeep.hostname !== parsed.hostname) continue;
        // Dedup: strip hash and trailing slash
        var cleanDeep = absDeep.replace(/#[^?]*$/, '').replace(/\/+$/, '');
        if (seenDeep[cleanDeep]) continue;
        seenDeep[cleanDeep] = true;
        var priorityDeep = 5;
        for (var pp = 0; pp < priorityPatternsDeep.length; pp++) {
          if (priorityPatternsDeep[pp].re.test(absUrlDeep.pathname)) {
            priorityDeep = priorityPatternsDeep[pp].priority;
            break;
          }
        }
        internalLinks.push({ url: cleanDeep, text: rawText, priority: priorityDeep });
      }
      internalLinks.sort(function(a, b) { return a.priority - b.priority; });
      internalLinks = internalLinks.slice(0, 30);

      return res.status(200).json({
        url: parsed.href,
        domain: parsed.hostname,
        title: titleDeep,
        description: descDeep,
        ogImage: ogImageDeep,
        favicon: faviconDeep,
        socialLinks: socialLinksDeep,
        content: textDeep,
        links: internalLinks
      });
    }

    // For meta mode, truncate to 100KB (no base64 img issue since we only parse meta tags)
    var html = fullHtml.substring(0, 100000);

    var result = {
      url: parsed.href,
      domain: parsed.hostname,
      title: '',
      description: '',
      ogImage: '',
      favicon: '',
      socialLinks: {}
    };

    // Extract <title>
    var titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim();

    // Extract meta tags
    var metaRegex = /<meta\s+[^>]*>/gi;
    var metaMatch;
    while ((metaMatch = metaRegex.exec(html)) !== null) {
      var tag = metaMatch[0];
      var nameMatch = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
      var contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/i);
      if (nameMatch && contentMatch) {
        var name = nameMatch[1].toLowerCase();
        var content = contentMatch[1];
        if (name === 'description' && !result.description) result.description = content;
        if (name === 'og:description' && !result.description) result.description = content;
        if (name === 'og:title' && !result.title) result.title = content;
        if (name === 'og:image' && !result.ogImage) result.ogImage = content;
      }
    }

    // Extract favicon
    var faviconMatch = html.match(/<link[^>]*rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href\s*=\s*["']([^"']+)["']/i);
    if (!faviconMatch) faviconMatch = html.match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
    if (faviconMatch) {
      var faviconUrl = faviconMatch[1];
      if (faviconUrl.startsWith('//')) faviconUrl = 'https:' + faviconUrl;
      else if (faviconUrl.startsWith('/')) faviconUrl = parsed.origin + faviconUrl;
      else if (!faviconUrl.startsWith('http')) faviconUrl = parsed.origin + '/' + faviconUrl;
      result.favicon = faviconUrl;
    }
    if (!result.favicon) result.favicon = parsed.origin + '/favicon.ico';

    // Make ogImage absolute
    if (result.ogImage && !result.ogImage.startsWith('http')) {
      if (result.ogImage.startsWith('//')) result.ogImage = 'https:' + result.ogImage;
      else if (result.ogImage.startsWith('/')) result.ogImage = parsed.origin + result.ogImage;
      else result.ogImage = parsed.origin + '/' + result.ogImage;
    }

    // Extract social links from <a> tags
    var linkRegex = /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
    var linkMatch;
    var socialPatterns = {
      x: [/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/],
      threads: [/threads\.net\/@?([a-zA-Z0-9_.]+)/],
      instagram: [/instagram\.com\/([a-zA-Z0-9_.]+)/],
      facebook: [/facebook\.com\/([a-zA-Z0-9_.]+)/],
      linkedin: [/linkedin\.com\/(?:in|company)\/([a-zA-Z0-9_-]+)/],
      youtube: [/youtube\.com\/(?:@|channel\/|c\/)?([a-zA-Z0-9_-]+)/],
      tiktok: [/tiktok\.com\/@([a-zA-Z0-9_.]+)/]
    };

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      var href = linkMatch[1];
      for (var platform in socialPatterns) {
        var patterns = socialPatterns[platform];
        for (var i = 0; i < patterns.length; i++) {
          var m = href.match(patterns[i]);
          if (m && m[1] && !result.socialLinks[platform]) {
            // Skip generic pages
            var handle = m[1].toLowerCase();
            if (['share', 'intent', 'sharer', 'home', 'explore', 'search', 'about', 'help', 'login', 'signup', 'policy', 'terms'].indexOf(handle) === -1) {
              result.socialLinks[platform] = { handle: m[1], url: href };
            }
          }
        }
      }
    }

    return res.status(200).json(result);

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timed out' });
    }
    return res.status(500).json({ error: 'Fetch failed: ' + (err.message || 'Unknown error') });
  }
}
