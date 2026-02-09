import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();

  try {
    const response = await fetch(`${BACKEND_URL}/signals/events/feed?${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Events feed API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events feed' },
      { status: 500 }
    );
  }
}
