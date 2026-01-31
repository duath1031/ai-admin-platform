/**
 * 나라장터 입찰 분석 API
 * POST /api/analytics/bid-analysis - 입찰공고 검색 + 분석
 * POST /api/analytics/bid-analysis?action=fitness - 입찰 적합도 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchBids, analyzeBidFitness } from '@/lib/analytics/g2bAnalyzer';
import type { BidSearchParams, BidItem } from '@/lib/analytics/g2bAnalyzer';

export async function POST(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action');
    const body = await request.json();

    if (action === 'fitness') {
      // 입찰 적합도 분석
      const { bid, company } = body;
      if (!bid || !company) {
        return NextResponse.json(
          { success: false, error: 'bid와 company 데이터는 필수입니다.' },
          { status: 400 }
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

    // 기본: 입찰공고 검색
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

    return NextResponse.json({
      success: true,
      action: 'search',
      ...result,
    });

  } catch (error) {
    console.error('[Bid Analysis API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoints: [
      {
        method: 'POST',
        path: '/api/analytics/bid-analysis',
        description: '나라장터 입찰공고 검색',
        params: {
          keyword: '검색 키워드 (선택)',
          bidType: 'goods | construction | service (기본: service)',
          startDate: 'YYYYMMDD (기본: 30일 전)',
          endDate: 'YYYYMMDD (기본: 오늘)',
          minAmount: '최소 금액 (원, 선택)',
          maxAmount: '최대 금액 (원, 선택)',
          region: '지역 (예: 서울, 경기)',
          pageNo: '페이지 번호 (기본: 1)',
          numOfRows: '페이지당 건수 (기본: 20)',
        },
      },
      {
        method: 'POST',
        path: '/api/analytics/bid-analysis?action=fitness',
        description: '입찰 적합도 분석',
        params: {
          bid: '입찰공고 객체 (검색 결과의 item)',
          company: {
            businessTypes: '업종 목록 (배열)',
            capital: '자본금 (만원)',
            experienceYears: '업력 (년)',
            hasG2bRegistration: '나라장터 등록 여부',
          },
        },
      },
    ],
    note: 'PUBLIC_DATA_KEY 환경변수 필요 (공공데이터포털 API 키)',
  });
}
