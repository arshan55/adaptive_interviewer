import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:5000';

export async function GET(
  request: NextRequest,
  context: { params: { questionId: string } | Promise<{ questionId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const resolvedParams = await Promise.resolve(context.params);
    const questionId = resolvedParams.questionId;

    const response = await fetch(`${BACKEND_URL}/api/interviews/coding-problem/${questionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to proxy coding-problem details', details: err.message },
      { status: 500 }
    );
  }
}
