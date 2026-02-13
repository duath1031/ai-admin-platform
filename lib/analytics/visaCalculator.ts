/**
 * 비자 점수 계산기 (Visa Score Calculator)
 *
 * 지원 비자:
 * - F-2-7 (점수제 거주 비자): 나이, 소득, 학력, 한국어, 사회통합, 기여 등
 * - E-7 (특정활동): 학력, 경력, 연봉, 자격증 등
 * - D-10 (구직): 학력, 한국어, 인턴/연수, 졸업시기 등
 * - F-5 (영주): 체류기간, 소득, 범죄이력, 한국어, 사회통합 등
 * - F-6 (결혼이민): 배우자, 소득, 한국어, 동거기간 등
 *
 * 참고: 법무부 출입국관리법 시행규칙 별표 기준 (2024년 기준)
 */

// ─────────────────────────────────────────
// F-2-7 점수제 거주 비자 (총 120점 만점, 80점 이상 합격)
// ─────────────────────────────────────────

export interface F27Input {
  age: number;                       // 만 나이
  annualIncome: number;              // 연간 소득 (만원)
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool' | 'below';
  koreanDegree: boolean;             // 한국 학위 여부
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6; // TOPIK 급수
  kiipLevel: 0 | 1 | 2 | 3 | 4 | 5;       // 사회통합프로그램 단계
  workExperienceYears: number;       // 한국 내 근무 경력 (년)
  hasKoreanSpouse: boolean;          // 한국인 배우자
  hasMinorChild: boolean;            // 미성년 자녀 (한국 출생)
  volunteerHours: number;            // 봉사활동 시간
  taxPaymentYears: number;           // 납세 실적 (년)
  hasSpecialMerit: boolean;          // 특별공로 (정부표창 등)
  currentVisa: string;               // 현재 비자 종류
  stayYears: number;                 // 한국 체류 기간 (년)
}

export interface F27Result {
  totalScore: number;
  passingScore: number;
  isPassing: boolean;
  breakdown: {
    category: string;
    item: string;
    score: number;
    maxScore: number;
    note?: string;
  }[];
  recommendation: string;
  requiredDocuments: string[];
}

export function calculateF27Score(input: F27Input): F27Result {
  const breakdown: F27Result['breakdown'] = [];

  // 1. 나이 (최대 25점) - 26~30세 최고점
  let ageScore = 0;
  if (input.age >= 18 && input.age <= 25) ageScore = 20;
  else if (input.age >= 26 && input.age <= 30) ageScore = 25;
  else if (input.age >= 31 && input.age <= 35) ageScore = 23;
  else if (input.age >= 36 && input.age <= 40) ageScore = 20;
  else if (input.age >= 41 && input.age <= 45) ageScore = 15;
  else if (input.age >= 46 && input.age <= 50) ageScore = 10;
  else if (input.age > 50) ageScore = 5;
  breakdown.push({ category: '기본항목', item: '나이', score: ageScore, maxScore: 25, note: `만 ${input.age}세` });

  // 2. 학력 (최대 35점)
  const educationScoreMap: Record<string, number> = {
    doctorate: 35,
    masters: 30,
    bachelors: 25,
    associate: 20,
    highschool: 15,
    below: 10,
  };
  let educationScore = educationScoreMap[input.education] || 10;
  const educationLabel: Record<string, string> = {
    doctorate: '박사', masters: '석사', bachelors: '학사',
    associate: '전문학사', highschool: '고졸', below: '고졸 미만',
  };
  breakdown.push({ category: '기본항목', item: '학력', score: educationScore, maxScore: 35, note: educationLabel[input.education] });

  // 한국 학위 가산점 (+5)
  if (input.koreanDegree && ['doctorate', 'masters', 'bachelors'].includes(input.education)) {
    breakdown.push({ category: '기본항목', item: '한국 학위 가산', score: 5, maxScore: 5 });
    educationScore += 5;
  }

  // 3. 한국어 능력 (최대 20점)
  const topikScoreMap: Record<number, number> = { 0: 0, 1: 3, 2: 6, 3: 10, 4: 13, 5: 16, 6: 20 };
  const topikScore = topikScoreMap[input.topikLevel] || 0;
  breakdown.push({ category: '기본항목', item: 'TOPIK', score: topikScore, maxScore: 20, note: `${input.topikLevel}급` });

  // 사회통합프로그램 가산
  const kiipScoreMap: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  const kiipScore = kiipScoreMap[input.kiipLevel] || 0;
  if (kiipScore > 0) {
    breakdown.push({ category: '가산항목', item: '사회통합프로그램', score: kiipScore, maxScore: 5, note: `${input.kiipLevel}단계` });
  }

  // 4. 소득 (최대 20점) - GNI 기준
  let incomeScore = 0;
  const gni2024 = 4250; // 2024 1인 GNI 약 4,250만원
  const incomeRatio = input.annualIncome / gni2024;
  if (incomeRatio >= 2.0) incomeScore = 20;
  else if (incomeRatio >= 1.5) incomeScore = 15;
  else if (incomeRatio >= 1.0) incomeScore = 10;
  else if (incomeRatio >= 0.8) incomeScore = 5;
  else incomeScore = 0;
  breakdown.push({
    category: '기본항목', item: '연간 소득', score: incomeScore, maxScore: 20,
    note: `${input.annualIncome.toLocaleString()}만원 (GNI ${(incomeRatio * 100).toFixed(0)}%)`,
  });

  // 5. 경력 가산 (최대 10점)
  let workScore = 0;
  if (input.workExperienceYears >= 5) workScore = 10;
  else if (input.workExperienceYears >= 3) workScore = 7;
  else if (input.workExperienceYears >= 1) workScore = 4;
  if (workScore > 0) {
    breakdown.push({ category: '가산항목', item: '한국 근무경력', score: workScore, maxScore: 10, note: `${input.workExperienceYears}년` });
  }

  // 6. 사회기여 가산
  // 봉사활동 (최대 5점)
  let volunteerScore = 0;
  if (input.volunteerHours >= 100) volunteerScore = 5;
  else if (input.volunteerHours >= 50) volunteerScore = 3;
  else if (input.volunteerHours >= 20) volunteerScore = 1;
  if (volunteerScore > 0) {
    breakdown.push({ category: '가산항목', item: '봉사활동', score: volunteerScore, maxScore: 5, note: `${input.volunteerHours}시간` });
  }

  // 납세 (최대 5점)
  let taxScore = 0;
  if (input.taxPaymentYears >= 5) taxScore = 5;
  else if (input.taxPaymentYears >= 3) taxScore = 3;
  else if (input.taxPaymentYears >= 1) taxScore = 1;
  if (taxScore > 0) {
    breakdown.push({ category: '가산항목', item: '납세 실적', score: taxScore, maxScore: 5, note: `${input.taxPaymentYears}년` });
  }

  // 특별공로 (5점)
  if (input.hasSpecialMerit) {
    breakdown.push({ category: '가산항목', item: '특별공로', score: 5, maxScore: 5, note: '정부표창 등' });
  }

  // 한국인 배우자 (3점)
  if (input.hasKoreanSpouse) {
    breakdown.push({ category: '가산항목', item: '한국인 배우자', score: 3, maxScore: 3 });
  }

  // 미성년 자녀 (2점)
  if (input.hasMinorChild) {
    breakdown.push({ category: '가산항목', item: '한국 출생 미성년 자녀', score: 2, maxScore: 2 });
  }

  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const passingScore = 80;
  const isPassing = totalScore >= passingScore;

  // 추천사항
  let recommendation = '';
  if (isPassing) {
    recommendation = `축하합니다! 현재 점수 ${totalScore}점으로 F-2-7 비자 기준 ${passingScore}점을 충족합니다. 관할 출입국관리사무소에 신청하세요.`;
  } else {
    const gap = passingScore - totalScore;
    const tips: string[] = [];
    if (input.topikLevel < 4) tips.push(`TOPIK ${Math.min(input.topikLevel + 2, 6)}급 취득 시 +${topikScoreMap[Math.min(input.topikLevel + 2, 6) as keyof typeof topikScoreMap] - topikScore}점`);
    if (input.kiipLevel < 5) tips.push('사회통합프로그램 이수 시 가산점');
    if (input.volunteerHours < 100) tips.push('봉사활동 100시간 이상 시 +5점');
    recommendation = `현재 ${totalScore}점으로 ${gap}점 부족합니다. 추천: ${tips.join(', ')}`;
  }

  const requiredDocuments = [
    '여권 사본',
    '외국인등록증',
    '표준규격사진 1매',
    '수수료 (13만원)',
    '소득금액증명원 또는 근로소득원천징수영수증',
    '학력 증빙서류 (졸업증명서 + 아포스티유/영사확인)',
    input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급 성적표` : null,
    input.kiipLevel > 0 ? '사회통합프로그램 이수증' : null,
    input.hasKoreanSpouse ? '혼인관계증명서' : null,
    input.volunteerHours > 0 ? '봉사활동 확인서' : null,
    '납세증명서 (국세/지방세)',
    '체류지 입증서류',
  ].filter(Boolean) as string[];

  return { totalScore, passingScore, isPassing, breakdown, recommendation, requiredDocuments };
}

// ─────────────────────────────────────────
// E-7 특정활동 비자 적격성 평가
// ─────────────────────────────────────────

export interface E7Input {
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool';
  fieldMatchesDegree: boolean;       // 전공-직종 일치
  workExperienceYears: number;       // 관련 경력 (년)
  annualSalary: number;              // 연봉 (만원)
  companySize: 'large' | 'medium' | 'small' | 'startup';
  hasNationalCert: boolean;          // 국가기술자격증
  occupationCode: string;            // 직업분류코드 (E-7-1, E-7-3, E-7-4 등)
  isInnopolisCompany: boolean;       // 이노폴리스(연구단지) 입주기업
  koreanLanguage: 'topik3+' | 'topik2' | 'kiip3+' | 'none';
}

export interface E7Result {
  totalScore: number;
  isPassing: boolean;
  passingScore: number;
  breakdown: {
    category: string;
    item: string;
    score: number;
    maxScore: number;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
}

export function evaluateE7Eligibility(input: E7Input): E7Result {
  const breakdown: E7Result['breakdown'] = [];
  const warnings: string[] = [];

  // E-7 점수는 고용추천서 심사 기준 (총 100점)

  // 1. 학력 (최대 30점)
  const eduScore: Record<string, number> = {
    doctorate: 30, masters: 25, bachelors: 20, associate: 15, highschool: 10,
  };
  const eduLabels: Record<string, string> = {
    doctorate: '박사', masters: '석사', bachelors: '학사', associate: '전문학사', highschool: '고졸',
  };
  const educationScore = eduScore[input.education] || 10;
  breakdown.push({ category: '학력', item: '최종학력', score: educationScore, maxScore: 30, note: eduLabels[input.education] });

  // 전공일치 가산 (+5)
  if (input.fieldMatchesDegree) {
    breakdown.push({ category: '학력', item: '전공-직종 일치', score: 5, maxScore: 5 });
  }

  // 2. 경력 (최대 25점)
  let careerScore = 0;
  if (input.workExperienceYears >= 10) careerScore = 25;
  else if (input.workExperienceYears >= 7) careerScore = 20;
  else if (input.workExperienceYears >= 5) careerScore = 15;
  else if (input.workExperienceYears >= 3) careerScore = 10;
  else if (input.workExperienceYears >= 1) careerScore = 5;
  breakdown.push({ category: '경력', item: '관련 경력', score: careerScore, maxScore: 25, note: `${input.workExperienceYears}년` });

  // 3. 연봉 (최대 20점) - GNI 대비
  const gni = 4250;
  let salaryScore = 0;
  const salaryRatio = input.annualSalary / gni;
  if (salaryRatio >= 2.0) salaryScore = 20;
  else if (salaryRatio >= 1.5) salaryScore = 15;
  else if (salaryRatio >= 1.0) salaryScore = 10;
  else if (salaryRatio >= 0.8) salaryScore = 5;
  breakdown.push({
    category: '처우', item: '연봉 수준', score: salaryScore, maxScore: 20,
    note: `${input.annualSalary.toLocaleString()}만원 (GNI ${(salaryRatio * 100).toFixed(0)}%)`,
  });

  // 최저임금 미달 경고
  const minWageAnnual = 2568; // 2024 최저임금 기준 연봉 약 2,568만원
  if (input.annualSalary < minWageAnnual) {
    warnings.push('연봉이 최저임금 기준 미달입니다. E-7 비자 발급이 거부될 수 있습니다.');
  }

  // 4. 기업 규모 (최대 10점)
  const companyScores: Record<string, number> = { large: 10, medium: 7, small: 5, startup: 3 };
  const companyLabels: Record<string, string> = {
    large: '대기업', medium: '중견기업', small: '중소기업', startup: '스타트업',
  };
  const companyScore = companyScores[input.companySize] || 3;
  breakdown.push({ category: '기업', item: '고용기업 규모', score: companyScore, maxScore: 10, note: companyLabels[input.companySize] });

  // 이노폴리스 가산 (+3)
  if (input.isInnopolisCompany) {
    breakdown.push({ category: '기업', item: '이노폴리스 입주기업', score: 3, maxScore: 3 });
  }

  // 5. 자격증 (최대 5점)
  if (input.hasNationalCert) {
    breakdown.push({ category: '자격', item: '국가기술자격증', score: 5, maxScore: 5 });
  }

  // 6. 한국어 능력 (최대 5점)
  const langScores: Record<string, number> = { 'topik3+': 5, 'topik2': 3, 'kiip3+': 4, none: 0 };
  const langLabels: Record<string, string> = { 'topik3+': 'TOPIK 3급 이상', 'topik2': 'TOPIK 2급', 'kiip3+': '사회통합 3단계+', none: '없음' };
  const langScore = langScores[input.koreanLanguage] || 0;
  if (langScore > 0) {
    breakdown.push({ category: '한국어', item: '한국어 능력', score: langScore, maxScore: 5, note: langLabels[input.koreanLanguage] });
  }

  // E-7 하위 유형별 추가 요건 경고
  if (input.occupationCode === 'E-7-4' && input.education === 'highschool' && input.workExperienceYears < 5) {
    warnings.push('E-7-4(숙련기능인력)은 고졸의 경우 최소 5년 경력이 필요합니다.');
  }

  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const passingScore = 60;
  const isPassing = totalScore >= passingScore;

  let recommendation = '';
  if (isPassing) {
    recommendation = `E-7 비자 심사 예상 점수 ${totalScore}점으로 기준(${passingScore}점)을 충족합니다. 고용추천서를 발급받아 관할 출입국관리사무소에 신청하세요.`;
  } else {
    recommendation = `현재 ${totalScore}점으로 기준 미달입니다. 경력 축적, 자격증 취득, TOPIK 취득을 고려하세요.`;
  }

  return { totalScore, isPassing, passingScore, breakdown, recommendation, warnings };
}

// ─────────────────────────────────────────
// D-10 구직 비자 적격성 평가
// ─────────────────────────────────────────

export interface D10Input {
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool';
  graduatedFromKorea: boolean;           // 한국 대학 졸업 여부
  graduationWithinYear: boolean;         // 졸업 후 1년 이내 여부
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hasInternExperience: boolean;          // 한국 내 인턴/연수 경험
  fieldOfStudy: string;                  // 전공 분야
  hasJobOffer: boolean;                  // 구직 활동 증빙 (초청장/추천서 등)
  currentVisa: string;                   // 현재 비자 (D-2, E-7 등)
  previousVisaViolation: boolean;        // 비자 위반 이력
  annualIncome: number;                  // 체류비용 증명 (만원)
}

export interface D10Result {
  eligible: boolean;
  eligibilityScore: number;              // 0~100 적격성 점수
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
}

export function evaluateD10Eligibility(input: D10Input): D10Result {
  const requirements: D10Result['requirements'] = [];
  const warnings: string[] = [];

  // 1. 학력 요건: 전문학사(associate) 이상
  const meetsEducation = ['doctorate', 'masters', 'bachelors', 'associate'].includes(input.education);
  const eduLabels: Record<string, string> = {
    doctorate: '박사', masters: '석사', bachelors: '학사', associate: '전문학사', highschool: '고졸',
  };
  requirements.push({
    item: '학력 요건 (전문학사 이상)',
    met: meetsEducation,
    note: eduLabels[input.education],
  });

  // 2. 한국 대학 졸업 (D-10-1 경로의 핵심 조건)
  requirements.push({
    item: '한국 대학 졸업',
    met: input.graduatedFromKorea,
    note: input.graduatedFromKorea ? '국내 대학 졸업자' : '해외 대학 졸업자 (추가 서류 필요)',
  });

  // 3. 졸업 시기 (졸업 후 1년 이내 권장)
  requirements.push({
    item: '졸업 후 1년 이내',
    met: input.graduationWithinYear,
    note: input.graduationWithinYear ? '기한 내' : '졸업 후 1년 초과 (D-10-2 고려)',
  });

  // 4. 한국어 능력 (가산 요소)
  const hasKorean = input.topikLevel >= 3;
  requirements.push({
    item: '한국어 능력 (TOPIK 3급+ 권장)',
    met: hasKorean,
    note: input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급` : '없음',
  });

  // 5. 인턴/연수 경험 (가산 요소)
  if (input.hasInternExperience) {
    requirements.push({
      item: '국내 인턴/연수 경험',
      met: true,
      note: '구직 활동 증빙에 유리',
    });
  }

  // 6. 구직 활동 증빙
  requirements.push({
    item: '구직 활동 증빙 (초청장/추천서)',
    met: input.hasJobOffer,
    note: input.hasJobOffer ? '증빙 있음' : '구직 활동 계획서 필요',
  });

  // 7. 비자 위반 이력
  if (input.previousVisaViolation) {
    warnings.push('비자 위반 이력이 있는 경우 D-10 발급이 거부될 수 있습니다.');
    requirements.push({ item: '비자 위반 이력 없음', met: false, note: '위반 이력 있음' });
  } else {
    requirements.push({ item: '비자 위반 이력 없음', met: true });
  }

  // 8. 체류비용 증명
  const meetsFinance = input.annualIncome >= 1200; // 월 100만원 이상 체류비용
  requirements.push({
    item: '체류비용 증명 (연 1,200만원+)',
    met: meetsFinance,
    note: `${input.annualIncome.toLocaleString()}만원`,
  });

  // 현재 비자 확인
  const validCurrentVisas = ['D-2', 'D-2-1', 'D-2-2', 'D-2-3', 'D-2-4', 'D-2-6', 'E-7', 'E-9'];
  if (input.currentVisa && !validCurrentVisas.some(v => input.currentVisa.startsWith(v))) {
    warnings.push(`현재 비자(${input.currentVisa})에서 D-10으로의 자격 변경이 어려울 수 있습니다.`);
  }

  // 점수 계산
  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);

  // 필수 요건: 학력 + 비자 위반 없음 + 체류비용
  const eligible = meetsEducation && !input.previousVisaViolation && meetsFinance;

  let recommendation = '';
  if (eligible && eligibilityScore >= 70) {
    recommendation = 'D-10 구직 비자 발급 가능성이 높습니다. ';
    if (input.graduatedFromKorea) {
      recommendation += '한국 대학 졸업자로서 D-10-1(구직) 신청이 가능합니다.';
    } else {
      recommendation += '해외 대학 졸업자는 D-10-2(기술창업) 또는 전문분야 경력 증빙이 필요합니다.';
    }
  } else if (eligible) {
    recommendation = 'D-10 기본 요건은 충족하나, 추가 서류 보강이 필요합니다. TOPIK 취득, 인턴 경험이 도움됩니다.';
  } else {
    const missing: string[] = [];
    if (!meetsEducation) missing.push('전문학사 이상 학력');
    if (input.previousVisaViolation) missing.push('비자 위반 이력 해소');
    if (!meetsFinance) missing.push('체류비용 증명');
    recommendation = `D-10 비자 요건이 충족되지 않습니다. 미충족 사항: ${missing.join(', ')}`;
  }

  const requiredDocuments = [
    '여권 원본 및 사본',
    '외국인등록증 (해당시)',
    '표준규격사진 1매',
    '졸업증명서 (아포스티유/영사확인)',
    input.graduatedFromKorea ? '국내 대학 졸업증명서' : '해외 학위 인증서류',
    '구직 활동 계획서',
    input.hasJobOffer ? '고용추천서 또는 초청장' : null,
    '체류비용 입증서류 (잔고증명서 등)',
    input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급 성적표` : null,
    input.hasInternExperience ? '인턴/연수 경력증명서' : null,
    '수수료 (13만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, requirements, recommendation, warnings, requiredDocuments };
}

// ─────────────────────────────────────────
// F-5 영주 비자 적격성 평가
// ─────────────────────────────────────────

export interface F5Input {
  currentVisa: string;                   // 현재 비자 종류
  stayYears: number;                     // 한국 체류 기간 (년)
  age: number;                           // 만 나이
  annualIncome: number;                  // 연간 소득 (만원)
  realEstateValue: number;               // 부동산 자산 (만원)
  totalAssets: number;                    // 총 자산 (만원)
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool' | 'below';
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  kiipCompleted: boolean;               // 사회통합프로그램 5단계 이수
  hasCriminalRecord: boolean;           // 범죄 이력
  taxPaymentYears: number;              // 납세 실적 (년)
  hasKoreanSpouse: boolean;             // 한국인 배우자
  hasMinorChildren: boolean;            // 미성년 자녀
  f27ScoreAbove80: boolean;             // F-2-7 점수 80점 이상 (해당시)
  investmentAmount: number;             // 투자금액 (만원, F-5-3 투자이민용)
}

export interface F5Result {
  eligible: boolean;
  eligibilityType: string;               // F-5-1(일반), F-5-2(투자), F-5-10(점수제) 등
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
}

export function evaluateF5Eligibility(input: F5Input): F5Result {
  const requirements: F5Result['requirements'] = [];
  const warnings: string[] = [];

  // F-5 경로 결정
  let eligibilityType = 'F-5-1'; // 기본: 일반 영주
  if (input.investmentAmount >= 50000) eligibilityType = 'F-5-3'; // 투자이민 (5억+)
  else if (input.f27ScoreAbove80) eligibilityType = 'F-5-10'; // 점수제
  else if (input.hasKoreanSpouse) eligibilityType = 'F-5-2'; // 결혼이민

  // 1. 체류 기간 요건
  const requiredStayYears: Record<string, number> = {
    'F-5-1': 5, 'F-5-2': 2, 'F-5-3': 3, 'F-5-10': 3,
  };
  const minStay = requiredStayYears[eligibilityType] || 5;
  const meetsStay = input.stayYears >= minStay;
  requirements.push({
    item: `체류 기간 (${minStay}년 이상)`,
    met: meetsStay,
    note: `${input.stayYears}년 체류 (${eligibilityType} 기준)`,
  });

  // 2. 소득 요건 (GNI 기준)
  const gni = 4250;
  const incomeRatio = input.annualIncome / gni;
  const meetsIncome = incomeRatio >= 1.0;
  requirements.push({
    item: '소득 요건 (GNI 100% 이상)',
    met: meetsIncome,
    note: `${input.annualIncome.toLocaleString()}만원 (GNI ${(incomeRatio * 100).toFixed(0)}%)`,
  });

  // 3. 자산 요건 (투자이민의 경우)
  if (eligibilityType === 'F-5-3') {
    const meetsInvestment = input.investmentAmount >= 50000;
    requirements.push({
      item: '투자금액 (5억원 이상)',
      met: meetsInvestment,
      note: `${(input.investmentAmount / 10000).toFixed(1)}억원`,
    });
  }

  // 4. 기본소양 요건
  const meetsKorean = input.topikLevel >= 4 || input.kiipCompleted;
  requirements.push({
    item: '기본소양 (TOPIK 4급+ 또는 사회통합프로그램 5단계)',
    met: meetsKorean,
    note: input.kiipCompleted
      ? '사회통합프로그램 이수'
      : input.topikLevel > 0
        ? `TOPIK ${input.topikLevel}급`
        : '미충족',
  });

  // 5. 범죄 이력
  if (input.hasCriminalRecord) {
    requirements.push({ item: '범죄 이력 없음', met: false, note: '범죄 이력 있음 - 영주 자격 결격 사유' });
    warnings.push('범죄 이력이 있는 경우 F-5 영주 비자가 거부될 수 있습니다. 사면/복권 여부를 확인하세요.');
  } else {
    requirements.push({ item: '범죄 이력 없음', met: true });
  }

  // 6. 납세 실적
  const meetsTax = input.taxPaymentYears >= 3;
  requirements.push({
    item: '납세 실적 (3년 이상)',
    met: meetsTax,
    note: `${input.taxPaymentYears}년 납세`,
  });

  // 7. 현재 비자 적합성
  const validF5BaseVisas = ['F-2', 'F-2-7', 'E-7', 'D-8', 'D-9', 'F-6'];
  const hasValidBase = validF5BaseVisas.some(v => input.currentVisa.startsWith(v));
  requirements.push({
    item: '적합한 현재 체류자격',
    met: hasValidBase,
    note: input.currentVisa || '미입력',
  });
  if (!hasValidBase && input.currentVisa) {
    warnings.push(`현재 비자(${input.currentVisa})에서 직접 F-5 전환이 어려울 수 있습니다. F-2-7 등 중간 단계를 거치는 것을 권장합니다.`);
  }

  // 8. 나이 요건 (성인)
  requirements.push({
    item: '성인 (만 19세 이상)',
    met: input.age >= 19,
    note: `만 ${input.age}세`,
  });

  // 적격 판정
  const criticalMet = meetsStay && !input.hasCriminalRecord && meetsKorean && input.age >= 19;
  const financialMet = meetsIncome || input.totalAssets >= 30000; // 소득 또는 자산 3억+
  const eligible = criticalMet && financialMet && hasValidBase;

  let recommendation = '';
  if (eligible) {
    recommendation = `${eligibilityType} 영주 비자 신청 요건을 충족합니다. `;
    if (eligibilityType === 'F-5-10') {
      recommendation += 'F-2-7 점수제를 통한 영주 경로이며, 가장 일반적인 영주 취득 방법입니다.';
    } else if (eligibilityType === 'F-5-2') {
      recommendation += '결혼이민 영주권은 혼인관계 유지, 기본소양 충족이 핵심입니다.';
    } else if (eligibilityType === 'F-5-3') {
      recommendation += '투자이민 영주권은 투자 상태 유지 확인이 필요합니다.';
    } else {
      recommendation += '관할 출입국관리사무소에 신청하세요.';
    }
  } else {
    const missing: string[] = [];
    if (!meetsStay) missing.push(`체류 기간 ${minStay - input.stayYears}년 부족`);
    if (!financialMet) missing.push('소득/자산 요건 미충족');
    if (!meetsKorean) missing.push('한국어/사회통합 미충족');
    if (input.hasCriminalRecord) missing.push('범죄 이력');
    if (!hasValidBase) missing.push('현재 비자 부적합');
    recommendation = `현재 F-5 영주 비자 요건이 일부 충족되지 않습니다. 미충족: ${missing.join(', ')}`;
  }

  const requiredDocuments = [
    '여권 원본 및 사본',
    '외국인등록증',
    '표준규격사진 1매',
    '체류지 입증서류',
    '소득금액증명원',
    '납세증명서 (국세 + 지방세)',
    input.kiipCompleted ? '사회통합프로그램 이수증 (5단계)' : null,
    input.topikLevel >= 4 ? `TOPIK ${input.topikLevel}급 성적표` : null,
    '신원조회 동의서',
    input.hasKoreanSpouse ? '혼인관계증명서' : null,
    input.realEstateValue > 0 ? '부동산 등기부등본' : null,
    eligibilityType === 'F-5-3' ? '투자 증빙서류 (외국인투자기업 등록증 등)' : null,
    '수수료 (23만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityType, requirements, recommendation, warnings, requiredDocuments };
}

// ─────────────────────────────────────────
// F-6 결혼이민 비자 적격성 평가
// ─────────────────────────────────────────

export interface F6Input {
  hasKoreanSpouse: boolean;              // 한국인 배우자 여부
  marriageRegistered: boolean;           // 혼인신고 완료 여부
  cohabitationMonths: number;            // 동거 기간 (월)
  spouseAnnualIncome: number;            // 배우자(초청인) 연간 소득 (만원)
  combinedIncome: number;                // 부부 합산 소득 (만원)
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hasBasicKorean: boolean;               // 기초 한국어 소통 가능
  hasChildren: boolean;                  // 자녀 유무
  spouseHasNoCriminalRecord: boolean;    // 배우자 범죄 이력 없음
  applicantHasNoCriminalRecord: boolean; // 신청인 범죄 이력 없음
  previousMarriageCount: number;         // 이전 결혼 횟수
  ageGap: number;                        // 나이 차이 (세)
  metInPerson: boolean;                  // 직접 만남 (중개업체 아닌 경우)
  spouseResidence: string;               // 배우자 거주지 (시/도)
  subType: 'F-6-1' | 'F-6-2' | 'F-6-3'; // 하위 유형
}

export interface F6Result {
  eligible: boolean;
  eligibilityScore: number;              // 0~100
  subType: string;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
}

export function evaluateF6Eligibility(input: F6Input): F6Result {
  const requirements: F6Result['requirements'] = [];
  const warnings: string[] = [];

  // F-6 하위 유형: F-6-1(배우자), F-6-2(자녀양육), F-6-3(혼인파탄 귀책없음)

  // 1. 한국인 배우자 (F-6-1 핵심 조건)
  if (input.subType === 'F-6-1') {
    requirements.push({
      item: '한국인 배우자',
      met: input.hasKoreanSpouse,
      note: input.hasKoreanSpouse ? '한국 국적 배우자 있음' : '한국 국적 배우자 없음',
    });
  }

  // 2. 혼인신고
  requirements.push({
    item: '혼인신고 완료',
    met: input.marriageRegistered,
    note: input.marriageRegistered ? '혼인신고 완료' : '혼인신고 미완료',
  });

  // 3. 소득 요건 (초청인 기준)
  // 2인 가구 기준 중위소득의 100% 이상
  const medianIncome2Person = 3683; // 2024년 2인 가구 중위소득 약 3,683만원/년
  const householdSize = input.hasChildren ? 3 : 2;
  const medianIncome3Person = 4715; // 3인 가구
  const requiredIncome = householdSize >= 3 ? medianIncome3Person : medianIncome2Person;
  const effectiveIncome = Math.max(input.spouseAnnualIncome, input.combinedIncome);
  const meetsIncome = effectiveIncome >= requiredIncome;
  requirements.push({
    item: `소득 요건 (${householdSize}인 가구 중위소득 이상)`,
    met: meetsIncome,
    note: `합산 소득 ${effectiveIncome.toLocaleString()}만원 / 기준 ${requiredIncome.toLocaleString()}만원`,
  });

  // 4. 한국어 능력
  const meetsKorean = input.topikLevel >= 1 || input.hasBasicKorean;
  requirements.push({
    item: '기초 한국어 소통',
    met: meetsKorean,
    note: input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급` : (input.hasBasicKorean ? '기초 소통 가능' : '소통 불가'),
  });

  // 5. 배우자 범죄 이력
  requirements.push({
    item: '초청인(배우자) 범죄 이력 없음',
    met: input.spouseHasNoCriminalRecord,
    note: input.spouseHasNoCriminalRecord ? '이상 없음' : '범죄 이력 있음',
  });
  if (!input.spouseHasNoCriminalRecord) {
    warnings.push('초청인(배우자)에게 가정폭력, 성범죄 등의 전력이 있으면 초청이 제한됩니다.');
  }

  // 6. 신청인 범죄 이력
  requirements.push({
    item: '신청인 범죄 이력 없음',
    met: input.applicantHasNoCriminalRecord,
    note: input.applicantHasNoCriminalRecord ? '이상 없음' : '범죄 이력 있음',
  });

  // 7. 동거 관계 (최소 동거 또는 교류 입증)
  if (input.subType === 'F-6-1') {
    const meetsCohabitation = input.cohabitationMonths > 0 || input.metInPerson;
    requirements.push({
      item: '실질적 혼인관계 입증',
      met: meetsCohabitation,
      note: input.cohabitationMonths > 0
        ? `동거 ${input.cohabitationMonths}개월`
        : (input.metInPerson ? '직접 만남 입증' : '교류 증빙 필요'),
    });
  }

  // 8. 자녀 (F-6-2의 경우 필수)
  if (input.subType === 'F-6-2') {
    requirements.push({
      item: '미성년 자녀 양육',
      met: input.hasChildren,
      note: input.hasChildren ? '자녀 양육 중' : 'F-6-2는 자녀 양육이 필수',
    });
  }

  // 추가 심사 위험 요소 경고
  if (input.previousMarriageCount >= 2) {
    warnings.push(`이전 결혼 ${input.previousMarriageCount}회: 위장결혼 심사가 강화될 수 있습니다.`);
  }
  if (input.ageGap >= 20) {
    warnings.push(`나이 차이 ${input.ageGap}세: 실질적 혼인관계 입증에 추가 서류가 필요할 수 있습니다.`);
  }
  if (!input.metInPerson) {
    warnings.push('결혼중개업체를 통한 경우, 직접 만남 증빙(항공권, 사진, 통화기록)이 반드시 필요합니다.');
  }

  // 점수 계산
  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);

  // 적격 판정
  const coreEligible = input.marriageRegistered
    && input.applicantHasNoCriminalRecord
    && input.spouseHasNoCriminalRecord
    && meetsKorean;

  let eligible = false;
  if (input.subType === 'F-6-1') {
    eligible = coreEligible && input.hasKoreanSpouse && meetsIncome;
  } else if (input.subType === 'F-6-2') {
    eligible = input.hasChildren && input.applicantHasNoCriminalRecord;
  } else if (input.subType === 'F-6-3') {
    eligible = input.applicantHasNoCriminalRecord; // 귀책 없는 혼인파탄
  }

  const subTypeLabels: Record<string, string> = {
    'F-6-1': '국민의 배우자',
    'F-6-2': '미성년 자녀 양육',
    'F-6-3': '혼인파탄 (귀책 없음)',
  };

  let recommendation = '';
  if (eligible && eligibilityScore >= 70) {
    recommendation = `${subTypeLabels[input.subType]} 자격으로 F-6 결혼이민 비자 신청이 가능합니다. `;
    if (input.topikLevel >= 4) {
      recommendation += '한국어 능력이 우수하여 심사에 유리합니다.';
    } else {
      recommendation += '기초 한국어 능력 향상(TOPIK 취득)이 향후 체류 연장 및 영주(F-5) 전환에 도움됩니다.';
    }
  } else if (eligible) {
    recommendation = 'F-6 기본 요건은 충족하나, 소득 증빙 및 혼인 실질관계 입증 서류를 충분히 준비하세요.';
  } else {
    const missing: string[] = [];
    if (!input.marriageRegistered) missing.push('혼인신고');
    if (!input.hasKoreanSpouse && input.subType === 'F-6-1') missing.push('한국인 배우자');
    if (!meetsIncome) missing.push('소득 요건');
    if (!meetsKorean) missing.push('한국어 능력');
    if (!input.spouseHasNoCriminalRecord) missing.push('배우자 범죄 이력');
    recommendation = `F-6 결혼이민 비자 요건이 일부 충족되지 않습니다. 미충족: ${missing.join(', ')}`;
  }

  const requiredDocuments = [
    '여권 원본 및 사본',
    '표준규격사진 1매',
    '혼인관계증명서 (상세)',
    '배우자 주민등록등본',
    '배우자 신원보증서',
    '초청장',
    '소득 입증서류 (재직증명서 + 소득금액증명원)',
    '배우자 범죄경력회보서',
    input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급 성적표` : '한국어 능력 입증서류',
    '교제 경위서 (사진, 통화내역 등 첨부)',
    input.hasChildren ? '자녀 출생증명서 (가족관계증명서)' : null,
    '건강진단서',
    input.subType === 'F-6-3' ? '혼인파탄 귀책 없음 입증서류 (판결문 등)' : null,
    '수수료 (13만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, subType: input.subType, requirements, recommendation, warnings, requiredDocuments };
}
