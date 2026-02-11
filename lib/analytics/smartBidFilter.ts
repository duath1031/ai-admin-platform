// =============================================================================
// 스마트 입찰 필터 엔진
// 기업 프로필 기반 공고별 참여 적격성 자동 판정
// =============================================================================

export interface BidNotice {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  presmptPrce: number;
  bidClseDt: string;
  bidMethdNm: string;
  sucsfbidMthdNm: string;
  ntceKindNm: string;
  region: string;
  daysRemaining: number;
}

export interface FilterCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  detail: string;
}

export interface SmartFilterResult {
  bid: BidNotice;
  overallStatus: 'eligible' | 'conditional' | 'ineligible';
  checks: FilterCheck[];
  passCount: number;
  warnCount: number;
  failCount: number;
  summary: string;
}

export interface CompanyDataForBid {
  capital?: number;
  employeeCount?: number;
  address?: string | null;
  revenueYear1?: number | null;
  businessSector?: string | null;
  isG2bRegistered?: boolean;
  g2bRegistrationNumber?: string | null;
  productClassificationCodes?: string | null;
  hasDirectProductionCert?: boolean;
  licenses?: { licenseType: string; isActive: boolean; capacity?: number | null }[];
  certifications?: { certType: string; certName: string; isActive: boolean }[];
  performances?: { projectType?: string | null; contractAmount?: number | null; clientName?: string | null }[];
}

// ─── 개별 체크 함수들 ───

function checkG2bRegistration(data: CompanyDataForBid): FilterCheck {
  if (data.isG2bRegistered && data.g2bRegistrationNumber) {
    return { name: '나라장터 등록', status: 'pass', detail: `등록번호: ${data.g2bRegistrationNumber}` };
  }
  if (data.isG2bRegistered) {
    return { name: '나라장터 등록', status: 'warn', detail: '등록 여부 확인됨, 등록번호 미입력' };
  }
  return { name: '나라장터 등록', status: 'fail', detail: '나라장터 미등록 - 입찰 참여 불가' };
}

function checkCapital(data: CompanyDataForBid, bid: BidNotice): FilterCheck {
  const capital = data.capital || 0;
  if (capital <= 0) {
    return { name: '자본금', status: 'unknown', detail: '자본금 정보 미입력' };
  }
  // 추정가 대비 자본금 비율 체크 (일반적으로 추정가의 10% 이상 권장)
  const threshold = bid.presmptPrce * 0.1;
  if (capital >= threshold) {
    return { name: '자본금', status: 'pass', detail: `${formatAmount(capital)} (추정가 대비 충분)` };
  }
  return { name: '자본금', status: 'warn', detail: `${formatAmount(capital)} (추정가 대비 부족 가능)` };
}

function checkLicense(data: CompanyDataForBid, bid: BidNotice): FilterCheck {
  const bidName = bid.bidNtceNm.toLowerCase();
  const isConstruction = bidName.includes('공사') || bidName.includes('건설') || bidName.includes('시공');

  if (!isConstruction) {
    return { name: '면허/자격', status: 'pass', detail: '공사 입찰이 아님 (면허 불요)' };
  }

  const activeLicenses = (data.licenses || []).filter(l => l.isActive);
  if (activeLicenses.length === 0) {
    return { name: '면허/자격', status: 'fail', detail: '건설면허 미보유 - 공사 입찰 참여 불가' };
  }

  return {
    name: '면허/자격',
    status: 'pass',
    detail: `보유 면허: ${activeLicenses.map(l => l.licenseType).join(', ')}`,
  };
}

function checkPerformance(data: CompanyDataForBid, bid: BidNotice): FilterCheck {
  const performances = data.performances || [];
  if (performances.length === 0) {
    return { name: '수행실적', status: 'warn', detail: '수행실적 미등록 - 실적 제한 공고 참여 불가' };
  }

  const totalPerformanceAmount = performances.reduce((sum, p) => sum + (p.contractAmount || 0), 0);
  if (totalPerformanceAmount >= bid.presmptPrce * 0.5) {
    return {
      name: '수행실적',
      status: 'pass',
      detail: `총 ${performances.length}건, ${formatAmount(totalPerformanceAmount)} (충분)`,
    };
  }

  return {
    name: '수행실적',
    status: 'warn',
    detail: `총 ${performances.length}건, ${formatAmount(totalPerformanceAmount)} (실적 부족 가능)`,
  };
}

function checkCertification(data: CompanyDataForBid, bid: BidNotice): FilterCheck {
  const bidName = bid.bidNtceNm.toLowerCase();
  const certs = (data.certifications || []).filter(c => c.isActive);

  // 특정 인증 요구 키워드 체크
  const needsDirectProduction = bidName.includes('직접생산');
  if (needsDirectProduction && !data.hasDirectProductionCert) {
    return { name: '인증 요건', status: 'fail', detail: '직접생산확인증명 미보유' };
  }

  if (certs.length > 0) {
    return {
      name: '인증 요건',
      status: 'pass',
      detail: `보유 인증: ${certs.map(c => c.certName).slice(0, 3).join(', ')}${certs.length > 3 ? ` 외 ${certs.length - 3}건` : ''}`,
    };
  }

  return { name: '인증 요건', status: 'unknown', detail: '등록된 인증 없음 (인증 제한 공고 확인 필요)' };
}

function checkRegion(data: CompanyDataForBid, bid: BidNotice): FilterCheck {
  if (!bid.region || bid.region === '전국' || !data.address) {
    return { name: '지역 제한', status: 'pass', detail: '지역 제한 없음 또는 확인 불필요' };
  }

  if (data.address.includes(bid.region)) {
    return { name: '지역 제한', status: 'pass', detail: `소재지(${bid.region}) 일치` };
  }

  return { name: '지역 제한', status: 'warn', detail: `공고 지역: ${bid.region}, 기업 소재지 불일치 가능` };
}

// ─── 메인 필터 함수 ───

export function filterBid(bid: BidNotice, data: CompanyDataForBid): SmartFilterResult {
  const checks: FilterCheck[] = [
    checkG2bRegistration(data),
    checkLicense(data, bid),
    checkCapital(data, bid),
    checkPerformance(data, bid),
    checkCertification(data, bid),
    checkRegion(data, bid),
  ];

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn' || c.status === 'unknown').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  let overallStatus: SmartFilterResult['overallStatus'];
  if (failCount > 0) overallStatus = 'ineligible';
  else if (warnCount > 0) overallStatus = 'conditional';
  else overallStatus = 'eligible';

  const summary = overallStatus === 'eligible'
    ? '모든 요건을 충족합니다. 입찰 참여가 가능합니다.'
    : overallStatus === 'conditional'
      ? `${warnCount}개 항목 확인이 필요합니다. 공고 세부요건을 확인하세요.`
      : `${failCount}개 필수 요건이 미충족됩니다. 참여가 어렵습니다.`;

  return { bid, overallStatus, checks, passCount, warnCount, failCount, summary };
}

export function filterBids(bids: BidNotice[], data: CompanyDataForBid): SmartFilterResult[] {
  return bids.map(bid => filterBid(bid, data));
}

function formatAmount(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}
