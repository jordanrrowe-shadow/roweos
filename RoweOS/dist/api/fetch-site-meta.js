// v18.9: Fetch website metadata for Digital Presence import
// Extracts title, description, OG tags, favicon, and social media links from a URL

export default async function handler(req, res) {
  var origin = req.headers.origin || '';
  if (origin === 'https://roweos.vercel.app' || origin === 'https://roweos.com' || origin === 'https://www.roweos.com') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://roweos.vercel.app');
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

    var parsed;
    try { parsed = new URL(url); } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Block internal/private IPs
    var hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return res.status(400).json({ error: 'Private URLs not allowed' });
    }

    // Fetch with timeout
    var controller = new AbortController();
    var timeout = setTimeout(function() { controller.abort(); }, 8000);

    var response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RoweOS-MetaFetcher/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch: HTTP ' + response.status });
    }

    var contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('text/html') === -1 && contentType.indexOf('application/xhtml') === -1) {
      return res.status(400).json({ error: 'URL did not return HTML content' });
    }

    // Read first 100KB only
    var html = await response.text();
    html = html.substring(0, 100000);

    // v20.6: Content mode — return stripped text for AI context injection
    var mode = body.mode || 'meta';
    if (mode === 'content') {
      // Strip non-content elements entirely
      var text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<picture[\s\S]*?<\/picture>/gi, '')
        .replace(/<video[\s\S]*?<\/video>/gi, '')
        .replace(/<audio[\s\S]*?<\/audio>/gi, '')
        .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/data:[a-zA-Z0-9\/+;,=]+/g, '')
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
      var titleMatch2 = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return res.status(200).json({
        url: parsed.href,
        title: titleMatch2 ? titleMatch2[1].trim() : '',
        content: text
      });
    }

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
