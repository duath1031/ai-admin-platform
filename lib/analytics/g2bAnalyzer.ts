/**
 * 나라장터 (G2B) 입찰 분석기
 *
 * 공공데이터포털 나라장터 OpenAPI 연동
 * - 입찰공고 조회 (물품/공사/용역)
 * - 낙찰 예정가격 분석
 * - 업종 적합도 판단
 *
 * API 문서: https://www.data.go.kr (조달청 나라장터 입찰공고정보)
 */

const G2B_API_BASE = 'http://apis.data.go.kr/1230000/BidPublicInfoService04';
const API_KEY = process.env.PUBLIC_DATA_KEY || '';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface BidSearchParams {
  keyword?: string;          // 검색 키워드
  bidType?: 'goods' | 'construction' | 'service'; // 입찰 유형
  startDate?: string;        // 시작일 (YYYYMMDD)
  endDate?: string;          // 종료일 (YYYYMMDD)
  minAmount?: number;        // 최소 금액 (원)
  maxAmount?: number;        // 최대 금액 (원)
  region?: string;           // 지역 (예: 서울, 경기)
  pageNo?: number;
  numOfRows?: number;
}

export interface BidItem {
  bidNtceNo: string;         // 입찰공고번호
  bidNtceNm: string;         // 공고명
  ntceInsttNm: string;       // 공고기관명
  demandInsttNm: string;     // 수요기관명
  bidNtceDt: string;         // 공고일시
  bidClseDt: string;         // 마감일시
  presmptPrce: number;       // 추정가격 (원)
  bidNtceUrl: string;        // 공고 URL
  bidMethdNm: string;        // 입찰방식 (일반/제한/지명 등)
  sucsfbidMthdNm: string;    // 낙찰방법 (최저가/적격심사 등)
  ntceKindNm: string;        // 공고종류 (물품/공사/용역)
  region: string;            // 지역
  daysRemaining: number;     // 마감까지 남은 일수
}

export interface BidAnalysis {
  items: BidItem[];
  totalCount: number;
  summary: {
    avgAmount: number;
    minAmount: number;
    maxAmount: number;
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    byMethod: Record<string, number>;
  };
  recommendation: string;
}

// ─────────────────────────────────────────
// API 호출
// ─────────────────────────────────────────

/**
 * 나라장터 입찰공고 검색
 */
export async function searchBids(params: BidSearchParams): Promise<BidAnalysis> {
  if (!API_KEY) {
    throw new Error('PUBLIC_DATA_KEY 환경변수가 설정되지 않았습니다.');
  }

  const bidTypeEndpoints: Record<string, string> = {
    goods: '/getBidPblancListInfoThngPPSSrch04',
    construction: '/getBidPblancListInfoCnstwkPPSSrch04',
    service: '/getBidPblancListInfoServcPPSSrch04',
  };

  const endpoint = bidTypeEndpoints[params.bidType || 'service'];
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const queryParams = new URLSearchParams({
    serviceKey: API_KEY,
    pageNo: String(params.pageNo || 1),
    numOfRows: String(params.numOfRows || 20),
    type: 'json',
    inqryDiv: '1', // 공고일 기준
    inqryBgnDt: params.startDate || formatDate(defaultStart),
    inqryEndDt: params.endDate || formatDate(today),
  });

  if (params.keyword) {
    queryParams.set('bidNtceNm', params.keyword);
  }

  const url = `${G2B_API_BASE}${endpoint}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      throw new Error(`G2B API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    const body = data?.response?.body;
    const totalCount = body?.totalCount || 0;
    const rawItems = body?.items || [];

    // 배열 정규화 (단일 항목일 때 배열이 아닐 수 있음)
    const itemArray = Array.isArray(rawItems) ? rawItems : rawItems.item ? (Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item]) : [];

    const items: BidItem[] = itemArray.map((item: Record<string, string | number>) => {
      const presmptPrce = Number(item.presmptPrce) || 0;
      const bidClseDt = String(item.bidClseDt || '');
      const closeDate = parseDateString(bidClseDt);
      const daysRemaining = closeDate ? Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : -1;

      return {
        bidNtceNo: String(item.bidNtceNo || ''),
        bidNtceNm: String(item.bidNtceNm || ''),
        ntceInsttNm: String(item.ntceInsttNm || ''),
        demandInsttNm: String(item.dminsttNm || item.demandInsttNm || ''),
        bidNtceDt: String(item.bidNtceDt || ''),
        bidClseDt,
        presmptPrce,
        bidNtceUrl: `https://www.g2b.go.kr:8081/ep/invitation/publish/bidInfoDtl.do?bidno=${item.bidNtceNo}`,
        bidMethdNm: String(item.bidMethdNm || ''),
        sucsfbidMthdNm: String(item.sucsfbidMthdNm || ''),
        ntceKindNm: String(item.ntceKindNm || ''),
        region: extractRegion(String(item.ntceInsttNm || '')),
        daysRemaining,
      };
    });

    // 금액 필터
    let filtered = items;
    if (params.minAmount) {
      filtered = filtered.filter(i => i.presmptPrce >= (params.minAmount || 0));
    }
    if (params.maxAmount) {
      filtered = filtered.filter(i => i.presmptPrce <= (params.maxAmount || Infinity));
    }
    if (params.region) {
      filtered = filtered.filter(i => i.region.includes(params.region || ''));
    }

    // 분석 요약
    const amounts = filtered.map(i => i.presmptPrce).filter(a => a > 0);
    const summary = {
      avgAmount: amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0,
      minAmount: amounts.length > 0 ? Math.min(...amounts) : 0,
      maxAmount: amounts.length > 0 ? Math.max(...amounts) : 0,
      byType: countBy(filtered, 'ntceKindNm'),
      byRegion: countBy(filtered, 'region'),
      byMethod: countBy(filtered, 'sucsfbidMthdNm'),
    };

    // 추천 사항
    const openBids = filtered.filter(i => i.daysRemaining > 0);
    const recommendation = openBids.length > 0
      ? `현재 마감 전 공고 ${openBids.length}건이 있습니다. 평균 추정가격 ${formatKRW(summary.avgAmount)}입니다.`
      : '현재 검색 조건에 맞는 진행 중인 공고가 없습니다. 검색 범위를 넓혀보세요.';

    return { items: filtered, totalCount, summary, recommendation };

  } catch (error) {
    console.error('[G2B] API 호출 실패:', error);
    throw error;
  }
}

/**
 * 입찰 적합도 분석
 * 업종/자본금/경력 기반으로 참여 가능 여부 판단
 */
export function analyzeBidFitness(bid: BidItem, company: {
  businessTypes: string[];   // 업종 목록
  capital: number;           // 자본금 (만원)
  experienceYears: number;   // 업력 (년)
  hasG2bRegistration: boolean; // 나라장터 등록 여부
}): {
  score: number;             // 적합도 점수 (0-100)
  canParticipate: boolean;
  reasons: string[];
  tips: string[];
} {
  const reasons: string[] = [];
  const tips: string[] = [];
  let score = 50; // 기본 점수

  // 나라장터 등록 필수
  if (!company.hasG2bRegistration) {
    reasons.push('나라장터 등록이 필요합니다 (필수)');
    tips.push('나라장터 (www.g2b.go.kr)에서 업체등록을 먼저 진행하세요.');
    return { score: 0, canParticipate: false, reasons, tips };
  }
  score += 10;

  // 추정가격 대비 자본금 비율
  const estimatedInManWon = bid.presmptPrce / 10000;
  if (company.capital > 0 && estimatedInManWon > 0) {
    const capitalRatio = company.capital / estimatedInManWon;
    if (capitalRatio >= 0.3) {
      score += 15;
      reasons.push('자본금 대비 적정 규모의 입찰');
    } else if (capitalRatio >= 0.1) {
      score += 5;
      reasons.push('자본금 대비 다소 큰 규모 — 이행보증보험 확인 필요');
    } else {
      score -= 10;
      reasons.push('자본금 대비 과대 규모 — 참여 위험');
      tips.push('이행보증보험, 공동도급(컨소시엄) 검토하세요.');
    }
  }

  // 업력
  if (company.experienceYears >= 5) {
    score += 10;
    reasons.push('충분한 업력 (5년 이상)');
  } else if (company.experienceYears >= 2) {
    score += 5;
    reasons.push('기본 업력 충족 (2년 이상)');
  } else {
    reasons.push('업력 2년 미만 — 제한경쟁 입찰 참여 제한 가능');
    tips.push('일반경쟁입찰 위주로 참여하세요.');
  }

  // 낙찰방법별 팁
  if (bid.sucsfbidMthdNm.includes('최저가')) {
    tips.push('최저가 낙찰: 예정가격의 87.745% 이하 투찰 유의 (덤핑 방지)');
  } else if (bid.sucsfbidMthdNm.includes('적격심사')) {
    tips.push('적격심사 낙찰: 가격 점수 외 기술·실적 점수도 중요합니다.');
  }

  // 마감일 체크
  if (bid.daysRemaining <= 3 && bid.daysRemaining > 0) {
    tips.push(`마감 ${bid.daysRemaining}일 전입니다. 서둘러 준비하세요.`);
  } else if (bid.daysRemaining <= 0) {
    reasons.push('이미 마감된 공고입니다.');
    return { score: 0, canParticipate: false, reasons, tips };
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    canParticipate: score >= 30,
    reasons,
    tips,
  };
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseDateString(s: string): Date | null {
  if (!s || s.length < 8) return null;
  const clean = s.replace(/[^0-9]/g, '');
  const year = parseInt(clean.slice(0, 4));
  const month = parseInt(clean.slice(4, 6)) - 1;
  const day = parseInt(clean.slice(6, 8));
  if (isNaN(year)) return null;
  return new Date(year, month, day);
}

function extractRegion(insttNm: string): string {
  const regions = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  ];
  for (const r of regions) {
    if (insttNm.includes(r)) return r;
  }
  return '기타';
}

function countBy(items: BidItem[], key: keyof BidItem): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key] || '기타');
    result[val] = (result[val] || 0) + 1;
  }
  return result;
}

function formatKRW(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(0)}만원`;
  return `${amount.toLocaleString()}원`;
}
