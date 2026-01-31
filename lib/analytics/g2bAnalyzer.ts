/**
 * 나라장터 (G2B) 입찰 분석기
 *
 * 공공데이터포털 나라장터 OpenAPI 연동
 * - BidPublicInfoService05: 입찰공고 조회 (물품/공사/용역)
 * - ScsbidInfoService04: 낙찰정보 조회
 * - PrcureReqsInfoService01: 사전규격 조회
 *
 * API: https://www.data.go.kr (조달청 나라장터)
 */

import { XMLParser } from 'fast-xml-parser';

const G2B_BASE = 'https://apis.data.go.kr/1230000';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (_name: string, jpath: string) => {
    // items.item 은 항상 배열로 처리
    return jpath === 'response.body.items.item';
  },
});

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface BidSearchParams {
  keyword?: string;
  bidType?: 'goods' | 'construction' | 'service';
  startDate?: string;        // YYYYMMDD
  endDate?: string;
  minAmount?: number;        // 만원 단위 → 원으로 변환
  maxAmount?: number;
  region?: string;
  pageNo?: number;
  numOfRows?: number;
}

export interface BidItem {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  demandInsttNm: string;
  bidNtceDt: string;
  bidClseDt: string;
  presmptPrce: number;
  bidNtceUrl: string;
  bidMethdNm: string;
  sucsfbidMthdNm: string;
  ntceKindNm: string;
  region: string;
  daysRemaining: number;
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

export interface PreSpecItem {
  prcureReqstNo: string;      // 사전규격등록번호
  prcureReqstNm: string;      // 사전규격명
  rlDminsttNm: string;        // 수요기관명
  rgstDt: string;              // 등록일시
  opninRgstClseDt: string;    // 의견등록마감일시
  refNo: string;               // 참조번호
  prcureReqstUrl: string;     // 상세 URL
  asignBdgtAmt: number;       // 배정예산액
  daysRemaining: number;
}

export interface PreSpecAnalysis {
  items: PreSpecItem[];
  totalCount: number;
  summary: { avgBudget: number; totalBudget: number };
}

export interface WinningBidItem {
  bidNtceNo: string;           // 입찰공고번호
  bidNtceNm: string;           // 공고명
  ntceInsttNm: string;         // 공고기관
  sucsfbidAmt: number;         // 낙찰금액
  sucsfbidRate: number;        // 낙찰률 (%)
  sucsfbidCorpNm: string;     // 낙찰업체명
  presmptPrce: number;         // 추정가격
  opengDt: string;             // 개찰일시
  bidMethdNm: string;
  sucsfbidMthdNm: string;
}

export interface WinningBidAnalysis {
  items: WinningBidItem[];
  totalCount: number;
  summary: {
    avgRate: number;           // 평균 낙찰률
    minRate: number;
    maxRate: number;
    avgAmount: number;
    totalAmount: number;
    byMethod: Record<string, { count: number; avgRate: number }>;
  };
  recommendation: string;
}

// ─────────────────────────────────────────
// Core: XML fetch + parse
// ─────────────────────────────────────────

async function fetchG2B(
  service: string,
  operation: string,
  params: Record<string, string>,
): Promise<{ totalCount: number; items: Record<string, string | number>[] }> {
  const apiKey = process.env.PUBLIC_DATA_KEY;
  if (!apiKey) {
    throw new Error('PUBLIC_DATA_KEY 환경변수가 설정되지 않았습니다.');
  }

  // serviceKey를 수동으로 붙여서 이중인코딩 방지
  const queryParts = [`serviceKey=${apiKey}`];
  for (const [k, v] of Object.entries(params)) {
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }

  const url = `${G2B_BASE}/${service}/${operation}?${queryParts.join('&')}`;
  console.log(`[G2B] Request: ${service}/${operation}`);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/xml' },
  });

  const text = await res.text();

  // HTML 에러 페이지 감지
  if (text.includes('<html') || text.includes('<!DOCTYPE')) {
    console.error('[G2B] HTML error page returned');
    throw new Error('나라장터 API가 에러 페이지를 반환했습니다. API 키 또는 서비스 활성화를 확인하세요.');
  }

  // JSON 먼저 시도 (일부 API는 JSON 반환)
  try {
    const json = JSON.parse(text);
    const body = json?.response?.body;
    if (body) {
      const rawItems = body.items || [];
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems.item
          ? Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item]
          : [];
      return { totalCount: body.totalCount || 0, items };
    }
  } catch {
    // JSON 실패 → XML 파싱
  }

  // XML 파싱
  const parsed = xmlParser.parse(text);
  const response = parsed?.response;

  if (!response) {
    console.error('[G2B] Unexpected response format:', text.slice(0, 300));
    throw new Error('나라장터 API 응답 형식 오류');
  }

  // 에러 코드 체크
  const resultCode = response?.header?.resultCode;
  if (resultCode && resultCode !== '00') {
    const msg = response?.header?.resultMsg || 'Unknown error';
    console.error(`[G2B] API Error: ${resultCode} - ${msg}`);
    throw new Error(`나라장터 API 오류 (${resultCode}): ${msg}`);
  }

  const body = response?.body;
  const totalCount = Number(body?.totalCount) || 0;
  const rawItems = body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return { totalCount, items };
}

// ─────────────────────────────────────────
// 1. 입찰공고 검색 (BidPublicInfoService05)
// ─────────────────────────────────────────

export async function searchBids(params: BidSearchParams): Promise<BidAnalysis> {
  const endpointMap: Record<string, string> = {
    goods: 'getBidPblancListInfoThngPPSSrch05',
    construction: 'getBidPblancListInfoCnstwkPPSSrch05',
    service: 'getBidPblancListInfoServcPPSSrch05',
  };

  const operation = endpointMap[params.bidType || 'service'];
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const queryParams: Record<string, string> = {
    pageNo: String(params.pageNo || 1),
    numOfRows: String(params.numOfRows || 20),
    inqryDiv: '1',
    inqryBgnDt: (params.startDate || formatDate(defaultStart)) + '0000',
    inqryEndDt: (params.endDate || formatDate(today)) + '2359',
    type: 'json',
  };

  if (params.keyword) {
    queryParams.bidNtceNm = params.keyword;
  }

  const { totalCount, items: rawItems } = await fetchG2B(
    'BidPublicInfoService05',
    operation,
    queryParams,
  );

  const items: BidItem[] = rawItems.map((item) => {
    const presmptPrce = Number(item.presmptPrce) || 0;
    const bidClseDt = String(item.bidClseDt || '');
    const closeDate = parseDateString(bidClseDt);
    const daysRemaining = closeDate
      ? Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

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

  // 금액 필터 (프론트에서 만원 단위로 입력)
  let filtered = items;
  if (params.minAmount) {
    const minWon = params.minAmount * 10000;
    filtered = filtered.filter((i) => i.presmptPrce >= minWon);
  }
  if (params.maxAmount) {
    const maxWon = params.maxAmount * 10000;
    filtered = filtered.filter((i) => i.presmptPrce <= maxWon);
  }
  if (params.region) {
    filtered = filtered.filter((i) => i.region.includes(params.region || ''));
  }

  const amounts = filtered.map((i) => i.presmptPrce).filter((a) => a > 0);
  const summary = {
    avgAmount: amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0,
    minAmount: amounts.length > 0 ? Math.min(...amounts) : 0,
    maxAmount: amounts.length > 0 ? Math.max(...amounts) : 0,
    byType: countBy(filtered, 'ntceKindNm'),
    byRegion: countBy(filtered, 'region'),
    byMethod: countBy(filtered, 'sucsfbidMthdNm'),
  };

  const openBids = filtered.filter((i) => i.daysRemaining > 0);
  const recommendation = openBids.length > 0
    ? `현재 마감 전 공고 ${openBids.length}건이 있습니다. 평균 추정가격 ${formatKRW(summary.avgAmount)}입니다.`
    : '현재 검색 조건에 맞는 진행 중인 공고가 없습니다. 검색 범위를 넓혀보세요.';

  return { items: filtered, totalCount, summary, recommendation };
}

// ─────────────────────────────────────────
// 2. 사전규격 검색 (PrcureReqsInfoService01)
// ─────────────────────────────────────────

export async function searchPreSpecs(params: {
  keyword?: string;
  pageNo?: number;
  numOfRows?: number;
}): Promise<PreSpecAnalysis> {
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

  const queryParams: Record<string, string> = {
    pageNo: String(params.pageNo || 1),
    numOfRows: String(params.numOfRows || 20),
    inqryBgnDt: formatDate(defaultStart) + '0000',
    inqryEndDt: formatDate(today) + '2359',
    type: 'json',
  };

  if (params.keyword) {
    queryParams.prcureReqstNm = params.keyword;
  }

  const { totalCount, items: rawItems } = await fetchG2B(
    'PrcureReqsInfoService01',
    'getPreStndrdPrcureInfoPPSSrch01',
    queryParams,
  );

  const items: PreSpecItem[] = rawItems.map((item) => {
    const opninCloseDate = parseDateString(String(item.opninRgstClseDt || ''));
    const daysRemaining = opninCloseDate
      ? Math.ceil((opninCloseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    return {
      prcureReqstNo: String(item.prcureReqstNo || ''),
      prcureReqstNm: String(item.prcureReqstNm || ''),
      rlDminsttNm: String(item.rlDminsttNm || item.dminsttNm || ''),
      rgstDt: String(item.rgstDt || ''),
      opninRgstClseDt: String(item.opninRgstClseDt || ''),
      refNo: String(item.refNo || ''),
      prcureReqstUrl: `https://www.g2b.go.kr:8081/ep/preparation/prestd/preStdDtl.do?preStdRegNo=${item.prcureReqstNo}`,
      asignBdgtAmt: Number(item.asignBdgtAmt) || 0,
      daysRemaining,
    };
  });

  const budgets = items.map((i) => i.asignBdgtAmt).filter((a) => a > 0);
  const summary = {
    avgBudget: budgets.length > 0 ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : 0,
    totalBudget: budgets.reduce((a, b) => a + b, 0),
  };

  return { items, totalCount, summary };
}

// ─────────────────────────────────────────
// 3. 낙찰정보 검색 (ScsbidInfoService04)
// ─────────────────────────────────────────

export async function searchWinningBids(params: {
  keyword?: string;
  bidType?: 'goods' | 'construction' | 'service';
  pageNo?: number;
  numOfRows?: number;
}): Promise<WinningBidAnalysis> {
  const endpointMap: Record<string, string> = {
    goods: 'getScsbidListSrchThng04',
    construction: 'getScsbidListSrchCnstwk04',
    service: 'getScsbidListSrchServc04',
  };

  const operation = endpointMap[params.bidType || 'service'];
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

  const queryParams: Record<string, string> = {
    pageNo: String(params.pageNo || 1),
    numOfRows: String(params.numOfRows || 20),
    inqryBgnDt: formatDate(defaultStart) + '0000',
    inqryEndDt: formatDate(today) + '2359',
    type: 'json',
  };

  if (params.keyword) {
    queryParams.bidNtceNm = params.keyword;
  }

  const { totalCount, items: rawItems } = await fetchG2B(
    'ScsbidInfoService04',
    operation,
    queryParams,
  );

  const items: WinningBidItem[] = rawItems.map((item) => {
    const sucsfbidAmt = Number(item.sucsfbidAmt) || 0;
    const presmptPrce = Number(item.presmptPrce) || Number(item.bsisAmt) || 0;
    const sucsfbidRate = presmptPrce > 0
      ? Math.round((sucsfbidAmt / presmptPrce) * 10000) / 100
      : 0;

    return {
      bidNtceNo: String(item.bidNtceNo || ''),
      bidNtceNm: String(item.bidNtceNm || ''),
      ntceInsttNm: String(item.ntceInsttNm || item.dminsttNm || ''),
      sucsfbidAmt,
      sucsfbidRate,
      sucsfbidCorpNm: String(item.sucsfbidCorpNm || item.bidwnnrNm || ''),
      presmptPrce,
      opengDt: String(item.opengDt || ''),
      bidMethdNm: String(item.bidMethdNm || ''),
      sucsfbidMthdNm: String(item.sucsfbidMthdNm || ''),
    };
  });

  // 낙찰률 분석
  const rates = items.map((i) => i.sucsfbidRate).filter((r) => r > 0 && r < 200);
  const amounts = items.map((i) => i.sucsfbidAmt).filter((a) => a > 0);

  // 낙찰방식별 평균 낙찰률
  const byMethod: Record<string, { count: number; avgRate: number }> = {};
  for (const item of items) {
    const method = item.sucsfbidMthdNm || '기타';
    if (!byMethod[method]) byMethod[method] = { count: 0, avgRate: 0 };
    byMethod[method].count++;
    if (item.sucsfbidRate > 0 && item.sucsfbidRate < 200) {
      byMethod[method].avgRate += item.sucsfbidRate;
    }
  }
  for (const method of Object.keys(byMethod)) {
    if (byMethod[method].count > 0) {
      byMethod[method].avgRate = Math.round((byMethod[method].avgRate / byMethod[method].count) * 100) / 100;
    }
  }

  const summary = {
    avgRate: rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : 0,
    minRate: rates.length > 0 ? Math.min(...rates) : 0,
    maxRate: rates.length > 0 ? Math.max(...rates) : 0,
    avgAmount: amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0,
    totalAmount: amounts.reduce((a, b) => a + b, 0),
    byMethod,
  };

  const recommendation = rates.length > 0
    ? `최근 90일 낙찰 ${totalCount}건 분석: 평균 낙찰률 ${summary.avgRate}%, 평균 낙찰금액 ${formatKRW(summary.avgAmount)}. ${
        summary.avgRate > 85
          ? '투찰률이 높은 편이므로 적극적 참여를 권장합니다.'
          : summary.avgRate > 70
            ? '경쟁이 있는 시장입니다. 적정 투찰가를 산출하세요.'
            : '낙찰률이 낮아 경쟁이 치열합니다. 차별화 전략이 필요합니다.'
      }`
    : '조건에 맞는 낙찰 정보가 없습니다.';

  return { items, totalCount, summary, recommendation };
}

// ─────────────────────────────────────────
// 4. 입찰 적합도 분석
// ─────────────────────────────────────────

export function analyzeBidFitness(
  bid: BidItem,
  company: {
    businessTypes: string[];
    capital: number;
    experienceYears: number;
    hasG2bRegistration: boolean;
  },
): {
  score: number;
  canParticipate: boolean;
  reasons: string[];
  tips: string[];
} {
  const reasons: string[] = [];
  const tips: string[] = [];
  let score = 50;

  if (!company.hasG2bRegistration) {
    reasons.push('나라장터 등록이 필요합니다 (필수)');
    tips.push('나라장터 (www.g2b.go.kr)에서 업체등록을 먼저 진행하세요.');
    return { score: 0, canParticipate: false, reasons, tips };
  }
  score += 10;

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

  if (bid.sucsfbidMthdNm.includes('최저가')) {
    tips.push('최저가 낙찰: 예정가격의 87.745% 이하 투찰 유의 (덤핑 방지)');
  } else if (bid.sucsfbidMthdNm.includes('적격심사')) {
    tips.push('적격심사 낙찰: 가격 점수 외 기술·실적 점수도 중요합니다.');
  }

  if (bid.daysRemaining <= 3 && bid.daysRemaining > 0) {
    tips.push(`마감 ${bid.daysRemaining}일 전입니다. 서둘러 준비하세요.`);
  } else if (bid.daysRemaining <= 0) {
    reasons.push('이미 마감된 공고입니다.');
    return { score: 0, canParticipate: false, reasons, tips };
  }

  score = Math.max(0, Math.min(100, score));
  return { score, canParticipate: score >= 30, reasons, tips };
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
