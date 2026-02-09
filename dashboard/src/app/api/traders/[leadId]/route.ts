import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;

  try {
    // Fetch trader basic info, positions, and performance in parallel
    const [tradersResponse, positionsResponse, performanceResponse] = await Promise.all([
      fetch(`${BACKEND_URL}/signals/traders`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }),
      fetch(`${BACKEND_URL}/traders/${leadId}/positions`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).catch(() => null),
      // Fetch performance directly from Binance API
      fetch(
        `https://www.binance.com/bapi/futures/v1/public/future/copy-trade/lead-portfolio/performance?portfolioId=${leadId}&timeRange=30D`,
        { cache: 'no-store' }
      ).catch(() => null),
    ]);

    if (!tradersResponse.ok) {
      throw new Error('Failed to fetch traders');
    }

    const tradersData = await tradersResponse.json();
    const trader = tradersData.data?.find((t: any) => t.leadId === leadId);

    if (!trader) {
      return NextResponse.json(
        { success: false, error: 'Trader not found' },
        { status: 404 }
      );
    }

    // Parse positions
    let positions = [];
    if (positionsResponse?.ok) {
      const positionsData = await positionsResponse.json();
      positions = positionsData.positions || [];
    }

    // Parse performance from Binance API
    let performance = null;
    if (performanceResponse?.ok) {
      const performanceData = await performanceResponse.json();
      if (performanceData.success && performanceData.data) {
        performance = performanceData.data;
      }
    }

    return NextResponse.json({
      success: true,
      ...trader,
      positions,
      performance,
    });
  } catch (error) {
    console.error('Trader detail API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trader details' },
      { status: 500 }
    );
  }
}
