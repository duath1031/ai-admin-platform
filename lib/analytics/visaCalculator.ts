/**
 * 비자 점수 계산기 (Visa Score Calculator) v2.0
 *
 * 지원 비자 (8종):
 * - F-2-7 (점수제 거주 비자): 나이, 소득, 학력, 한국어, 사회통합, 기여 등
 * - E-7 (특정활동): 학력, 경력, 연봉, 자격증 등
 * - D-10 (구직): 학력, 한국어, 인턴/연수, 졸업시기 등
 * - F-5 (영주): 체류기간, 소득, 범죄이력, 한국어, 사회통합 등
 * - F-6 (결혼이민): 배우자, 소득, 한국어, 동거기간 등
 * - D-2 (유학): 입학허가, 재정능력, 한국어, 학력 등
 * - E-9 (비전문취업): EPS, 한국어, 건강, 기능시험 등
 * - D-8 (기업투자): 투자금액, 사업계획, 고용창출 등
 *
 * 참고: 법무부 출입국관리법 시행규칙 별표 기준 (2026년 기준)
 */

// ─────────────────────────────────────────
// 2026년 기준 상수
// ─────────────────────────────────────────
const GNI_2026 = 4500; // 2026 1인 GNI 약 4,500만원 (추정)
const MIN_WAGE_ANNUAL_2026 = 2558; // 2026 최저임금 기준 연봉 약 2,558만원 (10,200원/시 * 209시 * 12월)
const MIN_WAGE_HOURLY_2026 = 10200; // 2026 최저시급 (원)
const MEDIAN_INCOME_2P_2026 = 3800; // 2026 2인가구 기준 중위소득 (만원/년)
const MEDIAN_INCOME_3P_2026 = 4900; // 2026 3인가구 기준 중위소득 (만원/년)
const MEDIAN_INCOME_4P_2026 = 5900; // 2026 4인가구 기준 중위소득 (만원/년)

// ─────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────
export interface VisaPathway {
  from: string;
  to: string;
  requirements: string[];
  estimatedYears: number;
  difficulty: 'easy' | 'moderate' | 'hard';
}

export interface ProcessingEstimate {
  standardDays: number;
  fastTrackDays?: number;
  interviewLikelihood: 'low' | 'medium' | 'high';
  interviewNote?: string;
}

// ─────────────────────────────────────────
// F-2-7 점수제 거주 비자 (총 120점 만점, 80점 이상 합격)
// ─────────────────────────────────────────

export interface F27Input {
  age: number;
  annualIncome: number;
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool' | 'below';
  koreanDegree: boolean;
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  kiipLevel: 0 | 1 | 2 | 3 | 4 | 5;
  workExperienceYears: number;
  hasKoreanSpouse: boolean;
  hasMinorChild: boolean;
  volunteerHours: number;
  taxPaymentYears: number;
  hasSpecialMerit: boolean;
  currentVisa: string;
  stayYears: number;
  hasTechnicalCert: boolean;
  certLevel: 'master' | 'engineer' | 'technician' | 'craftsman' | 'none';
  hasRealEstate: boolean;
  realEstateValue: number;
  regionType: 'metro' | 'city' | 'rural';
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
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
  improvementTips: string[];
}

export function calculateF27Score(input: F27Input): F27Result {
  const breakdown: F27Result['breakdown'] = [];
  const improvementTips: string[] = [];

  // 1. 나이 (최대 25점) - 세분화된 점수
  let ageScore = 0;
  if (input.age >= 18 && input.age <= 22) ageScore = 15;
  else if (input.age >= 23 && input.age <= 25) ageScore = 20;
  else if (input.age >= 26 && input.age <= 28) ageScore = 25;
  else if (input.age >= 29 && input.age <= 30) ageScore = 23;
  else if (input.age >= 31 && input.age <= 33) ageScore = 22;
  else if (input.age >= 34 && input.age <= 35) ageScore = 20;
  else if (input.age >= 36 && input.age <= 38) ageScore = 18;
  else if (input.age >= 39 && input.age <= 40) ageScore = 15;
  else if (input.age >= 41 && input.age <= 45) ageScore = 12;
  else if (input.age >= 46 && input.age <= 50) ageScore = 8;
  else if (input.age > 50) ageScore = 5;
  breakdown.push({ category: '기본항목', item: '나이', score: ageScore, maxScore: 25, note: `만 ${input.age}세` });

  // 2. 학력 (최대 35점)
  const educationScoreMap: Record<string, number> = {
    doctorate: 35, masters: 30, bachelors: 25, associate: 20, highschool: 15, below: 10,
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
  } else if (!input.koreanDegree && ['doctorate', 'masters', 'bachelors'].includes(input.education)) {
    improvementTips.push('한국 대학에서 학위를 취득하면 +5점 가산됩니다.');
  }

  // 3. 한국어 능력 (최대 20점)
  const topikScoreMap: Record<number, number> = { 0: 0, 1: 2, 2: 5, 3: 10, 4: 13, 5: 16, 6: 20 };
  const topikScore = topikScoreMap[input.topikLevel] || 0;
  breakdown.push({ category: '기본항목', item: 'TOPIK', score: topikScore, maxScore: 20, note: input.topikLevel > 0 ? `${input.topikLevel}급` : '미취득' });

  if (input.topikLevel < 6) {
    const nextLevel = Math.min(input.topikLevel + 1, 6) as keyof typeof topikScoreMap;
    const gain = topikScoreMap[nextLevel] - topikScore;
    improvementTips.push(`TOPIK ${nextLevel}급 취득 시 +${gain}점 추가 가능`);
  }

  // 사회통합프로그램 가산
  const kiipScoreMap: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  const kiipScore = kiipScoreMap[input.kiipLevel] || 0;
  if (kiipScore > 0) {
    breakdown.push({ category: '가산항목', item: '사회통합프로그램', score: kiipScore, maxScore: 5, note: `${input.kiipLevel}단계 이수` });
  } else {
    improvementTips.push('사회통합프로그램(KIIP) 이수 시 최대 +5점 가산');
  }

  // 4. 소득 (최대 20점) - GNI 기준, 세분화
  let incomeScore = 0;
  const incomeRatio = input.annualIncome / GNI_2026;
  if (incomeRatio >= 3.0) incomeScore = 20;
  else if (incomeRatio >= 2.5) incomeScore = 18;
  else if (incomeRatio >= 2.0) incomeScore = 16;
  else if (incomeRatio >= 1.5) incomeScore = 13;
  else if (incomeRatio >= 1.2) incomeScore = 11;
  else if (incomeRatio >= 1.0) incomeScore = 8;
  else if (incomeRatio >= 0.8) incomeScore = 5;
  else if (incomeRatio >= 0.5) incomeScore = 2;
  else incomeScore = 0;
  breakdown.push({
    category: '기본항목', item: '연간 소득', score: incomeScore, maxScore: 20,
    note: `${input.annualIncome.toLocaleString()}만원 (GNI 대비 ${(incomeRatio * 100).toFixed(0)}%)`,
  });

  // 5. 경력 가산 (최대 10점) - 세분화
  let workScore = 0;
  if (input.workExperienceYears >= 7) workScore = 10;
  else if (input.workExperienceYears >= 5) workScore = 8;
  else if (input.workExperienceYears >= 3) workScore = 6;
  else if (input.workExperienceYears >= 2) workScore = 4;
  else if (input.workExperienceYears >= 1) workScore = 2;
  if (workScore > 0) {
    breakdown.push({ category: '가산항목', item: '한국 근무경력', score: workScore, maxScore: 10, note: `${input.workExperienceYears}년` });
  }

  // 6. 체류기간 가산 (최대 5점) - 신규
  let stayScore = 0;
  if (input.stayYears >= 5) stayScore = 5;
  else if (input.stayYears >= 3) stayScore = 3;
  else if (input.stayYears >= 1) stayScore = 1;
  if (stayScore > 0) {
    breakdown.push({ category: '가산항목', item: '한국 체류기간', score: stayScore, maxScore: 5, note: `${input.stayYears}년` });
  }

  // 7. 기술자격증 가산 (최대 5점) - 신규
  if (input.hasTechnicalCert) {
    const certScores: Record<string, number> = { master: 5, engineer: 4, technician: 3, craftsman: 2, none: 0 };
    const certLabels: Record<string, string> = { master: '기술사/기능장', engineer: '기사', technician: '산업기사', craftsman: '기능사', none: '' };
    const certScore = certScores[input.certLevel] || 0;
    if (certScore > 0) {
      breakdown.push({ category: '가산항목', item: '국가기술자격증', score: certScore, maxScore: 5, note: certLabels[input.certLevel] });
    }
  }

  // 8. 사회기여 가산
  let volunteerScore = 0;
  if (input.volunteerHours >= 200) volunteerScore = 5;
  else if (input.volunteerHours >= 100) volunteerScore = 4;
  else if (input.volunteerHours >= 50) volunteerScore = 3;
  else if (input.volunteerHours >= 20) volunteerScore = 1;
  if (volunteerScore > 0) {
    breakdown.push({ category: '가산항목', item: '봉사활동', score: volunteerScore, maxScore: 5, note: `${input.volunteerHours}시간` });
  } else {
    improvementTips.push('봉사활동 20시간 이상 시 +1~5점 가산');
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
    breakdown.push({ category: '가산항목', item: '특별공로', score: 5, maxScore: 5, note: '정부표창/포상' });
  }

  // 한국인 배우자 (3점)
  if (input.hasKoreanSpouse) {
    breakdown.push({ category: '가산항목', item: '한국인 배우자', score: 3, maxScore: 3 });
  }

  // 미성년 자녀 (2점)
  if (input.hasMinorChild) {
    breakdown.push({ category: '가산항목', item: '한국 출생 미성년 자녀', score: 2, maxScore: 2 });
  }

  // 지방 거주 가산 (최대 3점) - 신규
  if (input.regionType === 'rural') {
    breakdown.push({ category: '가산항목', item: '비수도권 거주', score: 3, maxScore: 3, note: '농어촌 지역' });
  } else if (input.regionType === 'city') {
    breakdown.push({ category: '가산항목', item: '비수도권 거주', score: 1, maxScore: 3, note: '지방 도시' });
  }

  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const passingScore = 80;
  const isPassing = totalScore >= passingScore;

  // 추천사항
  let recommendation = '';
  if (isPassing) {
    if (totalScore >= 100) {
      recommendation = `우수한 점수입니다! ${totalScore}점으로 F-2-7 비자 기준 ${passingScore}점을 크게 초과합니다. 심사 통과 가능성이 매우 높습니다. 관할 출입국관리사무소에 바로 신청하세요.`;
    } else if (totalScore >= 90) {
      recommendation = `좋은 점수입니다! ${totalScore}점으로 안정적으로 기준을 충족합니다. 서류를 빠짐없이 준비하여 신청하세요.`;
    } else {
      recommendation = `${totalScore}점으로 기준(${passingScore}점)을 충족합니다. 다만 여유분이 크지 않으니 서류를 완벽히 준비하세요.`;
    }
  } else {
    const gap = passingScore - totalScore;
    recommendation = `현재 ${totalScore}점으로 ${gap}점 부족합니다. 아래 개선 팁을 참고하여 점수를 올린 후 재신청하세요.`;
  }

  // 비자 전환 경로
  const pathways: VisaPathway[] = [
    {
      from: 'F-2-7',
      to: 'F-5-10 (영주)',
      requirements: ['F-2-7 점수 80점 이상 유지', '3년 이상 체류', 'TOPIK 4급 이상 또는 KIIP 5단계', 'GNI 이상 소득', '범죄이력 없음'],
      estimatedYears: 3,
      difficulty: 'moderate',
    },
    {
      from: 'F-2-7',
      to: 'F-5-1 (일반 영주)',
      requirements: ['5년 이상 체류', 'TOPIK 4급+', 'GNI 이상 소득', '납세 3년+'],
      estimatedYears: 5,
      difficulty: 'moderate',
    },
    {
      from: 'F-2-7',
      to: '귀화 (대한민국 국적)',
      requirements: ['5년 이상 체류', '기본소양 시험', '생계능력 증명', '범죄이력 없음', '한국어 능력'],
      estimatedYears: 5,
      difficulty: 'hard',
    },
  ];

  // 처리 기간 추정
  const processing: ProcessingEstimate = {
    standardDays: 60,
    fastTrackDays: 30,
    interviewLikelihood: totalScore >= 90 ? 'low' : totalScore >= 80 ? 'medium' : 'high',
    interviewNote: totalScore >= 90
      ? '고득점자는 서류심사로 완료되는 경우가 많습니다.'
      : totalScore >= 80
        ? '경계 점수대로 면접 가능성이 있습니다. 서류를 완벽히 준비하세요.'
        : '점수 미달 시 면접으로 보완 설명 기회가 주어질 수 있습니다.',
  };

  const requiredDocuments = [
    '여권 사본',
    '외국인등록증',
    '표준규격사진 1매 (3.5cm x 4.5cm)',
    '수수료 (13만원)',
    '소득금액증명원 또는 근로소득원천징수영수증',
    '학력 증빙서류 (졸업증명서 + 아포스티유/영사확인)',
    input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급 성적표 (유효기간 2년 이내)` : null,
    input.kiipLevel > 0 ? `사회통합프로그램 ${input.kiipLevel}단계 이수증` : null,
    input.hasKoreanSpouse ? '혼인관계증명서 (3개월 이내)' : null,
    input.volunteerHours > 0 ? '봉사활동 확인서 (1365 자원봉사포털)' : null,
    input.hasTechnicalCert ? '국가기술자격증 사본' : null,
    '납세증명서 (국세 + 지방세)',
    '체류지 입증서류 (임대차계약서 등)',
    '건강보험 가입확인서',
    '신청서 (체류자격변경 허가신청서)',
  ].filter(Boolean) as string[];

  return { totalScore, passingScore, isPassing, breakdown, recommendation, requiredDocuments, pathways, processing, improvementTips };
}

// ─────────────────────────────────────────
// E-7 특정활동 비자 적격성 평가
// ─────────────────────────────────────────

export interface E7Input {
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool';
  fieldMatchesDegree: boolean;
  workExperienceYears: number;
  annualSalary: number;
  companySize: 'large' | 'medium' | 'small' | 'startup';
  hasNationalCert: boolean;
  occupationCode: string;
  isInnopolisCompany: boolean;
  koreanLanguage: 'topik4+' | 'topik3' | 'topik2' | 'kiip3+' | 'none';
  companyEmployees: number;
  foreignWorkerRatio: number;
  isSMESpecial: boolean;
  hasAwardOrPatent: boolean;
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
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
  improvementTips: string[];
}

export function evaluateE7Eligibility(input: E7Input): E7Result {
  const breakdown: E7Result['breakdown'] = [];
  const warnings: string[] = [];
  const improvementTips: string[] = [];

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
  } else {
    improvementTips.push('전공과 직종이 일치하면 +5점 가산됩니다. 관련 자격증으로 보완 가능합니다.');
  }

  // 2. 경력 (최대 25점) - 세분화
  let careerScore = 0;
  if (input.workExperienceYears >= 10) careerScore = 25;
  else if (input.workExperienceYears >= 7) careerScore = 20;
  else if (input.workExperienceYears >= 5) careerScore = 15;
  else if (input.workExperienceYears >= 3) careerScore = 10;
  else if (input.workExperienceYears >= 2) careerScore = 7;
  else if (input.workExperienceYears >= 1) careerScore = 5;
  else careerScore = 0;
  breakdown.push({ category: '경력', item: '관련 경력', score: careerScore, maxScore: 25, note: `${input.workExperienceYears}년` });

  if (input.workExperienceYears < 3 && input.education === 'highschool') {
    warnings.push('고졸의 경우 관련 분야 최소 5년 경력이 권장됩니다.');
  }

  // 3. 연봉 (최대 20점) - GNI 대비, 세분화
  let salaryScore = 0;
  const salaryRatio = input.annualSalary / GNI_2026;
  if (salaryRatio >= 3.0) salaryScore = 20;
  else if (salaryRatio >= 2.5) salaryScore = 18;
  else if (salaryRatio >= 2.0) salaryScore = 16;
  else if (salaryRatio >= 1.5) salaryScore = 13;
  else if (salaryRatio >= 1.2) salaryScore = 10;
  else if (salaryRatio >= 1.0) salaryScore = 8;
  else if (salaryRatio >= 0.8) salaryScore = 5;
  else salaryScore = 2;
  breakdown.push({
    category: '처우', item: '연봉 수준', score: salaryScore, maxScore: 20,
    note: `${input.annualSalary.toLocaleString()}만원 (GNI 대비 ${(salaryRatio * 100).toFixed(0)}%)`,
  });

  if (input.annualSalary < MIN_WAGE_ANNUAL_2026) {
    warnings.push(`연봉(${input.annualSalary.toLocaleString()}만원)이 2026년 최저임금 기준(${MIN_WAGE_ANNUAL_2026.toLocaleString()}만원) 미달입니다. E-7 비자 발급이 거부될 수 있습니다.`);
  }

  // 4. 기업 규모 (최대 10점)
  const companyScores: Record<string, number> = { large: 10, medium: 7, small: 5, startup: 3 };
  const companyLabels: Record<string, string> = {
    large: '대기업 (300인+)', medium: '중견기업 (100~299인)', small: '중소기업 (10~99인)', startup: '스타트업 (10인 미만)',
  };
  const companyScore = companyScores[input.companySize] || 3;
  breakdown.push({ category: '기업', item: '고용기업 규모', score: companyScore, maxScore: 10, note: companyLabels[input.companySize] });

  // 이노폴리스 가산 (+3)
  if (input.isInnopolisCompany) {
    breakdown.push({ category: '기업', item: '이노폴리스/연구단지 입주', score: 3, maxScore: 3 });
  }

  // 중소기업 특별 가산 (+2)
  if (input.isSMESpecial && ['small', 'startup'].includes(input.companySize)) {
    breakdown.push({ category: '기업', item: '인력난 중소기업 특별', score: 2, maxScore: 2, note: '고용노동부 지정' });
  }

  // 5. 자격증 (최대 5점)
  if (input.hasNationalCert) {
    breakdown.push({ category: '자격', item: '국가기술자격증', score: 5, maxScore: 5 });
  } else {
    improvementTips.push('관련 분야 국가기술자격증 취득 시 +5점 가산');
  }

  // 수상/특허 가산 (+3)
  if (input.hasAwardOrPatent) {
    breakdown.push({ category: '자격', item: '수상/특허 실적', score: 3, maxScore: 3, note: '정부 수상 또는 특허 등록' });
  }

  // 6. 한국어 능력 (최대 5점) - 세분화
  const langScores: Record<string, number> = { 'topik4+': 5, 'topik3': 4, 'topik2': 3, 'kiip3+': 4, none: 0 };
  const langLabels: Record<string, string> = { 'topik4+': 'TOPIK 4급 이상', 'topik3': 'TOPIK 3급', 'topik2': 'TOPIK 2급', 'kiip3+': '사회통합 3단계+', none: '없음' };
  const langScore = langScores[input.koreanLanguage] || 0;
  if (langScore > 0) {
    breakdown.push({ category: '한국어', item: '한국어 능력', score: langScore, maxScore: 5, note: langLabels[input.koreanLanguage] });
  } else {
    improvementTips.push('TOPIK 2급 이상 취득 시 +3~5점 가산');
  }

  // 외국인 고용 비율 경고
  if (input.foreignWorkerRatio > 20) {
    warnings.push(`외국인 근로자 비율(${input.foreignWorkerRatio}%)이 높습니다. 기업의 외국인 고용한도 초과 시 추가 고용이 제한될 수 있습니다.`);
  }

  // E-7 하위 유형별 경고
  if (input.occupationCode === 'E-7-4' && input.education === 'highschool' && input.workExperienceYears < 5) {
    warnings.push('E-7-4(숙련기능인력)은 고졸의 경우 최소 5년 경력이 필요합니다.');
  }
  if (input.occupationCode === 'E-7-1' && input.education !== 'doctorate' && input.education !== 'masters') {
    warnings.push('E-7-1(전문인력)은 석사 이상 학위가 일반적으로 요구됩니다.');
  }

  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const passingScore = 60;
  const isPassing = totalScore >= passingScore;

  let recommendation = '';
  if (isPassing) {
    if (totalScore >= 80) {
      recommendation = `E-7 비자 심사 예상 점수 ${totalScore}점으로 기준(${passingScore}점)을 크게 초과합니다. 발급 가능성이 매우 높습니다. 고용추천서를 발급받아 관할 출입국관리사무소에 신청하세요.`;
    } else {
      recommendation = `${totalScore}점으로 기준을 충족합니다. 고용추천서와 함께 서류를 꼼꼼히 준비하여 신청하세요.`;
    }
  } else {
    recommendation = `현재 ${totalScore}점으로 기준(${passingScore}점) 미달입니다. 경력 축적, 자격증 취득, 연봉 인상, TOPIK 취득을 고려하세요.`;
  }

  const pathways: VisaPathway[] = [
    {
      from: 'E-7',
      to: 'F-2-7 (점수제 거주)',
      requirements: ['E-7 체류 1년 이상', 'F-2-7 점수 80점 이상', '소득/학력/한국어 요건'],
      estimatedYears: 1,
      difficulty: 'moderate',
    },
    {
      from: 'E-7 → F-2-7',
      to: 'F-5 (영주)',
      requirements: ['F-2-7 3년 유지', 'TOPIK 4급+', 'GNI 이상 소득'],
      estimatedYears: 4,
      difficulty: 'moderate',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: 45,
    fastTrackDays: 21,
    interviewLikelihood: totalScore >= 75 ? 'low' : totalScore >= 60 ? 'medium' : 'high',
    interviewNote: '고용추천서의 충실도에 따라 면접 여부가 결정됩니다.',
  };

  return { totalScore, isPassing, passingScore, breakdown, recommendation, warnings, pathways, processing, improvementTips };
}

// ─────────────────────────────────────────
// D-10 구직 비자 적격성 평가
// ─────────────────────────────────────────

export interface D10Input {
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool';
  graduatedFromKorea: boolean;
  graduationWithinYear: boolean;
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hasInternExperience: boolean;
  fieldOfStudy: string;
  hasJobOffer: boolean;
  currentVisa: string;
  previousVisaViolation: boolean;
  annualIncome: number;
  gpa: number;
  universityRanking: 'top10' | 'top50' | 'top200' | 'other';
}

export interface D10Result {
  eligible: boolean;
  eligibilityScore: number;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
}

export function evaluateD10Eligibility(input: D10Input): D10Result {
  const requirements: D10Result['requirements'] = [];
  const warnings: string[] = [];

  // 1. 학력 요건
  const meetsEducation = ['doctorate', 'masters', 'bachelors', 'associate'].includes(input.education);
  const eduLabels: Record<string, string> = {
    doctorate: '박사', masters: '석사', bachelors: '학사', associate: '전문학사', highschool: '고졸',
  };
  requirements.push({
    item: '학력 요건 (전문학사 이상)',
    met: meetsEducation,
    note: eduLabels[input.education],
  });

  // 2. 한국 대학 졸업
  requirements.push({
    item: '한국 대학 졸업',
    met: input.graduatedFromKorea,
    note: input.graduatedFromKorea ? '국내 대학 졸업자 (D-10-1 경로)' : '해외 대학 졸업자 (추가 서류 필요)',
  });

  // 3. 졸업 시기
  requirements.push({
    item: '졸업 후 1년 이내',
    met: input.graduationWithinYear,
    note: input.graduationWithinYear ? '기한 내 (구직활동 허용)' : '졸업 후 1년 초과 (D-10-2 기술창업 고려)',
  });

  // 4. 한국어 능력
  const hasKorean = input.topikLevel >= 3;
  requirements.push({
    item: '한국어 능력 (TOPIK 3급+ 권장)',
    met: hasKorean,
    note: input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급` : '미취득',
  });

  // 5. 인턴/연수 경험
  if (input.hasInternExperience) {
    requirements.push({ item: '국내 인턴/연수 경험', met: true, note: '구직 활동 증빙에 유리' });
  }

  // 6. 구직 활동 증빙
  requirements.push({
    item: '구직 활동 증빙 (초청장/추천서)',
    met: input.hasJobOffer,
    note: input.hasJobOffer ? '증빙 있음' : '구직 활동 계획서 작성 필요',
  });

  // 7. 비자 위반 이력
  if (input.previousVisaViolation) {
    warnings.push('비자 위반 이력이 있는 경우 D-10 발급이 거부될 수 있습니다.');
    requirements.push({ item: '비자 위반 이력 없음', met: false, note: '위반 이력 있음 - 결격 사유' });
  } else {
    requirements.push({ item: '비자 위반 이력 없음', met: true });
  }

  // 8. 체류비용 증명
  const meetsFinance = input.annualIncome >= 1200;
  requirements.push({
    item: '체류비용 증명 (연 1,200만원+)',
    met: meetsFinance,
    note: `${input.annualIncome.toLocaleString()}만원`,
  });

  // 9. GPA (가산 요소)
  if (input.gpa >= 3.5) {
    requirements.push({ item: '학점 우수 (3.5/4.5+)', met: true, note: `GPA ${input.gpa}` });
  } else if (input.gpa > 0) {
    requirements.push({ item: '학점 (3.0/4.5+ 권장)', met: input.gpa >= 3.0, note: `GPA ${input.gpa}` });
  }

  // 10. 대학 순위 (가산 요소)
  const rankLabels: Record<string, string> = {
    top10: '세계 Top 10 (심사 우대)', top50: '세계 Top 50 (우대)', top200: 'Top 200', other: '일반',
  };
  if (input.universityRanking && input.universityRanking !== 'other') {
    requirements.push({ item: '대학 순위', met: true, note: rankLabels[input.universityRanking] });
  }

  // 현재 비자 확인
  const validCurrentVisas = ['D-2', 'D-2-1', 'D-2-2', 'D-2-3', 'D-2-4', 'D-2-6', 'E-7', 'E-9'];
  if (input.currentVisa && !validCurrentVisas.some(v => input.currentVisa.startsWith(v))) {
    warnings.push(`현재 비자(${input.currentVisa})에서 D-10으로의 자격 변경이 제한될 수 있습니다.`);
  }

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);
  const eligible = meetsEducation && !input.previousVisaViolation && meetsFinance;

  let recommendation = '';
  if (eligible && eligibilityScore >= 70) {
    recommendation = 'D-10 구직 비자 발급 가능성이 높습니다. ';
    if (input.graduatedFromKorea) {
      recommendation += '한국 대학 졸업자로서 D-10-1(구직) 신청이 가능합니다. ';
      if (input.topikLevel >= 4) recommendation += 'TOPIK 성적이 우수하여 취업에 유리합니다.';
    } else {
      recommendation += '해외 대학 졸업자는 D-10-2(기술창업) 또는 전문분야 경력 증빙이 필요합니다.';
    }
  } else if (eligible) {
    recommendation = 'D-10 기본 요건은 충족하나, TOPIK 취득 및 구직 활동 증빙을 보강하세요.';
  } else {
    const missing: string[] = [];
    if (!meetsEducation) missing.push('전문학사 이상 학력');
    if (input.previousVisaViolation) missing.push('비자 위반 이력 해소');
    if (!meetsFinance) missing.push('체류비용 증명');
    recommendation = `D-10 비자 요건이 충족되지 않습니다. 미충족: ${missing.join(', ')}`;
  }

  const pathways: VisaPathway[] = [
    {
      from: 'D-10',
      to: 'E-7 (특정활동)',
      requirements: ['취업처 확보', '고용추천서', '전공-직종 일치'],
      estimatedYears: 0.5,
      difficulty: 'moderate',
    },
    {
      from: 'D-10 → E-7',
      to: 'F-2-7 (거주)',
      requirements: ['E-7 1년+ 체류', '점수 80점+'],
      estimatedYears: 2,
      difficulty: 'moderate',
    },
    {
      from: 'D-10',
      to: 'D-8-4 (기술창업)',
      requirements: ['사업자등록', '사업계획서 승인', '투자금 증명'],
      estimatedYears: 0.5,
      difficulty: 'hard',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: 30,
    interviewLikelihood: 'low',
    interviewNote: 'D-10은 서류심사 위주이며, 면접은 드문 편입니다.',
  };

  const requiredDocuments = [
    '여권 원본 및 사본',
    '외국인등록증 (해당시)',
    '표준규격사진 1매',
    '졸업증명서 (아포스티유/영사확인)',
    input.graduatedFromKorea ? '국내 대학 졸업증명서' : '해외 학위 인증서류',
    '성적증명서',
    '구직 활동 계획서',
    input.hasJobOffer ? '고용추천서 또는 초청장' : null,
    '체류비용 입증서류 (잔고증명서 등)',
    input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급 성적표` : null,
    input.hasInternExperience ? '인턴/연수 경력증명서' : null,
    '수수료 (13만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, requirements, recommendation, warnings, requiredDocuments, pathways, processing };
}

// ─────────────────────────────────────────
// F-5 영주 비자 적격성 평가
// ─────────────────────────────────────────

export interface F5Input {
  currentVisa: string;
  stayYears: number;
  age: number;
  annualIncome: number;
  realEstateValue: number;
  totalAssets: number;
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool' | 'below';
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  kiipCompleted: boolean;
  hasCriminalRecord: boolean;
  taxPaymentYears: number;
  hasKoreanSpouse: boolean;
  hasMinorChildren: boolean;
  f27ScoreAbove80: boolean;
  investmentAmount: number;
  healthInsuranceMonths: number;
  pensionMonths: number;
}

export interface F5Result {
  eligible: boolean;
  eligibilityType: string;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
}

export function evaluateF5Eligibility(input: F5Input): F5Result {
  const requirements: F5Result['requirements'] = [];
  const warnings: string[] = [];

  // F-5 경로 결정
  let eligibilityType = 'F-5-1';
  if (input.investmentAmount >= 50000) eligibilityType = 'F-5-3';
  else if (input.f27ScoreAbove80) eligibilityType = 'F-5-10';
  else if (input.hasKoreanSpouse) eligibilityType = 'F-5-2';

  const typeLabels: Record<string, string> = {
    'F-5-1': '일반 영주', 'F-5-2': '결혼이민 영주', 'F-5-3': '투자이민 영주', 'F-5-10': '점수제 영주',
  };

  // 1. 체류 기간 요건
  const requiredStayYears: Record<string, number> = {
    'F-5-1': 5, 'F-5-2': 2, 'F-5-3': 3, 'F-5-10': 3,
  };
  const minStay = requiredStayYears[eligibilityType] || 5;
  const meetsStay = input.stayYears >= minStay;
  requirements.push({
    item: `체류 기간 (${minStay}년 이상)`,
    met: meetsStay,
    note: `${input.stayYears}년 체류 (${typeLabels[eligibilityType]})`,
  });

  // 2. 소득 요건
  const incomeRatio = input.annualIncome / GNI_2026;
  const meetsIncome = incomeRatio >= 1.0;
  requirements.push({
    item: `소득 요건 (GNI ${GNI_2026.toLocaleString()}만원 이상)`,
    met: meetsIncome,
    note: `${input.annualIncome.toLocaleString()}만원 (GNI 대비 ${(incomeRatio * 100).toFixed(0)}%)`,
  });

  // 3. 투자금 (투자이민)
  if (eligibilityType === 'F-5-3') {
    const meetsInvestment = input.investmentAmount >= 50000;
    requirements.push({
      item: '투자금액 (5억원 이상)',
      met: meetsInvestment,
      note: `${(input.investmentAmount / 10000).toFixed(1)}억원`,
    });
  }

  // 4. 기본소양
  const meetsKorean = input.topikLevel >= 4 || input.kiipCompleted;
  requirements.push({
    item: '기본소양 (TOPIK 4급+ 또는 KIIP 5단계)',
    met: meetsKorean,
    note: input.kiipCompleted
      ? '사회통합프로그램 5단계 이수'
      : input.topikLevel > 0
        ? `TOPIK ${input.topikLevel}급${input.topikLevel < 4 ? ' (4급 이상 필요)' : ''}`
        : '미충족',
  });

  // 5. 범죄 이력
  if (input.hasCriminalRecord) {
    requirements.push({ item: '범죄 이력 없음', met: false, note: '범죄 이력 - 결격 사유' });
    warnings.push('범죄 이력이 있는 경우 F-5 영주 비자가 거부됩니다. 사면/복권 여부를 확인하세요.');
  } else {
    requirements.push({ item: '범죄 이력 없음', met: true });
  }

  // 6. 납세
  const meetsTax = input.taxPaymentYears >= 3;
  requirements.push({ item: '납세 실적 (3년 이상)', met: meetsTax, note: `${input.taxPaymentYears}년 납세` });

  // 7. 건강보험
  const meetsHealthIns = input.healthInsuranceMonths >= 12;
  requirements.push({
    item: '건강보험 가입 (12개월+)',
    met: meetsHealthIns,
    note: `${input.healthInsuranceMonths}개월 가입`,
  });

  // 8. 국민연금
  const meetsPension = input.pensionMonths >= 12;
  requirements.push({
    item: '국민연금 납부 (12개월+)',
    met: meetsPension,
    note: `${input.pensionMonths}개월 납부`,
  });

  // 9. 현재 비자 적합성
  const validF5BaseVisas = ['F-2', 'F-2-7', 'E-7', 'D-8', 'D-9', 'F-6', 'F-2-99'];
  const hasValidBase = validF5BaseVisas.some(v => input.currentVisa.startsWith(v));
  requirements.push({
    item: '적합한 현재 체류자격',
    met: hasValidBase,
    note: input.currentVisa || '미입력',
  });
  if (!hasValidBase && input.currentVisa) {
    warnings.push(`현재 비자(${input.currentVisa})에서 직접 F-5 전환이 어려울 수 있습니다. F-2-7 등 중간 단계를 거치는 것을 권장합니다.`);
  }

  // 10. 나이
  requirements.push({ item: '성인 (만 19세 이상)', met: input.age >= 19, note: `만 ${input.age}세` });

  // 적격 판정
  const criticalMet = meetsStay && !input.hasCriminalRecord && meetsKorean && input.age >= 19;
  const financialMet = meetsIncome || input.totalAssets >= 30000;
  const eligible = criticalMet && financialMet && hasValidBase;

  let recommendation = '';
  if (eligible) {
    recommendation = `${typeLabels[eligibilityType]}(${eligibilityType}) 비자 신청 요건을 충족합니다. `;
    if (eligibilityType === 'F-5-10') {
      recommendation += 'F-2-7 점수제를 통한 영주 경로이며, 가장 일반적인 영주 취득 방법입니다. 3년 유지 후 신청 가능합니다.';
    } else if (eligibilityType === 'F-5-2') {
      recommendation += '결혼이민 영주권은 혼인관계 유지, 기본소양 충족이 핵심입니다. 관할 출입국관리사무소에 신청하세요.';
    } else if (eligibilityType === 'F-5-3') {
      recommendation += '투자이민 영주권은 투자 상태 유지 확인이 필요합니다. 투자금 회수 시 영주 자격이 취소될 수 있습니다.';
    } else {
      recommendation += '필요 서류를 완비하여 관할 출입국관리사무소에 신청하세요.';
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

  const pathways: VisaPathway[] = [
    {
      from: 'F-5 (영주)',
      to: '귀화 (대한민국 국적)',
      requirements: ['영주 후 2년+ 체류', '기본소양 시험', '생계능력', '한국어 능력', '신원조사'],
      estimatedYears: 2,
      difficulty: 'hard',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: 90,
    interviewLikelihood: eligibilityType === 'F-5-10' ? 'low' : 'medium',
    interviewNote: '영주 비자는 심사가 엄격하며, 서류 보완 요구가 빈번합니다. 서류를 완벽히 준비하세요.',
  };

  const requiredDocuments = [
    '여권 원본 및 사본',
    '외국인등록증',
    '표준규격사진 1매',
    '체류지 입증서류',
    '소득금액증명원 (최근 3년)',
    '납세증명서 (국세 + 지방세)',
    '건강보험 가입확인서',
    '국민연금 납부확인서',
    input.kiipCompleted ? '사회통합프로그램 이수증 (5단계)' : null,
    input.topikLevel >= 4 ? `TOPIK ${input.topikLevel}급 성적표` : null,
    '신원조회 동의서',
    '본국 범죄경력증명서 (아포스티유)',
    input.hasKoreanSpouse ? '혼인관계증명서' : null,
    input.realEstateValue > 0 ? '부동산 등기부등본' : null,
    eligibilityType === 'F-5-3' ? '투자 증빙서류 (외국인투자기업 등록증 등)' : null,
    '수수료 (23만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityType, requirements, recommendation, warnings, requiredDocuments, pathways, processing };
}

// ─────────────────────────────────────────
// F-6 결혼이민 비자 적격성 평가
// ─────────────────────────────────────────

export interface F6Input {
  hasKoreanSpouse: boolean;
  marriageRegistered: boolean;
  cohabitationMonths: number;
  spouseAnnualIncome: number;
  combinedIncome: number;
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hasBasicKorean: boolean;
  hasChildren: boolean;
  childrenCount: number;
  spouseHasNoCriminalRecord: boolean;
  applicantHasNoCriminalRecord: boolean;
  previousMarriageCount: number;
  ageGap: number;
  metInPerson: boolean;
  spouseResidence: string;
  subType: 'F-6-1' | 'F-6-2' | 'F-6-3';
  hasMedicalCheckup: boolean;
  hasBackgroundCheck: boolean;
}

export interface F6Result {
  eligible: boolean;
  eligibilityScore: number;
  subType: string;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
}

export function evaluateF6Eligibility(input: F6Input): F6Result {
  const requirements: F6Result['requirements'] = [];
  const warnings: string[] = [];

  // 1. 한국인 배우자 (F-6-1)
  if (input.subType === 'F-6-1') {
    requirements.push({
      item: '한국인 배우자',
      met: input.hasKoreanSpouse,
      note: input.hasKoreanSpouse ? '한국 국적 배우자 있음' : '없음 - 필수 조건',
    });
  }

  // 2. 혼인신고
  requirements.push({
    item: '혼인신고 완료',
    met: input.marriageRegistered,
    note: input.marriageRegistered ? '완료' : '미완료 - 필수',
  });

  // 3. 소득 요건
  const householdSize = 2 + (input.childrenCount || 0);
  let requiredIncome = MEDIAN_INCOME_2P_2026;
  if (householdSize >= 4) requiredIncome = MEDIAN_INCOME_4P_2026;
  else if (householdSize >= 3) requiredIncome = MEDIAN_INCOME_3P_2026;

  const effectiveIncome = Math.max(input.spouseAnnualIncome, input.combinedIncome);
  const meetsIncome = effectiveIncome >= requiredIncome;
  requirements.push({
    item: `소득 요건 (${householdSize}인가구 중위소득 이상)`,
    met: meetsIncome,
    note: `합산 ${effectiveIncome.toLocaleString()}만원 / 기준 ${requiredIncome.toLocaleString()}만원 (${(effectiveIncome / requiredIncome * 100).toFixed(0)}%)`,
  });

  // 4. 한국어 능력
  const meetsKorean = input.topikLevel >= 1 || input.hasBasicKorean;
  requirements.push({
    item: '기초 한국어 소통',
    met: meetsKorean,
    note: input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급` : (input.hasBasicKorean ? '기초 소통 가능' : '불가'),
  });

  // 5. 배우자 범죄 이력
  requirements.push({
    item: '초청인(배우자) 범죄 이력 없음',
    met: input.spouseHasNoCriminalRecord,
    note: input.spouseHasNoCriminalRecord ? '이상 없음' : '있음 - 초청 제한',
  });
  if (!input.spouseHasNoCriminalRecord) {
    warnings.push('초청인(배우자)에게 가정폭력, 성범죄 등 전력이 있으면 초청이 제한됩니다. 범죄 유형에 따라 영구 제한될 수 있습니다.');
  }

  // 6. 신청인 범죄 이력
  requirements.push({
    item: '신청인 범죄 이력 없음',
    met: input.applicantHasNoCriminalRecord,
  });

  // 7. 실질적 혼인관계 (F-6-1)
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

  // 8. 건강진단 (신규)
  requirements.push({
    item: '건강진단서',
    met: input.hasMedicalCheckup,
    note: input.hasMedicalCheckup ? '완료' : '지정 병원 건강검진 필요',
  });

  // 9. 신원조사
  requirements.push({
    item: '신원조사 (본국 범죄경력)',
    met: input.hasBackgroundCheck,
    note: input.hasBackgroundCheck ? '범죄경력증명서 확보' : '본국 대사관에서 발급 필요',
  });

  // 10. 자녀 (F-6-2)
  if (input.subType === 'F-6-2') {
    requirements.push({ item: '미성년 자녀 양육', met: input.hasChildren, note: input.hasChildren ? `${input.childrenCount || 1}명` : 'F-6-2 필수 조건' });
  }

  // 심사 위험 요소
  if (input.previousMarriageCount >= 2) {
    warnings.push(`이전 결혼 ${input.previousMarriageCount}회: 위장결혼 의심으로 심층 심사가 진행됩니다. 실질적 혼인관계를 충분히 입증하세요.`);
  }
  if (input.ageGap >= 20) {
    warnings.push(`나이 차이 ${input.ageGap}세: 심사관이 실질적 혼인관계에 대해 추가 확인할 수 있습니다. 교제 증빙(사진, 카카오톡, 통화기록 등)을 충분히 준비하세요.`);
  }
  if (input.ageGap >= 15 && input.ageGap < 20) {
    warnings.push(`나이 차이 ${input.ageGap}세: 교류 과정을 상세히 증빙하는 것이 좋습니다.`);
  }
  if (!input.metInPerson) {
    warnings.push('결혼중개업체를 통한 경우, 직접 만남 증빙(항공권, 사진, 통화기록)이 반드시 필요합니다.');
  }

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);

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
    eligible = input.applicantHasNoCriminalRecord;
  }

  const subTypeLabels: Record<string, string> = {
    'F-6-1': '국민의 배우자', 'F-6-2': '미성년 자녀 양육', 'F-6-3': '혼인파탄 (귀책 없음)',
  };

  let recommendation = '';
  if (eligible && eligibilityScore >= 70) {
    recommendation = `${subTypeLabels[input.subType]} 자격으로 F-6 결혼이민 비자 신청이 가능합니다. `;
    if (input.topikLevel >= 4) {
      recommendation += '한국어 능력이 우수하여 심사에 유리합니다.';
    } else {
      recommendation += 'TOPIK 취득이 향후 체류 연장 및 영주(F-5) 전환에 도움됩니다.';
    }
  } else if (eligible) {
    recommendation = 'F-6 기본 요건은 충족합니다. 소득 증빙 및 혼인 실질관계 입증 서류를 충분히 준비하세요.';
  } else {
    const missing: string[] = [];
    if (!input.marriageRegistered) missing.push('혼인신고');
    if (!input.hasKoreanSpouse && input.subType === 'F-6-1') missing.push('한국인 배우자');
    if (!meetsIncome) missing.push('소득 요건');
    if (!meetsKorean) missing.push('한국어 능력');
    if (!input.spouseHasNoCriminalRecord) missing.push('배우자 범죄 이력');
    recommendation = `F-6 비자 요건이 일부 충족되지 않습니다. 미충족: ${missing.join(', ')}`;
  }

  const pathways: VisaPathway[] = [
    {
      from: 'F-6',
      to: 'F-5-2 (결혼이민 영주)',
      requirements: ['2년 이상 체류', '혼인관계 유지', 'TOPIK 4급+ 또는 KIIP 5단계', '기본소양 시험'],
      estimatedYears: 2,
      difficulty: 'moderate',
    },
    {
      from: 'F-6 → F-5-2',
      to: '귀화 (대한민국 국적)',
      requirements: ['간이귀화: F-6 2년+', '기본소양', '생계능력'],
      estimatedYears: 2,
      difficulty: 'moderate',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: 60,
    interviewLikelihood: (input.previousMarriageCount >= 2 || input.ageGap >= 15 || !input.metInPerson) ? 'high' : 'medium',
    interviewNote: '결혼이민 비자는 면접 심사가 일반적입니다. 부부 함께 출석이 필요할 수 있습니다.',
  };

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
    '건강진단서 (지정 병원)',
    '본국 범죄경력증명서 (아포스티유)',
    input.subType === 'F-6-3' ? '혼인파탄 귀책 없음 입증서류 (판결문 등)' : null,
    '수수료 (13만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, subType: input.subType, requirements, recommendation, warnings, requiredDocuments, pathways, processing };
}

// ─────────────────────────────────────────
// D-2 유학 비자 적격성 평가 (신규)
// ─────────────────────────────────────────

export interface D2Input {
  subType: 'D-2-1' | 'D-2-2' | 'D-2-3' | 'D-2-4' | 'D-2-6' | 'D-2-7' | 'D-2-8';
  hasAdmissionLetter: boolean;
  universityAccredited: boolean;
  financialProof: number; // 체류비용 증명 (만원)
  topikLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  previousEducation: 'highschool' | 'associate' | 'bachelors' | 'masters' | 'doctorate';
  gpa: number;
  tuitionPaid: boolean;
  hasScholarship: boolean;
  scholarshipPercent: number;
  previousVisaViolation: boolean;
  nationality: string;
  age: number;
  hasHealthInsurance: boolean;
}

export interface D2Result {
  eligible: boolean;
  eligibilityScore: number;
  subTypeLabel: string;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
}

export function evaluateD2Eligibility(input: D2Input): D2Result {
  const requirements: D2Result['requirements'] = [];
  const warnings: string[] = [];

  const subTypeLabels: Record<string, string> = {
    'D-2-1': '전문학사 과정', 'D-2-2': '학사 과정', 'D-2-3': '석사 과정',
    'D-2-4': '박사 과정', 'D-2-6': '교환학생', 'D-2-7': '어학연수 (대학부설)',
    'D-2-8': '단기유학',
  };
  const subTypeLabel = subTypeLabels[input.subType] || '유학';

  // 최소 학력 요건
  const minEdu: Record<string, string[]> = {
    'D-2-1': ['highschool', 'associate', 'bachelors', 'masters', 'doctorate'],
    'D-2-2': ['highschool', 'associate', 'bachelors', 'masters', 'doctorate'],
    'D-2-3': ['bachelors', 'masters', 'doctorate'],
    'D-2-4': ['masters', 'doctorate'],
    'D-2-6': ['highschool', 'associate', 'bachelors', 'masters', 'doctorate'],
    'D-2-7': ['highschool', 'associate', 'bachelors', 'masters', 'doctorate'],
    'D-2-8': ['highschool', 'associate', 'bachelors', 'masters', 'doctorate'],
  };
  const meetsEdu = (minEdu[input.subType] || []).includes(input.previousEducation);
  const eduLabels: Record<string, string> = {
    highschool: '고졸', associate: '전문학사', bachelors: '학사', masters: '석사', doctorate: '박사',
  };
  requirements.push({
    item: '학력 요건',
    met: meetsEdu,
    note: `${eduLabels[input.previousEducation]} → ${subTypeLabel}`,
  });

  // 입학허가서
  requirements.push({
    item: '입학허가서 (표준입학허가서)',
    met: input.hasAdmissionLetter,
    note: input.hasAdmissionLetter ? '확보 완료' : '대학에서 발급 필요',
  });

  // 대학 인가
  requirements.push({
    item: '인가된 대학',
    met: input.universityAccredited,
    note: input.universityAccredited ? '교육부 인가 대학' : '비인가 기관 - 비자 발급 불가',
  });
  if (!input.universityAccredited) {
    warnings.push('비인가 교육기관은 D-2 비자 발급이 불가능합니다. 교육부 인가 여부를 반드시 확인하세요.');
  }

  // 재정 증명
  const minFinancial = input.subType === 'D-2-7' ? 900 : 1200;
  const meetsFinance = input.financialProof >= minFinancial;
  requirements.push({
    item: `재정 능력 (연 ${minFinancial.toLocaleString()}만원+)`,
    met: meetsFinance,
    note: `${input.financialProof.toLocaleString()}만원 ${input.hasScholarship ? `(장학금 ${input.scholarshipPercent}%)` : ''}`,
  });

  // 한국어 능력 (D-2-1, D-2-2는 TOPIK 3급+ 필요)
  const topikRequired = ['D-2-1', 'D-2-2'].includes(input.subType) ? 3 : ['D-2-3', 'D-2-4'].includes(input.subType) ? 3 : 0;
  if (topikRequired > 0) {
    const meetsTopik = input.topikLevel >= topikRequired;
    requirements.push({
      item: `한국어 능력 (TOPIK ${topikRequired}급+)`,
      met: meetsTopik,
      note: input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급` : '미취득',
    });
    if (!meetsTopik) {
      warnings.push(`${subTypeLabel}은 TOPIK ${topikRequired}급 이상이 필요합니다. 영어 트랙 과정은 TOPIK 면제 가능합니다.`);
    }
  }

  // 등록금 납부
  requirements.push({
    item: '등록금 납부 증명',
    met: input.tuitionPaid,
    note: input.tuitionPaid ? '완료' : '납부 증명 필요',
  });

  // 비자 위반
  if (input.previousVisaViolation) {
    requirements.push({ item: '비자 위반 이력 없음', met: false, note: '위반 이력 있음' });
    warnings.push('비자 위반 이력이 있으면 D-2 발급이 거부될 수 있습니다.');
  } else {
    requirements.push({ item: '비자 위반 이력 없음', met: true });
  }

  // 건강보험
  requirements.push({
    item: '건강보험 가입',
    met: input.hasHealthInsurance,
    note: input.hasHealthInsurance ? '가입 완료' : '유학생 건강보험 가입 필수 (2021년~ 의무)',
  });

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);
  const eligible = meetsEdu && input.hasAdmissionLetter && input.universityAccredited && meetsFinance && !input.previousVisaViolation;

  let recommendation = '';
  if (eligible && eligibilityScore >= 80) {
    recommendation = `${subTypeLabel}(${input.subType}) 비자 발급 가능성이 높습니다. 서류를 빠짐없이 준비하여 대사관/영사관에 신청하세요.`;
    if (input.hasScholarship && input.scholarshipPercent >= 50) {
      recommendation += ' 장학금 수혜자로 심사에 유리합니다.';
    }
  } else if (eligible) {
    recommendation = 'D-2 기본 요건은 충족합니다. 부족한 서류를 보완하세요.';
  } else {
    recommendation = 'D-2 비자 발급 요건이 일부 미충족입니다. 입학허가서, 재정 증명, TOPIK 등을 확인하세요.';
  }

  const pathways: VisaPathway[] = [
    {
      from: 'D-2 (유학)',
      to: 'D-10 (구직)',
      requirements: ['졸업 후 6개월 이내 신청', '구직활동 계획서', '체류비용 증명'],
      estimatedYears: 0.5,
      difficulty: 'easy',
    },
    {
      from: 'D-2 → D-10',
      to: 'E-7 (특정활동)',
      requirements: ['취업처 확보', '고용추천서', '전공-직종 연관'],
      estimatedYears: 1,
      difficulty: 'moderate',
    },
    {
      from: 'D-2',
      to: 'D-8-4 (기술창업)',
      requirements: ['사업계획서', '투자금', '사업자등록'],
      estimatedYears: 0.5,
      difficulty: 'hard',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: 21,
    interviewLikelihood: 'low',
    interviewNote: 'D-2 유학 비자는 대학의 입학허가서가 핵심이며, 서류심사 위주입니다.',
  };

  const requiredDocuments = [
    '여권 원본 및 사본',
    '표준규격사진 1매',
    '표준입학허가서',
    '최종학력 졸업증명서 (아포스티유)',
    '성적증명서',
    input.topikLevel > 0 ? `TOPIK ${input.topikLevel}급 성적표` : null,
    '재정 입증서류 (은행잔고, 장학증서 등)',
    '등록금 납입 증명서',
    '건강보험 가입증명서',
    '결핵검진 확인서 (고위험국가)',
    '수수료 (6만원)',
    '체류지 입증서류 (기숙사 배정확인서 등)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, subTypeLabel, requirements, recommendation, warnings, requiredDocuments, pathways, processing };
}

// ─────────────────────────────────────────
// E-9 비전문취업 비자 적격성 평가 (신규)
// ─────────────────────────────────────────

export interface E9Input {
  industry: 'manufacturing' | 'construction' | 'agriculture' | 'fishing' | 'service';
  epsTestScore: number; // EPS-TOPIK 점수 (200점 만점)
  epsTestPassed: boolean;
  age: number;
  hasHealthCheckup: boolean;
  hasCriminalRecord: boolean;
  previousKoreaStay: boolean;
  previousE9Holder: boolean;
  reentryCount: number;
  skillTestPassed: boolean;
  nationality: string;
  hasEmployerMatch: boolean;
}

export interface E9Result {
  eligible: boolean;
  eligibilityScore: number;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
  industryInfo: string;
}

export function evaluateE9Eligibility(input: E9Input): E9Result {
  const requirements: E9Result['requirements'] = [];
  const warnings: string[] = [];

  const industryLabels: Record<string, string> = {
    manufacturing: '제조업', construction: '건설업', agriculture: '농축산업',
    fishing: '어업', service: '서비스업',
  };
  const industryLabel = industryLabels[input.industry] || '제조업';

  // 1. 나이 요건 (18~39세)
  const meetsAge = input.age >= 18 && input.age <= 39;
  requirements.push({
    item: '나이 요건 (만 18~39세)',
    met: meetsAge,
    note: `만 ${input.age}세`,
  });

  // 2. EPS-TOPIK 시험
  requirements.push({
    item: 'EPS-TOPIK 합격',
    met: input.epsTestPassed,
    note: input.epsTestPassed ? `점수: ${input.epsTestScore}/200` : '미합격 - 필수 조건',
  });

  // 3. 기능시험 (업종별)
  if (['construction', 'agriculture', 'fishing'].includes(input.industry)) {
    requirements.push({
      item: `기능시험 합격 (${industryLabel})`,
      met: input.skillTestPassed,
      note: input.skillTestPassed ? '합격' : '업종별 기능시험 필요',
    });
  }

  // 4. 건강검진
  requirements.push({
    item: '건강검진 합격',
    met: input.hasHealthCheckup,
    note: input.hasHealthCheckup ? '적합' : '지정 병원 건강검진 필요',
  });

  // 5. 범죄 이력
  if (input.hasCriminalRecord) {
    requirements.push({ item: '범죄 이력 없음', met: false, note: '범죄 이력 있음' });
    warnings.push('범죄 이력이 있는 경우 E-9 비자가 거부됩니다.');
  } else {
    requirements.push({ item: '범죄 이력 없음', met: true });
  }

  // 6. 재입국 횟수 제한
  if (input.reentryCount >= 2) {
    requirements.push({ item: '재입국 횟수 제한', met: false, note: `${input.reentryCount}회 재입국 - 제한 가능` });
    warnings.push('E-9 비자 재입국은 통상 1회까지 허용됩니다. 2회 이상은 특별한 사유가 필요합니다.');
  } else {
    requirements.push({ item: '재입국 횟수', met: true, note: `${input.reentryCount}회` });
  }

  // 7. 고용주 매칭
  requirements.push({
    item: '고용주(사업장) 배정',
    met: input.hasEmployerMatch,
    note: input.hasEmployerMatch ? '사업장 배정 완료' : '고용허가서 발급 대기',
  });

  // 성실근로자 재입국
  if (input.previousE9Holder) {
    if (input.reentryCount <= 1) {
      requirements.push({ item: '성실근로자 재입국', met: true, note: '이전 E-9 성실 이력' });
    }
    warnings.push('이전 E-9 체류 시 불법체류/사업장 이탈 이력이 있으면 재입국이 제한됩니다.');
  }

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);
  const eligible = meetsAge && input.epsTestPassed && input.hasHealthCheckup && !input.hasCriminalRecord;

  let recommendation = '';
  if (eligible && eligibilityScore >= 70) {
    recommendation = `E-9 비전문취업(${industryLabel}) 비자 발급 가능성이 높습니다. `;
    if (input.hasEmployerMatch) {
      recommendation += '사업장이 배정되었으니 입국 절차를 진행하세요.';
    } else {
      recommendation += '고용허가서 발급 및 사업장 배정을 기다리세요. 한국산업인력공단(HRD Korea)에서 관리합니다.';
    }
  } else if (eligible) {
    recommendation = '기본 요건은 충족합니다. 사업장 배정 및 기능시험 등 추가 절차를 진행하세요.';
  } else {
    recommendation = 'E-9 비자 요건이 일부 미충족입니다. EPS-TOPIK 합격, 건강검진, 나이 요건을 확인하세요.';
  }

  const industryInfo = {
    manufacturing: '제조업: 최대 체류기간 4년 10개월. 성실근로자 재입국 시 추가 4년 10개월 가능. 사업장 변경 3회까지 허용.',
    construction: '건설업: 계절별 수요 변동. 건설기능시험 필수. 안전교육 이수 의무.',
    agriculture: '농축산업: 계절근로(E-8) 병행 가능. 농업 기능시험 필수.',
    fishing: '어업: 원양어업/연근해어업 구분. 선원근로계약서 필요.',
    service: '서비스업: 음식점/숙박/간병 등. 업종 제한이 있으므로 확인 필요.',
  }[input.industry] || '';

  const pathways: VisaPathway[] = [
    {
      from: 'E-9',
      to: 'E-7-4 (숙련기능인력)',
      requirements: ['E-9 4년+ 체류', '동일 업종 경력', 'TOPIK 4급+', '기능자격증', '고용주 추천'],
      estimatedYears: 4,
      difficulty: 'hard',
    },
    {
      from: 'E-9 → E-7-4',
      to: 'F-2-7 (거주)',
      requirements: ['E-7-4 1년+', '점수 80점+'],
      estimatedYears: 5,
      difficulty: 'hard',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: 90,
    interviewLikelihood: 'low',
    interviewNote: 'E-9는 EPS(고용허가제) 시스템을 통해 처리됩니다. 개별 면접보다는 시험 성적과 건강검진이 핵심입니다.',
  };

  const requiredDocuments = [
    '여권 원본 및 사본',
    '표준규격사진 2매',
    'EPS-TOPIK 합격증',
    input.skillTestPassed ? '기능시험 합격증' : null,
    '건강검진 결과서 (지정 병원)',
    '범죄경력증명서 (본국)',
    '최종학력 증명서',
    '근로계약서 (사업장 배정 후)',
    '고용허가서 사본 (고용주 발급)',
    '사증발급인정서 (사업장 배정 후)',
    '출입국사실증명서 (재입국의 경우)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, requirements, recommendation, warnings, requiredDocuments, pathways, processing, industryInfo };
}

// ─────────────────────────────────────────
// D-8 기업투자 비자 적격성 평가 (신규)
// ─────────────────────────────────────────

export interface D8Input {
  subType: 'D-8-1' | 'D-8-2' | 'D-8-3' | 'D-8-4';
  investmentAmount: number; // 투자금액 (만원)
  businessType: string;
  hasBusinessPlan: boolean;
  hasCompanyRegistration: boolean;
  expectedEmployees: number;
  annualRevenue: number; // 예상 연매출 (만원)
  education: 'doctorate' | 'masters' | 'bachelors' | 'associate' | 'highschool';
  hasRelatedExperience: boolean;
  experienceYears: number;
  hasTechnologyPatent: boolean;
  hasVCFunding: boolean;
  vcFundingAmount: number;
  previousVisaViolation: boolean;
  currentVisa: string;
  age: number;
}

export interface D8Result {
  eligible: boolean;
  eligibilityScore: number;
  subTypeLabel: string;
  requirements: {
    item: string;
    met: boolean;
    note?: string;
  }[];
  recommendation: string;
  warnings: string[];
  requiredDocuments: string[];
  pathways: VisaPathway[];
  processing: ProcessingEstimate;
}

export function evaluateD8Eligibility(input: D8Input): D8Result {
  const requirements: D8Result['requirements'] = [];
  const warnings: string[] = [];

  const subTypeLabels: Record<string, string> = {
    'D-8-1': '외국인투자기업 (KOTRA)', 'D-8-2': '벤처기업', 'D-8-3': '기술창업', 'D-8-4': '스타트업비자',
  };
  const subTypeLabel = subTypeLabels[input.subType] || '기업투자';

  // 투자금 요건 (유형별 상이)
  const minInvestment: Record<string, number> = {
    'D-8-1': 10000, // 1억원
    'D-8-2': 5000,  // 5천만원
    'D-8-3': 5000,  // 5천만원
    'D-8-4': 3000,  // 3천만원 (스타트업비자)
  };
  const reqInvestment = minInvestment[input.subType] || 10000;
  const meetsInvestment = input.investmentAmount >= reqInvestment;
  requirements.push({
    item: `투자금액 (${(reqInvestment / 10000).toFixed(0)}억원+ 또는 ${reqInvestment.toLocaleString()}만원+)`,
    met: meetsInvestment,
    note: `${input.investmentAmount.toLocaleString()}만원 (기준 ${reqInvestment.toLocaleString()}만원)`,
  });

  // 사업자등록
  requirements.push({
    item: '법인/사업자 등록',
    met: input.hasCompanyRegistration,
    note: input.hasCompanyRegistration ? '등록 완료' : '법인설립 또는 사업자등록 필요',
  });

  // 사업계획서
  requirements.push({
    item: '사업계획서',
    met: input.hasBusinessPlan,
    note: input.hasBusinessPlan ? '작성 완료' : '사업 타당성 입증 필수',
  });

  // D-8-4 스타트업비자 특별 조건
  if (input.subType === 'D-8-4') {
    const hasVCOrPatent = input.hasVCFunding || input.hasTechnologyPatent;
    requirements.push({
      item: '기술/투자 요건 (VC 투자 또는 특허)',
      met: hasVCOrPatent,
      note: input.hasVCFunding
        ? `VC 투자 ${input.vcFundingAmount.toLocaleString()}만원`
        : input.hasTechnologyPatent
          ? '기술특허 보유'
          : '기술혁신성 입증 필요',
    });

    if (!hasVCOrPatent) {
      warnings.push('D-8-4 스타트업비자는 VC 투자유치 또는 기술특허가 핵심입니다. TIPS 프로그램 등 정부 지원사업 선정도 인정됩니다.');
    }
  }

  // D-8-1 외국인투자기업
  if (input.subType === 'D-8-1') {
    requirements.push({
      item: '외국인투자기업 등록 (KOTRA)',
      met: input.hasCompanyRegistration,
      note: '산업통상자원부 외국인투자기업 등록 필요',
    });
  }

  // 고용 창출
  if (input.expectedEmployees >= 2) {
    requirements.push({ item: '고용 창출', met: true, note: `${input.expectedEmployees}명 고용 예정` });
  } else {
    requirements.push({ item: '고용 창출 (2명+)', met: false, note: '내국인 2명 이상 고용 권장' });
    warnings.push('내국인 고용 실적이 비자 연장 심사에 중요합니다.');
  }

  // 학력/경력
  const meetsQualification = input.hasRelatedExperience || ['doctorate', 'masters', 'bachelors'].includes(input.education);
  requirements.push({
    item: '자격 요건 (학력 또는 경력)',
    met: meetsQualification,
    note: input.hasRelatedExperience ? `관련 경력 ${input.experienceYears}년` : `최종학력: ${input.education}`,
  });

  // 비자 위반
  if (input.previousVisaViolation) {
    requirements.push({ item: '비자 위반 이력 없음', met: false });
    warnings.push('비자 위반 이력이 있으면 D-8 발급이 거부될 수 있습니다.');
  } else {
    requirements.push({ item: '비자 위반 이력 없음', met: true });
  }

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const eligibilityScore = Math.round((metCount / totalCount) * 100);
  const eligible = meetsInvestment && input.hasBusinessPlan && !input.previousVisaViolation;

  let recommendation = '';
  if (eligible && eligibilityScore >= 70) {
    recommendation = `${subTypeLabel}(${input.subType}) 비자 발급 가능성이 높습니다. `;
    if (input.subType === 'D-8-4') {
      recommendation += '스타트업비자는 OASIS(온라인 스타트업비자 시스템)를 통해 신청합니다. 사업계획서 심사가 핵심입니다.';
    } else if (input.subType === 'D-8-1') {
      recommendation += 'KOTRA 외국인투자기업 등록 후 관할 출입국사무소에 신청하세요.';
    } else {
      recommendation += '법인설립 완료 후 투자 증빙과 함께 신청하세요.';
    }
  } else if (eligible) {
    recommendation = `기본 요건은 충족합니다. 사업계획서의 타당성과 ${input.subType === 'D-8-4' ? '기술혁신성' : '투자금 증빙'}을 보강하세요.`;
  } else {
    recommendation = `D-8 비자 요건이 일부 미충족입니다. 투자금(${reqInvestment.toLocaleString()}만원+), 사업계획서, 법인등록을 확인하세요.`;
  }

  const pathways: VisaPathway[] = [
    {
      from: `D-8 (${subTypeLabel})`,
      to: 'F-2 (거주)',
      requirements: ['D-8 2년+ 체류', '매출 실적', '고용 유지', 'TOPIK 2급+'],
      estimatedYears: 2,
      difficulty: 'moderate',
    },
    {
      from: 'D-8 → F-2',
      to: 'F-5 (영주)',
      requirements: ['체류 5년+', '투자 유지', 'GNI 이상 소득', '한국어'],
      estimatedYears: 5,
      difficulty: 'moderate',
    },
    {
      from: 'D-8',
      to: 'F-5-3 (투자이민 영주)',
      requirements: ['투자금 5억원+', '3년+ 체류', '5명+ 고용'],
      estimatedYears: 3,
      difficulty: 'hard',
    },
  ];

  const processing: ProcessingEstimate = {
    standardDays: input.subType === 'D-8-4' ? 60 : 30,
    interviewLikelihood: input.subType === 'D-8-4' ? 'high' : 'medium',
    interviewNote: input.subType === 'D-8-4'
      ? '스타트업비자는 사업계획 발표(피칭) 심사가 있습니다. 사업 아이디어와 실현 가능성을 명확히 설명하세요.'
      : '투자 실체와 사업 타당성에 대한 서면 심사가 중심입니다.',
  };

  const requiredDocuments = [
    '여권 원본 및 사본',
    '표준규격사진 1매',
    '사업계획서 (한국어 또는 영어)',
    input.hasCompanyRegistration ? '법인등기부등본 / 사업자등록증' : null,
    '투자금 입금 증빙 (외국환매입증명서 등)',
    input.subType === 'D-8-1' ? '외국인투자기업 등록증 (KOTRA)' : null,
    input.subType === 'D-8-4' ? 'OASIS 심사 통과 확인서' : null,
    input.hasTechnologyPatent ? '특허등록증 사본' : null,
    input.hasVCFunding ? 'VC 투자계약서' : null,
    '최종학력 증명서 (아포스티유)',
    input.hasRelatedExperience ? '경력증명서' : null,
    '사무실 임대차계약서',
    '범죄경력증명서 (본국)',
    '수수료 (13만원)',
  ].filter(Boolean) as string[];

  return { eligible, eligibilityScore, subTypeLabel, requirements, recommendation, warnings, requiredDocuments, pathways, processing };
}

// ─────────────────────────────────────────
// 비자 전환 경로 안내 시스템 (신규)
// ─────────────────────────────────────────

export interface VisaPathwayResult {
  currentVisa: string;
  targetVisa: string;
  routes: {
    path: string[];
    totalYears: number;
    difficulty: 'easy' | 'moderate' | 'hard';
    steps: {
      from: string;
      to: string;
      requirements: string[];
      years: number;
    }[];
  }[];
}

export function getVisaPathways(currentVisa: string, targetVisa: string): VisaPathwayResult {
  const routes: VisaPathwayResult['routes'] = [];

  // D-2 경로
  if (currentVisa.startsWith('D-2')) {
    if (targetVisa === 'F-5') {
      routes.push({
        path: ['D-2', 'D-10', 'E-7', 'F-2-7', 'F-5'],
        totalYears: 8,
        difficulty: 'hard',
        steps: [
          { from: 'D-2', to: 'D-10', requirements: ['졸업', '구직활동 계획'], years: 0.5 },
          { from: 'D-10', to: 'E-7', requirements: ['취업', '고용추천서'], years: 1 },
          { from: 'E-7', to: 'F-2-7', requirements: ['점수 80점+'], years: 1.5 },
          { from: 'F-2-7', to: 'F-5', requirements: ['3년 유지', 'TOPIK 4급+'], years: 3 },
        ],
      });
    }
    if (targetVisa === 'E-7' || targetVisa === 'F-2-7') {
      routes.push({
        path: ['D-2', 'D-10', 'E-7'],
        totalYears: 2,
        difficulty: 'moderate',
        steps: [
          { from: 'D-2', to: 'D-10', requirements: ['졸업'], years: 0.5 },
          { from: 'D-10', to: 'E-7', requirements: ['취업'], years: 1 },
        ],
      });
    }
  }

  // E-7 경로
  if (currentVisa.startsWith('E-7')) {
    if (targetVisa === 'F-5') {
      routes.push({
        path: ['E-7', 'F-2-7', 'F-5-10'],
        totalYears: 5,
        difficulty: 'moderate',
        steps: [
          { from: 'E-7', to: 'F-2-7', requirements: ['1년+ 체류', '점수 80점+'], years: 1.5 },
          { from: 'F-2-7', to: 'F-5-10', requirements: ['3년 유지', 'TOPIK 4급+', 'GNI+'], years: 3 },
        ],
      });
    }
  }

  // E-9 경로
  if (currentVisa.startsWith('E-9')) {
    if (targetVisa === 'F-5') {
      routes.push({
        path: ['E-9', 'E-7-4', 'F-2-7', 'F-5'],
        totalYears: 10,
        difficulty: 'hard',
        steps: [
          { from: 'E-9', to: 'E-7-4', requirements: ['4년+ 체류', 'TOPIK 4급+', '기능자격증'], years: 4 },
          { from: 'E-7-4', to: 'F-2-7', requirements: ['1년+', '점수 80점+'], years: 2 },
          { from: 'F-2-7', to: 'F-5', requirements: ['3년 유지'], years: 3 },
        ],
      });
    }
  }

  // F-2-7 경로
  if (currentVisa === 'F-2-7') {
    routes.push({
      path: ['F-2-7', 'F-5-10'],
      totalYears: 3,
      difficulty: 'moderate',
      steps: [
        { from: 'F-2-7', to: 'F-5-10', requirements: ['3년 유지', 'TOPIK 4급+', 'GNI+', '납세 3년+'], years: 3 },
      ],
    });
  }

  // F-6 경로
  if (currentVisa.startsWith('F-6')) {
    routes.push({
      path: ['F-6', 'F-5-2'],
      totalYears: 2,
      difficulty: 'moderate',
      steps: [
        { from: 'F-6', to: 'F-5-2', requirements: ['2년+ 체류', '혼인유지', 'TOPIK 4급+/KIIP 5단계'], years: 2 },
      ],
    });
  }

  // D-8 경로
  if (currentVisa.startsWith('D-8')) {
    routes.push({
      path: ['D-8', 'F-2', 'F-5'],
      totalYears: 5,
      difficulty: 'moderate',
      steps: [
        { from: 'D-8', to: 'F-2', requirements: ['2년+ 체류', '매출실적', '고용유지'], years: 2 },
        { from: 'F-2', to: 'F-5', requirements: ['3년+', 'GNI+', 'TOPIK 4급+'], years: 3 },
      ],
    });
    if (targetVisa === 'F-5') {
      routes.push({
        path: ['D-8', 'F-5-3 (투자이민)'],
        totalYears: 3,
        difficulty: 'hard',
        steps: [
          { from: 'D-8', to: 'F-5-3', requirements: ['5억원+ 투자', '3년+ 체류', '5명+ 고용'], years: 3 },
        ],
      });
    }
  }

  return { currentVisa, targetVisa, routes };
}
