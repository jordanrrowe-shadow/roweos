// v25.3: Analytics API — fetches Vercel Web Analytics data
// Uses Vercel's internal web-analytics API with Bearer token auth
// Env vars: VERCEL_ANALYTICS_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (process.env.VERCEL_ANALYTICS_TOKEN || '').trim();
  const projectId = (process.env.VERCEL_PROJECT_ID || '').trim();
  const teamId = (process.env.VERCEL_TEAM_ID || '').trim();

  if (!token || !projectId) {
    return res.status(500).json({ error: 'Missing Vercel analytics configuration', hasToken: !!token, hasProject: !!projectId });
  }

  const { endpoint, from, to, limit, days } = req.query;
  const headers = { Authorization: 'Bearer ' + token };
  const resultLimit = limit || 20;

  // Calculate time range - try both ISO and epoch ms
  const now = new Date();
  const daysBack = parseInt(days) || 30;
  const fromDate = from ? new Date(from) : new Date(now.getTime() - daysBack * 86400000);
  const toDate = to ? new Date(to) : now;
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();
  const teamParam = teamId ? '&teamId=' + teamId : '';
  const env = '&environment=production';

  // Vercel Web Analytics API base
  const base = 'https://vercel.com/api/web-analytics';

  try {
    if (endpoint === 'timeseries') {
      const url = base + '/timeseries?projectId=' + projectId + '&from=' + fromIso + '&to=' + toIso + env + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: await resp.text() });
      return res.status(200).json(await resp.json());

    } else if (endpoint === 'pages') {
      const url = base + '/top-pages?projectId=' + projectId + '&from=' + fromMs + '&to=' + toMs + '&limit=' + resultLimit + env + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: await resp.text() });
      return res.status(200).json(await resp.json());

    } else if (endpoint === 'referrers') {
      const url = base + '/top-referrers?projectId=' + projectId + '&from=' + fromMs + '&to=' + toMs + '&limit=' + resultLimit + env + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: await resp.text() });
      return res.status(200).json(await resp.json());

    } else if (endpoint === 'countries') {
      const url = base + '/top-countries?projectId=' + projectId + '&from=' + fromMs + '&to=' + toMs + '&limit=' + resultLimit + env + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: await resp.text() });
      return res.status(200).json(await resp.json());

    } else if (endpoint === 'devices') {
      const url = base + '/top-devices?projectId=' + projectId + '&from=' + fromMs + '&to=' + toMs + '&limit=' + resultLimit + env + teamParam;
      const resp = await fetch(url, { headers });
      if (!resp.ok) return res.status(resp.status).json({ error: 'Vercel API error', status: resp.status, detail: await resp.text() });
      return res.status(200).json(await resp.json());

    } else {
      // Default: fetch all data in parallel
      // Timeseries uses ISO dates, breakdown endpoints use epoch ms
      const tsParams = 'projectId=' + projectId + '&from=' + fromIso + '&to=' + toIso + env + teamParam;
      const bkParams = 'projectId=' + projectId + '&from=' + fromMs + '&to=' + toMs + env + teamParam;
      const endpoints = [
        base + '/timeseries?' + tsParams,
        base + '/top-pages?limit=15&' + bkParams,
        base + '/top-referrers?limit=10&' + bkParams,
        base + '/top-countries?limit=10&' + bkParams,
        base + '/top-devices?limit=10&' + bkParams
      ];

      const results = await Promise.allSettled(
        endpoints.map(u => fetch(u, { headers }).then(async r => {
          if (!r.ok) return { error: r.status, detail: await r.text() };
          return r.json();
        }))
      );

      const getData = (idx) => results[idx].status === 'fulfilled' ? results[idx].value : null;

      return res.status(200).json({
        timeseries: getData(0),
        pages: getData(1),
        referrers: getData(2),
        countries: getData(3),
        devices: getData(4),
        period: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), days: daysBack },
        debug: { projectId, teamId: teamId || 'none', fromMs, toMs }
      });
    }

  } catch (err) {
    return res.status(500).json({ error: 'Analytics fetch failed', message: err.message });
  }
};
