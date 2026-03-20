// v25.3: Analytics API — fetches Vercel Web Analytics data
// Env vars: VERCEL_ANALYTICS_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return res.status(500).json({ error: 'Missing Vercel analytics configuration' });
  }

  const { endpoint, from, to, limit } = req.query;
  const baseUrl = 'https://vercel.com/api/web/insights';
  const headers = { Authorization: 'Bearer ' + token };
  const teamParam = teamId ? '&teamId=' + teamId : '';

  // Default: last 30 days
  const now = new Date();
  const fromDate = from || new Date(now.getTime() - 30 * 86400000).toISOString();
  const toDate = to || now.toISOString();
  const resultLimit = limit || 20;

  try {
    if (endpoint === 'pageviews') {
      // Get page view timeseries
      const url = baseUrl + '/stats?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D' + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: errText });
      }
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (endpoint === 'pages') {
      // Top pages
      const url = baseUrl + '/path?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D&limit=' + resultLimit + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: errText });
      }
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (endpoint === 'referrers') {
      // Top referrers
      const url = baseUrl + '/referrer?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D&limit=' + resultLimit + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: errText });
      }
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (endpoint === 'countries') {
      // Top countries
      const url = baseUrl + '/country?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D&limit=' + resultLimit + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: errText });
      }
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (endpoint === 'devices') {
      // Device breakdown (os)
      const url = baseUrl + '/os?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D&limit=' + resultLimit + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: errText });
      }
      const data = await resp.json();
      return res.status(200).json(data);

    } else if (endpoint === 'browsers') {
      // Browser breakdown
      const url = baseUrl + '/browser?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D&limit=' + resultLimit + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: errText });
      }
      const data = await resp.json();
      return res.status(200).json(data);

    } else {
      // Default: return all summary data in one call
      const endpoints = ['stats', 'path', 'referrer', 'country', 'os'];
      const urls = endpoints.map(e => {
        const lim = e === 'stats' ? '' : '&limit=10';
        return baseUrl + '/' + e + '?projectId=' + projectId + '&from=' + fromDate + '&to=' + toDate + '&filter=%7B%7D' + lim + teamParam;
      });

      const results = await Promise.allSettled(urls.map(u => fetch(u, { headers }).then(r => r.json())));

      return res.status(200).json({
        stats: results[0].status === 'fulfilled' ? results[0].value : null,
        pages: results[1].status === 'fulfilled' ? results[1].value : null,
        referrers: results[2].status === 'fulfilled' ? results[2].value : null,
        countries: results[3].status === 'fulfilled' ? results[3].value : null,
        devices: results[4].status === 'fulfilled' ? results[4].value : null,
        period: { from: fromDate, to: toDate }
      });
    }

  } catch (err) {
    return res.status(500).json({ error: 'Analytics fetch failed', message: err.message });
  }
};
