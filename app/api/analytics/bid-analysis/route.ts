/**
 * 나라장터 입찰 분석 API
 * POST /api/analytics/bid-analysis            - 입찰공고 검색
 * POST /api/analytics/bid-analysis?action=prespec  - 사전규격 검색
 * POST /api/analytics/bid-analysis?action=winning  - 낙찰정보 검색
 * POST /api/analytics/bid-analysis?action=fitness  - 입찰 적합도 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  searchBids,
  searchPreSpecs,
  searchWinningBids,
  analyzeBidFitness,
} from '@/lib/analytics/g2bAnalyzer';
import type { BidSearchParams, BidItem } from '@/lib/analytics/g2bAnalyzer';

export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action') || 'search';
    const body = await request.json();

    // ── 사전규격 검색 ──
    if (action === 'prespec') {
      const result = await searchPreSpecs({
        keyword: body.keyword,
        pageNo: body.pageNo ? Number(body.pageNo) : 1,
        numOfRows: body.numOfRows ? Number(body.numOfRows) : 20,
      });
      return NextResponse.json({ success: true, action: 'prespec', ...result });
    }

    // ── 낙찰정보 검색 ──
    if (action === 'winning') {
      const result = await searchWinningBids({
        keyword: body.keyword,
        bidType: body.bidType || 'service',
        pageNo: body.pageNo ? Number(body.pageNo) : 1,
        numOfRows: body.numOfRows ? Number(body.numOfRows) : 20,
      });
      return NextResponse.json({ success: true, action: 'winning', ...result });
    }

    // ── 입찰 적합도 분석 ──
    if (action === 'fitness') {
      const { bid, company } = body;
      if (!bid || !company) {
        return NextResponse.json(
          { success: false, error: 'bid와 company 데이터는 필수입니다.' },
          { status: 400 },
        );
      }
      const result = analyzeBidFitness(bid as BidItem, {
        businessTypes: company.businessTypes || [],
        capital: Number(company.capital) || 0,
        experienceYears: Number(company.experienceYears) || 0,
        hasG2bRegistration: Boolean(company.hasG2bRegistration),
      });
      return NextResponse.json({ success: true, action: 'fitness', ...result });
    }

    // ── 기본: 입찰공고 검색 ──
    const params: BidSearchParams = {
      keyword: body.keyword,
      bidType: body.bidType || 'service',
      startDate: body.startDate,
      endDate: body.endDate,
      minAmount: body.minAmount ? Number(body.minAmount) : undefined,
      maxAmount: body.maxAmount ? Number(body.maxAmount) : undefined,
      region: body.region,
      pageNo: body.pageNo ? Number(body.pageNo) : 1,
      numOfRows: body.numOfRows ? Number(body.numOfRows) : 20,
    };

    const result = await searchBids(params);
    return NextResponse.json({ success: true, action: 'search', ...result });
  } catch (error) {
    console.error('[Bid Analysis API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: '나라장터 입찰 분석 API',
    actions: {
      search: '입찰공고 검색 (BidPublicInfoService05)',
      prespec: '사전규격 검색 (PrcureReqsInfoService01)',
      winning: '낙찰정보 검색 (ScsbidInfoService04)',
      fitness: '입찰 적합도 분석',
    },
    note: 'PUBLIC_DATA_KEY 환경변수 필요 (공공데이터포털 API 키)',
  });
}
