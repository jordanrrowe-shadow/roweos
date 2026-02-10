// v15.0: Vercel Edge Middleware - Auth Gate
// Redirects unauthenticated requests to login.html

export const config = {
  matcher: ['/((?!api|login\\.html|_next|favicon\\.ico|apple-touch-icon\\.png|manifest\\.json|icons|.*\\.js|.*\\.css).*)']
};

export default function middleware(request) {
  const cookie = request.cookies.get('roweos_session');

  if (!cookie || !cookie.value) {
    const url = new URL('/login.html', request.url);
    return Response.redirect(url, 302);
  }

  // Basic JWT expiry check (decode payload without verification)
  try {
    const parts = cookie.value.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        // Token expired - redirect to login
        const url = new URL('/login.html', request.url);
        const response = Response.redirect(url, 302);
        // Clear expired cookie
        response.headers.set('Set-Cookie', 'roweos_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
        return response;
      }
    }
  } catch (e) {
    // If we can't parse the token, let the client-side auth gate handle it
  }

  // Valid session - pass through
  return undefined;
}
