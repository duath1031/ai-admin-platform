// =============================================================================
// 인증 적격성 진단 엔진
// 벤처/이노비즈/메인비즈/ISO/여성기업 등 인증 적격 여부 자동 판정
// =============================================================================

export interface CertEligibilityResult {
  certType: string;
  certName: string;
  score: number; // 0-100
  eligible: boolean;
  met: string[];
  unmet: string[];
  recommendation: string;
}

export interface CompanyData {
  businessSector?: string | null;
  foundedDate?: string | Date | null;
  establishmentDate?: string | Date | null;
  employeeCount?: number;
  capital?: number;
  revenueYear1?: number | null;
  revenueYear2?: number | null;
  revenueYear3?: number | null;
  rndExpenditure?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  researcherCount?: number | null;
  hasResearchInstitute?: boolean;
  hasRndDepartment?: boolean;
  exportAmount?: number | null;
  permanentEmployees?: number | null;
  ceoGender?: string | null;
  certifications?: { certType: string; isActive: boolean }[];
  patents?: { patentType: string; status: string }[];
}

function yearsSince(date: string | Date | null | undefined): number {
  if (!date) return 0;
  const d = typeof date === 'string' ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function isSmallBiz(data: CompanyData): boolean {
  return (data.employeeCount || 0) < 300 && (data.revenueYear1 || 0) < 150_000_000_000;
}

// ─── 벤처기업 ───
function checkVenture(data: CompanyData): CertEligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];

  // 1. 중소기업 여부
  if (isSmallBiz(data)) met.push('중소기업 해당');
  else unmet.push('중소기업 기준 초과 (300인 미만 & 매출 1,500억 미만)');

  // 2. 업력 (설립 후 7년 이내 가산점)
  const years = yearsSince(data.foundedDate || data.establishmentDate);
  if (years > 0 && years <= 7) met.push(`업력 ${years}년 (7년 이내 가산)`);
  else if (years > 7) met.push(`업력 ${years}년`);
  else unmet.push('설립일 미입력');

  // 3. R&D 투자
  const rndRatio = (data.revenueYear1 && data.rndExpenditure)
    ? (data.rndExpenditure / data.revenueYear1) * 100 : 0;
  if (rndRatio >= 5) met.push(`R&D 비율 ${rndRatio.toFixed(1)}% (5% 이상)`);
  else if (data.rndExpenditure) unmet.push(`R&D 비율 ${rndRatio.toFixed(1)}% (5% 이상 권장)`);
  else unmet.push('연구개발비 미입력');

  // 4. 기술보증/벤처캐피탈/연구소
  if (data.hasResearchInstitute || data.hasRndDepartment) met.push('연구소/전담부서 보유');
  else unmet.push('기업부설연구소 또는 연구개발전담부서 없음');

  // 5. 특허
  const activePatents = (data.patents || []).filter(p => p.status === 'registered').length;
  if (activePatents > 0) met.push(`등록 특허 ${activePatents}건`);
  else unmet.push('등록된 지식재산권 없음 (권장)');

  const score = Math.round((met.length / (met.length + unmet.length)) * 100);
  return {
    certType: 'venture',
    certName: '벤처기업 확인',
    score,
    eligible: score >= 60,
    met, unmet,
    recommendation: score >= 80 ? '벤처기업 인증 요건을 대부분 충족합니다. 기술보증기금 또는 벤처캐피탈 확인을 통해 신청하세요.'
      : score >= 50 ? '일부 요건 보완이 필요합니다. 미충족 항목을 확인하세요.'
      : 'R&D 투자, 연구소 설립 등 기반을 먼저 갖추는 것이 좋습니다.',
  };
}

// ─── 이노비즈(혁신형 중소기업) ───
function checkInnobiz(data: CompanyData): CertEligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];

  if (isSmallBiz(data)) met.push('중소기업 해당');
  else unmet.push('중소기업 기준 초과');

  const years = yearsSince(data.foundedDate || data.establishmentDate);
  if (years >= 3) met.push(`업력 ${years}년 (3년 이상)`);
  else unmet.push(`업력 ${years}년 (3년 이상 필요)`);

  if (data.rndExpenditure && data.rndExpenditure > 0) met.push('R&D 투자 실적 있음');
  else unmet.push('R&D 투자 실적 없음');

  if (data.hasResearchInstitute || data.hasRndDepartment) met.push('연구소/전담부서 보유');
  else unmet.push('연구소/전담부서 없음 (필수)');

  const activePatents = (data.patents || []).filter(p => p.status === 'registered').length;
  if (activePatents > 0) met.push(`등록 특허 ${activePatents}건`);
  else unmet.push('등록된 지식재산권 없음');

  if ((data.revenueYear1 || 0) > 0) met.push('매출 실적 있음');
  else unmet.push('매출 실적 없음');

  const score = Math.round((met.length / (met.length + unmet.length)) * 100);
  return {
    certType: 'innobiz',
    certName: '이노비즈(Inno-Biz) 인증',
    score,
    eligible: score >= 70,
    met, unmet,
    recommendation: score >= 80 ? '이노비즈 인증 요건을 충족합니다. 중소벤처기업부 이노비즈넷에서 온라인 자가진단 후 신청하세요.'
      : score >= 50 ? '일부 요건 보완 필요. 연구소 설립과 R&D 투자 실적이 핵심입니다.'
      : '업력, 연구소, R&D 투자 등 기본 요건을 먼저 갖추세요.',
  };
}

// ─── 메인비즈(경영혁신형 중소기업) ───
function checkMainbiz(data: CompanyData): CertEligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];

  if (isSmallBiz(data)) met.push('중소기업 해당');
  else unmet.push('중소기업 기준 초과');

  const years = yearsSince(data.foundedDate || data.establishmentDate);
  if (years >= 3) met.push(`업력 ${years}년 (3년 이상)`);
  else unmet.push(`업력 ${years}년 (3년 이상 필요)`);

  if ((data.revenueYear1 || 0) > 0) met.push('매출 실적 있음');
  else unmet.push('매출 실적 없음 (필수)');

  // 매출 성장 확인
  if (data.revenueYear1 && data.revenueYear2 && data.revenueYear1 > data.revenueYear2) {
    met.push('매출 성장 추세');
  } else if (data.revenueYear1 && data.revenueYear2) {
    unmet.push('매출 감소 추세 (감점 요인)');
  }

  if ((data.employeeCount || 0) >= 5) met.push(`상시근로자 ${data.employeeCount}명 (5인 이상)`);
  else unmet.push(`상시근로자 ${data.employeeCount || 0}명 (5인 이상 권장)`);

  const score = Math.round((met.length / (met.length + unmet.length)) * 100);
  return {
    certType: 'mainbiz',
    certName: '메인비즈(Main-Biz) 인증',
    score,
    eligible: score >= 60,
    met, unmet,
    recommendation: score >= 80 ? '메인비즈 인증 요건을 충족합니다. 중소벤처기업부에서 온라인 자가진단 후 신청하세요.'
      : score >= 50 ? '경영혁신 활동 실적(품질관리, 마케팅 혁신 등)을 보강하세요.'
      : '업력 3년, 매출 실적 등 기본 요건을 먼저 갖추세요.',
  };
}

// ─── ISO 9001 (품질경영시스템) ───
function checkISO9001(data: CompanyData): CertEligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];

  if ((data.employeeCount || 0) >= 5) met.push('일정 규모 이상 조직');
  else unmet.push('소규모 조직 (인증비용 대비 효과 검토 필요)');

  if ((data.revenueYear1 || 0) > 0) met.push('매출 실적 있음');
  else unmet.push('매출 실적 없음');

  // ISO는 기본적으로 누구나 신청 가능
  met.push('ISO 인증은 업종/규모 제한 없음');

  const score = Math.round((met.length / (met.length + unmet.length)) * 100);
  return {
    certType: 'iso9001',
    certName: 'ISO 9001 (품질경영시스템)',
    score,
    eligible: true,
    met, unmet,
    recommendation: '인증심사기관을 선정하여 1단계(문서심사) → 2단계(현장심사)를 진행합니다. 보통 3~6개월 소요되며 컨설팅 병행을 권장합니다.',
  };
}

// ─── 여성기업 ───
function checkWomenBiz(data: CompanyData): CertEligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];

  if (isSmallBiz(data)) met.push('중소기업 해당');
  else unmet.push('중소기업 기준 초과');

  // 대표자 성별 확인
  if (data.ceoGender === 'female') {
    met.push('여성 대표자 확인');
  } else if (data.ceoGender === 'male') {
    unmet.push('남성 대표자 (여성 대표자 필수)');
  } else {
    unmet.push('대표자 성별 미입력 (기업정보에서 입력해주세요)');
  }

  if ((data.revenueYear1 || 0) > 0) met.push('매출 실적 있음');

  const years = yearsSince(data.foundedDate || data.establishmentDate);
  if (years > 0) met.push(`업력 ${years}년`);

  const score = data.ceoGender === 'female'
    ? Math.round((met.length / (met.length + unmet.length)) * 100)
    : data.ceoGender === 'male' ? 20 : 30;

  return {
    certType: 'women_biz',
    certName: '여성기업 확인',
    score,
    eligible: data.ceoGender === 'female' && isSmallBiz(data),
    met, unmet,
    recommendation: data.ceoGender === 'female'
      ? '여성기업 인증 요건을 충족합니다. 한국여성경제인협회에서 온라인으로 신청하세요.'
      : data.ceoGender === 'male'
        ? '여성기업 인증은 여성 대표자(최대주주)인 경우에만 가능합니다.'
        : '대표자 성별 정보를 마이페이지 > 기업정보에서 입력해주세요. 여성 대표자인 경우 인증 가능합니다.',
  };
}

// ─── 소셜벤처 ───
function checkSocialVenture(data: CompanyData): CertEligibilityResult {
  const met: string[] = [];
  const unmet: string[] = [];

  if (isSmallBiz(data)) met.push('중소기업 해당');
  else unmet.push('중소기업 기준 초과');

  const years = yearsSince(data.foundedDate || data.establishmentDate);
  if (years >= 1 && years <= 7) met.push(`업력 ${years}년 (창업 7년 이내)`);
  else if (years > 7) unmet.push(`업력 ${years}년 (7년 초과)`);
  else unmet.push('설립일 미입력');

  met.push('사회적 목적 실현 확인 필요 (자가 판단)');

  const score = Math.round((met.length / (met.length + unmet.length)) * 100);
  return {
    certType: 'social_venture',
    certName: '소셜벤처 판별',
    score,
    eligible: score >= 50,
    met, unmet,
    recommendation: '사회적 가치 실현을 목적으로 하는 기업이라면, 소셜벤처 판별 위원회에 신청할 수 있습니다.',
  };
}

// ─── 메인 함수: 전체 인증 진단 ───
export function runCertificationCheck(data: CompanyData): CertEligibilityResult[] {
  return [
    checkVenture(data),
    checkInnobiz(data),
    checkMainbiz(data),
    checkISO9001(data),
    checkWomenBiz(data),
    checkSocialVenture(data),
  ].sort((a, b) => b.score - a.score);
}
