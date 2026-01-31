/**
 * [Patent Technology] Civil Services Search API
 * Mock 데이터 포함 (API 키 미등록 시 테스트용)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { searchCivilServices } from '@/lib/gov/publicDataService';

// Mock 데이터 (테스트용)
const MOCK_CIVIL_SERVICES = [
  {
    id: 'civil_1',
    name: '사업자등록 신청',
    description: '개인사업자 또는 법인사업자 등록 신청',
    processingPeriod: '즉시 ~ 3일',
    fee: '무료',
    requiredDocs: ['신분증', '임대차계약서', '사업계획서'],
    agency: '국세청',
    onlineAvailable: true,
    gov24Url: 'https://www.gov.kr',
  },
  {
    id: 'civil_2',
    name: '법인설립등기 신청',
    description: '주식회사, 유한회사 등 법인 설립 등기',
    processingPeriod: '3일 ~ 7일',
    fee: '등록면허세 + 수수료',
    requiredDocs: ['정관', '주주명부', '취임승낙서', '인감증명서'],
    agency: '법원등기소',
    onlineAvailable: true,
    gov24Url: 'https://www.iros.go.kr',
  },
  {
    id: 'civil_3',
    name: '공장등록 신청',
    description: '제조업 공장 신규 등록 또는 변경 신청',
    processingPeriod: '7일 ~ 14일',
    fee: '수수료 별도',
    requiredDocs: ['공장등록신청서', '사업계획서', '토지이용계획확인서'],
    agency: '시/군/구청',
    onlineAvailable: true,
    gov24Url: 'https://www.gov.kr',
  },
  {
    id: 'civil_4',
    name: '건축허가 신청',
    description: '건축물 신축, 증축, 개축 허가 신청',
    processingPeriod: '15일 ~ 30일',
    fee: '수수료 별도',
    requiredDocs: ['건축허가신청서', '설계도서', '토지등기부등본'],
    agency: '시/군/구청',
    onlineAvailable: true,
    gov24Url: 'https://www.eais.go.kr',
  },
  {
    id: 'civil_5',
    name: '영업신고(일반음식점)',
    description: '일반음식점 영업 신고',
    processingPeriod: '즉시 ~ 3일',
    fee: '무료',
    requiredDocs: ['영업신고서', '위생교육필증', '건강진단결과서'],
    agency: '시/군/구청',
    onlineAvailable: true,
    gov24Url: 'https://www.gov.kr',
  },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '신청';
    const pageNo = parseInt(searchParams.get('pageNo') || '1');
    const numOfRows = parseInt(searchParams.get('numOfRows') || '10');

    console.log(`[CivilServices API] Searching: "${keyword}", page: ${pageNo}`);

    // 실제 API 호출 시도
    const result = await searchCivilServices(keyword, { pageNo, numOfRows });

    // API 실패 시 Mock 데이터 반환
    if (!result.success || result.data.length === 0) {
      console.log('[CivilServices API] Using mock data');
      const filtered = MOCK_CIVIL_SERVICES.filter(s =>
        s.name.includes(keyword) ||
        s.description.includes(keyword) ||
        keyword === '신청' || keyword === '등록'
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
    console.error('[CivilServices API] Error:', error);
    return NextResponse.json({
      success: true,
      data: MOCK_CIVIL_SERVICES.slice(0, 5),
      totalCount: MOCK_CIVIL_SERVICES.length,
      pageNo: 1,
      message: '(테스트 데이터)',
    });
  }
}
