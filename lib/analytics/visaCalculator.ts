/**
 * 비자 점수 계산기 (Visa Score Calculator)
 *
 * 지원 비자:
 * - F-2-7 (점수제 거주 비자): 나이, 소득, 학력, 한국어, 사회통합, 기여 등
 * - E-7 (특정활동): 학력, 경력, 연봉, 자격증 등
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
