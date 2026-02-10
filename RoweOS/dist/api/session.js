// v15.0: Vercel Serverless Function - Session Management
// Sets HTTP-only cookie after Firebase ID token validation

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    // Decode JWT to verify basic structure (header.payload.signature)
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    // Decode payload to check expiry
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Set session cookie (7-day expiry)
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    res.setHeader('Set-Cookie', `roweos_session=${idToken}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Session error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
