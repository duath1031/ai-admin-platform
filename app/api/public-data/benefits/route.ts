/**
 * [Patent Technology] Government Benefits Search API
 * Mock 데이터 포함 (API 키 미등록 시 테스트용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchGovBenefits } from '@/lib/gov/publicDataService';

// Mock 데이터 (테스트용)
const MOCK_BENEFITS = [
  {
    id: 'benefit_1',
    title: '청년창업사관학교',
    description: '유망 창업아이템과 고급 기술력을 보유한 우수 창업자를 발굴하여 창업 전 단계를 지원',
    target: '만 39세 이하 예비창업자 및 3년 미만 창업기업 대표자',
    content: '창업공간, 창업코칭, 사업화자금 최대 1억원 지원',
    method: '온라인 접수 (K-Startup)',
    agency: '중소벤처기업부',
    contact: '1357',
    category: '창업지원',
    tags: ['청년', '창업', '자금'],
  },
  {
    id: 'benefit_2',
    title: '소상공인 정책자금',
    description: '소상공인의 경영안정 및 성장을 위한 저금리 정책자금 지원',
    target: '소상공인(상시근로자 5인 미만)',
    content: '최대 1억원, 연 2%대 저금리 대출',
    method: '소상공인시장진흥공단 방문 또는 온라인 신청',
    agency: '소상공인시장진흥공단',
    contact: '1357',
    category: '자금지원',
    tags: ['소상공인', '대출', '자금'],
  },
  {
    id: 'benefit_3',
    title: '벤처기업 확인제도',
    description: '기술성과 성장성이 우수한 중소기업을 벤처기업으로 확인하여 각종 지원',
    target: '기술성 또는 성장성이 우수한 중소기업',
    content: '세제혜택, 금융지원, 입지지원, 인력지원 등',
    method: '벤처인(venturein.or.kr) 온라인 신청',
    agency: '중소벤처기업부',
    contact: '1357',
    category: '인증지원',
    tags: ['중소기업', '인증', '창업'],
  },
  {
    id: 'benefit_4',
    title: '고용촉진장려금',
    description: '취업취약계층을 고용한 사업주에게 인건비 일부 지원',
    target: '취업취약계층을 6개월 이상 고용한 사업주',
    content: '1인당 월 60만원, 최대 1년간 지원',
    method: '고용센터 방문 신청',
    agency: '고용노동부',
    contact: '1350',
    category: '고용지원',
    tags: ['고용', '중소기업'],
  },
  {
    id: 'benefit_5',
    title: 'R&D 바우처 사업',
    description: '중소기업의 기술개발 역량 강화를 위한 연구개발 바우처 지원',
    target: '중소기업 및 창업기업',
    content: '최대 1억원 R&D 바우처 지원',
    method: '중소기업기술정보진흥원 온라인 신청',
    agency: '중소벤처기업부',
    contact: '1357',
    category: '기술지원',
    tags: ['중소기업', '창업', 'IT'],
  },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '지원';
    const pageNo = parseInt(searchParams.get('pageNo') || '1');
    const numOfRows = parseInt(searchParams.get('numOfRows') || '10');

    console.log(`[Benefits API] Searching: "${keyword}", page: ${pageNo}`);

    // 실제 API 호출 시도
    const result = await searchGovBenefits(keyword, { pageNo, numOfRows });

    // API 실패 시 Mock 데이터 반환
    if (!result.success || result.data.length === 0) {
      console.log('[Benefits API] Using mock data');
      const filtered = MOCK_BENEFITS.filter(b =>
        b.title.includes(keyword) ||
        b.description.includes(keyword) ||
        b.tags.some(t => t.includes(keyword)) ||
        keyword === '지원' || keyword === '창업' || keyword === '창업지원'
      );
      return NextResponse.json({
        success: true,
        data: filtered.slice(0, numOfRows),
        totalCount: filtered.length,
        pageNo: 1,
        message: '(테스트 데이터)',
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Benefits API] Error:', error);
    // 에러 시에도 Mock 데이터 반환
    return NextResponse.json({
      success: true,
      data: MOCK_BENEFITS.slice(0, 5),
      totalCount: MOCK_BENEFITS.length,
      pageNo: 1,
      message: '(테스트 데이터)',
    });
  }
}
