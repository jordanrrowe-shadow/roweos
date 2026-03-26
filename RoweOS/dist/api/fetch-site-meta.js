// v18.9: Fetch website metadata for Digital Presence import
// Extracts title, description, OG tags, favicon, and social media links from a URL

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
