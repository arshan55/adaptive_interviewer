import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:5000';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: 'Authorization header is required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const acceptHeader = headersList.get('accept') || 'application/json';
    const body = await request.json();

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'Accept': acceptHeader,
    };

    const backendResponse = await fetch(`${BACKEND_URL}/api/interviews/${id}/turn`, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText || 'Failed to submit turn' };
      }
      return new NextResponse(
        JSON.stringify({ error: errorData.detail || errorData.msg || errorData.error || 'Failed to submit turn' }),
        {
          status: backendResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const contentType = backendResponse.headers.get('content-type') || '';

    // If backend returned SSE stream, stream it directly to client
    if (contentType.includes('text/event-stream') && backendResponse.body) {
      return new Response(backendResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Otherwise return standard JSON response
    const data = await backendResponse.json();
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in frontend /api/interviews/[id]/turn POST route:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error at turn proxy', details: error?.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

