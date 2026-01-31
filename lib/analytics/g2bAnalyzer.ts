/**
 * 나라장터 (G2B) 입찰 분석기
 *
 * 공공데이터포털 나라장터 OpenAPI 연동 (verified endpoints)
 * - /ad/BidPublicInfoService: 입찰공고 조회
 * - /as/ScsbidInfoService: 낙찰정보 조회
 * - /ao/PrcureReqsInfoService: 사전규격 조회 (별도 활용신청 필요)
 *
 * API: https://www.data.go.kr (조달청 나라장터)
 */

import { XMLParser } from 'fast-xml-parser';

const G2B_BASE = 'https://apis.data.go.kr/1230000';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (_name: string, jpath: string) =>
    jpath === 'response.body.items.item',
});

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface BidSearchParams {
  keyword?: string;
  bidType?: 'goods' | 'construction' | 'service';
  startDate?: string;        // YYYYMMDD
  endDate?: string;
  minAmount?: number;        // 만원 단위
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
  prcureReqstNo: string;
  prcureReqstNm: string;
  rlDminsttNm: string;
  rgstDt: string;
  opninRgstClseDt: string;
  prcureReqstUrl: string;
  asignBdgtAmt: number;
  daysRemaining: number;
}

export interface PreSpecAnalysis {
  items: PreSpecItem[];
  totalCount: number;
  summary: { avgBudget: number; totalBudget: number };
}

export interface WinningBidItem {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  sucsfbidAmt: number;
  sucsfbidRate: number;       // API가 직접 제공 (예: 90 = 90%)
  sucsfbidCorpNm: string;
  presmptPrce: number;
  opengDt: string;
  prtcptCnum: number;         // 참가업체수
  bidMethdNm: string;
  sucsfbidMthdNm: string;
}

export interface WinningBidAnalysis {
  items: WinningBidItem[];
  totalCount: number;
  summary: {
    avgRate: number;
    minRate: number;
    maxRate: number;
    avgAmount: number;
    totalAmount: number;
    byMethod: Record<string, { count: number; avgRate: number }>;
  };
  recommendation: string;
}

// ─────────────────────────────────────────
// Core: API 호출 + 파싱
// ─────────────────────────────────────────

async function fetchG2B(
  servicePath: string,
  operation: string,
  params: Record<string, string>,
): Promise<{ totalCount: number; items: Record<string, string | number>[] }> {
  const apiKey = process.env.PUBLIC_DATA_KEY;
  if (!apiKey) {
    throw new Error('PUBLIC_DATA_KEY 환경변수가 설정되지 않았습니다.');
  }

  // serviceKey를 수동으로 붙여 이중인코딩 방지
  const queryParts = [`serviceKey=${apiKey}`];
  for (const [k, v] of Object.entries(params)) {
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }

  const url = `${G2B_BASE}/${servicePath}/${operation}?${queryParts.join('&')}`;
  console.log(`[G2B] Request: ${servicePath}/${operation}`);

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();

  // HTML 에러 페이지 감지
  if (text.includes('<html') || text.includes('<!DOCTYPE')) {
    throw new Error('나라장터 API가 에러 페이지를 반환했습니다. API 키 또는 서비스 활성화를 확인하세요.');
  }

  // 단순 텍스트 에러
  if (res.status === 500 && text.includes('Unexpected')) {
    throw new Error('나라장터 API 서비스에 접근할 수 없습니다. 공공데이터포털에서 해당 서비스의 활용신청이 필요합니다.');
  }

  if (res.status === 404) {
    throw new Error('API 엔드포인트를 찾을 수 없습니다. 서비스 경로를 확인하세요.');
  }

  // JSON 파싱 시도
  try {
    const json = JSON.parse(text);

    // nkoneps 에러 형식 처리
    const errResp = json['nkoneps.com.response.ResponseError'];
    if (errResp) {
      const code = errResp.header?.resultCode;
      const msg = errResp.header?.resultMsg;
      throw new Error(`나라장터 API 오류 (${code}): ${msg}`);
    }

    const response = json.response;
    if (response) {
      const resultCode = response.header?.resultCode;
      if (resultCode && resultCode !== '00') {
        throw new Error(`나라장터 API 오류 (${resultCode}): ${response.header?.resultMsg}`);
      }

      const body = response.body;
      const totalCount = Number(body?.totalCount) || 0;
      const rawItems = body?.items;
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems?.item
          ? Array.isArray(rawItems.item) ? rawItems.item : [rawItems.item]
          : [];
      return { totalCount, items };
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('나라장터')) throw e;
    // JSON 파싱 실패 → XML 시도
  }

  // XML 파싱 폴백
  const parsed = xmlParser.parse(text);
  const response = parsed?.response;
  if (!response) {
    console.error('[G2B] Unexpected response:', text.slice(0, 300));
    throw new Error('나라장터 API 응답 형식 오류');
  }

  const resultCode = response.header?.resultCode;
  if (resultCode && resultCode !== '00') {
    throw new Error(`나라장터 API 오류 (${resultCode}): ${response.header?.resultMsg}`);
  }

  const body = response.body;
  const totalCount = Number(body?.totalCount) || 0;
  const rawItems = body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return { totalCount, items };
}

// ─────────────────────────────────────────
// 1. 입찰공고 검색 (ad/BidPublicInfoService)
// ─────────────────────────────────────────

export async function searchBids(params: BidSearchParams): Promise<BidAnalysis> {
  const operationMap: Record<string, string> = {
    goods: 'getBidPblancListInfoThng',
    construction: 'getBidPblancListInfoCnstwk',
    service: 'getBidPblancListInfoServc',
  };

  const operation = operationMap[params.bidType || 'service'];
  const today = new Date();
  // 나라장터 API는 동일 월 내 검색만 안정적으로 지원
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

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
    'ad/BidPublicInfoService',
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
      demandInsttNm: String(item.dminsttNm || ''),
      bidNtceDt: String(item.bidNtceDt || ''),
      bidClseDt,
      presmptPrce,
      bidNtceUrl: String(item.bidNtceDtlUrl || item.bidNtceUrl || `https://www.g2b.go.kr:8081/ep/invitation/publish/bidInfoDtl.do?bidno=${item.bidNtceNo}`),
      bidMethdNm: String(item.cntrctCnclsMthdNm || item.bidMethdNm || ''),
      sucsfbidMthdNm: String(item.sucsfbidMthdNm || ''),
      ntceKindNm: String(item.ntceKindNm || ''),
      region: extractRegion(String(item.dminsttNm || item.ntceInsttNm || '')),
      daysRemaining,
    };
  });

  // 금액 필터 (프론트에서 만원 단위 입력)
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
// 2. 사전규격 검색 (ao/HrcspSsstndrdInfoService)
//    주의: type=json 미지원 → XML 응답을 fast-xml-parser로 파싱
// ─────────────────────────────────────────

export async function searchPreSpecs(params: {
  keyword?: string;
  pageNo?: number;
  numOfRows?: number;
}): Promise<PreSpecAnalysis> {
  const apiKey = process.env.PUBLIC_DATA_KEY;
  if (!apiKey) throw new Error('PUBLIC_DATA_KEY 환경변수가 설정되지 않았습니다.');

  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // 키워드 있으면 PPSSrch 엔드포인트 사용
  const operation = params.keyword
    ? 'getPublicPrcureThngInfoServcPPSSrch'
    : 'getPublicPrcureThngInfoServc';

  const queryParts = [
    `serviceKey=${apiKey}`,
    `pageNo=${params.pageNo || 1}`,
    `numOfRows=${params.numOfRows || 20}`,
    `inqryDiv=1`,
    `inqryBgnDt=${formatDate(defaultStart)}0000`,
    `inqryEndDt=${formatDate(today)}2359`,
  ];

  if (params.keyword) {
    queryParts.push(`prdctClsfcNoNm=${encodeURIComponent(params.keyword)}`);
  }

  // type=json 사용 불가 → XML 응답
  const url = `${G2B_BASE}/ao/HrcspSsstndrdInfoService/${operation}?${queryParts.join('&')}`;
  console.log(`[G2B] PreSpec request: ${operation}`);

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();

  // XML 파싱
  const parsed = xmlParser.parse(text);

  // nkoneps 에러 형식
  const errResp = parsed['nkoneps.com.response.ResponseError'];
  if (errResp) {
    const code = errResp.header?.resultCode;
    const msg = errResp.header?.resultMsg;
    throw new Error(`사전규격 API 오류 (${code}): ${msg}`);
  }

  const response = parsed?.response;
  if (!response) {
    if (text.includes('Unexpected') || res.status === 500) {
      throw new Error('사전규격정보서비스에 접근할 수 없습니다. 공공데이터포털(data.go.kr)에서 "나라장터 사전규격정보서비스" 활용신청이 필요합니다.');
    }
    throw new Error('사전규격 API 응답 형식 오류');
  }

  const resultCode = response.header?.resultCode;
  if (resultCode && String(resultCode) !== '00') {
    throw new Error(`사전규격 API 오류 (${resultCode}): ${response.header?.resultMsg}`);
  }

  const body = response.body;
  const totalCount = Number(body?.totalCount) || 0;
  const rawItems = body?.items?.item;
  const itemArray: Record<string, string | number>[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const items: PreSpecItem[] = itemArray.map((item) => {
    const opninCloseDate = parseDateString(String(item.opninRgstClseDt || ''));
    const daysRemaining = opninCloseDate
      ? Math.ceil((opninCloseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : -1;

    return {
      prcureReqstNo: String(item.bfSpecRgstNo || ''),
      prcureReqstNm: String(item.prdctClsfcNoNm || ''),
      rlDminsttNm: String(item.rlDminsttNm || item.orderInsttNm || ''),
      rgstDt: String(item.rgstDt || item.rcptDt || ''),
      opninRgstClseDt: String(item.opninRgstClseDt || ''),
      prcureReqstUrl: `https://www.g2b.go.kr:8081/ep/preparation/prestd/preStdDtl.do?preStdRegNo=${item.bfSpecRgstNo || ''}`,
      asignBdgtAmt: Number(item.asignBdgtAmt) || 0,
      daysRemaining,
    };
  });

  const budgets = items.map((i) => i.asignBdgtAmt).filter((a) => a > 0);
  return {
    items,
    totalCount,
    summary: {
      avgBudget: budgets.length > 0 ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : 0,
      totalBudget: budgets.reduce((a, b) => a + b, 0),
    },
  };
}

// ─────────────────────────────────────────
// 3. 낙찰정보 검색 (as/ScsbidInfoService)
// ─────────────────────────────────────────

export async function searchWinningBids(params: {
  keyword?: string;
  bidType?: 'goods' | 'construction' | 'service';
  pageNo?: number;
  numOfRows?: number;
}): Promise<WinningBidAnalysis> {
  const operationMap: Record<string, string> = {
    goods: 'getScsbidListSttusThng',
    construction: 'getScsbidListSttusCnstwk',
    service: 'getScsbidListSttusServc',
  };

  const operation = operationMap[params.bidType || 'service'];
  const today = new Date();
  // 나라장터 API는 동일 월 내 검색만 안정적으로 지원
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const queryParams: Record<string, string> = {
    pageNo: String(params.pageNo || 1),
    numOfRows: String(params.numOfRows || 20),
    inqryDiv: '1',
    inqryBgnDt: formatDate(defaultStart) + '0000',
    inqryEndDt: formatDate(today) + '2359',
    type: 'json',
  };

  if (params.keyword) {
    queryParams.bidNtceNm = params.keyword;
  }

  const { totalCount, items: rawItems } = await fetchG2B(
    'as/ScsbidInfoService',
    operation,
    queryParams,
  );

  const items: WinningBidItem[] = rawItems.map((item) => {
    const sucsfbidAmt = Number(item.sucsfbidAmt) || 0;
    // API가 낙찰률을 직접 제공 (예: "90" = 90%)
    const sucsfbidRate = Number(item.sucsfbidRate) || 0;

    return {
      bidNtceNo: String(item.bidNtceNo || ''),
      bidNtceNm: String(item.bidNtceNm || ''),
      ntceInsttNm: String(item.dminsttNm || ''),
      sucsfbidAmt,
      sucsfbidRate,
      sucsfbidCorpNm: String(item.bidwinnrNm || ''),
      presmptPrce: Number(item.presmptPrce) || 0,
      opengDt: String(item.rlOpengDt || item.opengDt || ''),
      prtcptCnum: Number(item.prtcptCnum) || 0,
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
    const method = item.sucsfbidMthdNm || item.bidMethdNm || '기타';
    if (!byMethod[method]) byMethod[method] = { count: 0, avgRate: 0 };
    byMethod[method].count++;
    if (item.sucsfbidRate > 0 && item.sucsfbidRate < 200) {
      byMethod[method].avgRate += item.sucsfbidRate;
    }
  }
  for (const method of Object.keys(byMethod)) {
    if (byMethod[method].count > 0) {
      byMethod[method].avgRate =
        Math.round((byMethod[method].avgRate / byMethod[method].count) * 100) / 100;
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
    ? `이번 달 낙찰 ${totalCount}건 분석: 평균 낙찰률 ${summary.avgRate}%, 평균 낙찰금액 ${formatKRW(summary.avgAmount)}. ${
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
