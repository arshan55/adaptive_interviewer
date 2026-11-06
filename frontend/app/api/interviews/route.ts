import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:5000';

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const token = headersList.get('authorization');

    const body = await request.json();

    console.log('Frontend /api/interviews POST received. Forwarding to backend...');
    console.log('Backend URL for interviews:', `${BACKEND_URL}/api/interviews`);

    const response = await fetch(`${BACKEND_URL}/api/interviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token || '', // Forward authorization token
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText || 'Failed to start interview' };
      }
      console.error('Error forwarding interview request to backend:', response.status, errorData);
      return new NextResponse(
        JSON.stringify({ error: errorData.error || 'Failed to start interview' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new NextResponse(
      JSON.stringify(data),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in frontend /api/interviews POST route:', error.message, error.stack);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error at frontend interviews proxy' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 