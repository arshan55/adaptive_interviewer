import { NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:5000';

// Ensure REDIRECT_URI is dynamic for local and production environments
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL}/api/auth/google/callback`
  : 'http://localhost:3000/api/auth/google/callback';

// Force dynamic rendering and use edge runtime
export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Timeout configuration
const TIMEOUT_MS = 30000; // 30 seconds

// Helper function to create fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    console.log('Google callback received');
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      console.error('No code provided in Google callback');
      return NextResponse.redirect(new URL('/login?error=No code provided', request.url));
    }

    console.log('Exchanging code for tokens...');
    // Exchange the code for tokens with timeout
    const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    }, 15000); // 15 second timeout for Google OAuth

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/login?error=Failed to exchange code', request.url));
    }

    const tokens = await tokenResponse.json();
    console.log('Successfully exchanged code for tokens');

    // Get user info with timeout
    console.log('Fetching user info from Google...');
    const userResponse = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }, 10000); // 10 second timeout for user info

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('User info fetch failed:', errorText);
      return NextResponse.redirect(new URL('/login?error=Failed to get user info', request.url));
    }

    const userData = await userResponse.json();
    console.log('Successfully fetched user info:', userData.email);

    // Create or update user in our backend with timeout
    console.log('Creating/updating user in backend...');
    const backendResponse = await fetchWithTimeout(`${BACKEND_URL}/api/auth/google/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        googleId: userData.id,
      }),
    }, 20000); // 20 second timeout for backend

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend user creation failed:', errorText);
      return NextResponse.redirect(new URL('/login?error=Failed to create user', request.url));
    }

    const { token } = await backendResponse.json();
    console.log('Successfully created/updated user and got token');

    // Add a script to set the token in localStorage and then redirect
    const safeToken = JSON.stringify(token);
    const html = `
      <html>
        <head>
          <meta http-equiv="Cache-Control" content="no-store" />
        </head>
        <body>
          <p>Signing you in...</p>
          <script>
            (function() {
              try {
                const token = ${safeToken};
                console.log('Setting token:', token.substring(0, 20) + '...');
                localStorage.setItem('token', token);
                console.log('Token set, reloading...');
                window.location.href = '/';
              } catch (e) {
                console.error('Failed to set token:', e);
                window.location.href = '/login?error=Token storage failed';
              }
            })();
          </script>
          <noscript>
            <meta http-equiv="refresh" content="0;url=/" />
          </noscript>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error in Google callback:', error);
    
    // Handle specific timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.redirect(new URL('/login?error=Request timeout - please try again', request.url));
    }
    
    return NextResponse.redirect(new URL('/login?error=Internal server error', request.url));
  }
} 