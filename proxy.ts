import { NextResponse } from 'next/server';

/**
 * Next.js Middleware — Security Headers & Request Handling
 *
 * The standard @supabase/supabase-js client stores auth tokens in
 * localStorage (browser-only), so server-side cookie checks are not
 * possible without migrating to @supabase/ssr.
 *
 * Auth protection is handled client-side by each page component
 * (Sidebar, Dashboard, Admin, Practice all check getCurrentProfile()
 * and redirect to /auth when no session is found).
 *
 * This middleware adds production security headers to every response.
 */

export function proxy() {
  const response = NextResponse.next();

  // ── Security Headers ──
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  // Prevent MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Enable XSS filter in older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy — restrict sensitive APIs
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all routes except static assets:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
