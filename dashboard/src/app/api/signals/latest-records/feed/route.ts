import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();

  try {
    const response = await fetch(`${BACKEND_URL}/signals/latest-records/feed?${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch latest records feed');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Latest records feed API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch latest records feed' },
      { status: 500 }
    );
  }
}
