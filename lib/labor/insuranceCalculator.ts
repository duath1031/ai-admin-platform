/**
 * 4대보험 + 소득세 계산기 (2026년 기준)
 */

// ─────────────────────────────────────────
// 2026 보험 요율 상수
// ─────────────────────────────────────────

/** 국민연금 */
const NP_RATE = 0.095; // 9.5%
const NP_EMPLOYEE_RATE = 0.0475;
const NP_EMPLOYER_RATE = 0.0475;
const NP_UPPER = 6_370_000; // 기준소득월액 상한
const NP_LOWER = 400_000;   // 기준소득월액 하한

/** 건강보험 */
const HI_RATE = 0.0719; // 7.19%
const HI_EMPLOYEE_RATE = 0.03595;
const HI_EMPLOYER_RATE = 0.03595;

/** 장기요양보험 (건강보험료의 13.14%) */
const LTC_RATE = 0.1314;

/** 고용보험 */
const EI_EMPLOYEE_RATE = 0.009; // 근로자 0.9%
const EI_EMPLOYER_BASE_RATE = 0.009; // 사업주 기본 0.9%

/** 사업주 고용안정/직업능력개발 추가요율 (사업장 규모별) */
export const EI_EMPLOYER_EXTRA: Record<string, { rate: number; label: string }> = {
  "under150":  { rate: 0.0025, label: "150인 미만" },
  "150_to_1000": { rate: 0.0045, label: "150인~1,000인 미만" },
  "1000_plus":  { rate: 0.0065, label: "1,000인 이상" },
  "govt_1000_plus": { rate: 0.0085, label: "국가/지자체 1,000인 이상" },
};

// ─────────────────────────────────────────
// 산재보험 업종별 요율 (2026)
// ─────────────────────────────────────────

export interface IndustryRate {
  code: string;
  name: string;
  rate: number; // %
}

export const INDUSTRY_RATES: IndustryRate[] = [
  { code: "01", name: "광업", rate: 5.8 },
  { code: "02", name: "목재/벌목업", rate: 4.5 },
  { code: "03", name: "어업", rate: 3.0 },
  { code: "04", name: "농업", rate: 1.7 },
  { code: "10", name: "식료품제조업", rate: 1.5 },
  { code: "11", name: "섬유/의복제조업", rate: 1.2 },
  { code: "12", name: "목재/가구제조업", rate: 2.3 },
  { code: "13", name: "펄프/종이제조업", rate: 1.6 },
  { code: "14", name: "인쇄/출판업", rate: 0.9 },
  { code: "15", name: "화학제품제조업", rate: 1.1 },
  { code: "16", name: "고무/플라스틱제조업", rate: 1.4 },
  { code: "17", name: "비금속광물제조업", rate: 2.1 },
  { code: "18", name: "1차금속제조업", rate: 2.0 },
  { code: "19", name: "금속가공제품제조업", rate: 2.2 },
  { code: "20", name: "기계기구제조업", rate: 1.6 },
  { code: "21", name: "전기기계제조업", rate: 1.0 },
  { code: "22", name: "전자제품제조업", rate: 0.7 },
  { code: "23", name: "운송장비제조업", rate: 1.8 },
  { code: "24", name: "기타제조업", rate: 1.5 },
  { code: "30", name: "전기/가스/수도업", rate: 0.7 },
  { code: "40", name: "건설업(일반)", rate: 3.5 },
  { code: "41", name: "건설업(주택)", rate: 4.0 },
  { code: "50", name: "운수/창고업", rate: 1.6 },
  { code: "60", name: "도소매/음식숙박업", rate: 0.9 },
  { code: "70", name: "부동산/임대업", rate: 0.7 },
  { code: "80", name: "전문/과학/기술서비스업", rate: 0.5 },
  { code: "81", name: "사업시설관리/사업지원서비스업", rate: 0.9 },
  { code: "85", name: "보건/사회복지업", rate: 0.7 },
  { code: "90", name: "교육서비스업", rate: 0.5 },
  { code: "95", name: "기타서비스업", rate: 0.7 },
  { code: "99", name: "금융/보험업", rate: 0.5 },
];

// ─────────────────────────────────────────
// 소득세 구간 (2026 기준)
// ─────────────────────────────────────────

const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000, rate: 0.06, deduction: 0 },
  { limit: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity, rate: 0.45, deduction: 65_940_000 },
];

// ─────────────────────────────────────────
// 근로소득 간이세액표 기반 월 소득세 계산
// ─────────────────────────────────────────

function calculateMonthlyIncomeTax(
  monthlySalary: number,
  nonTaxable: number,
  dependents: number,
  childrenUnder20: number
): number {
  // 과세 대상 연봉 추정
  const taxableMonthly = Math.max(0, monthlySalary - nonTaxable);
  const annualTaxable = taxableMonthly * 12;

  if (annualTaxable <= 0) return 0;

  // 근로소득공제
  let earnedIncomeDeduction = 0;
  if (annualTaxable <= 5_000_000) {
    earnedIncomeDeduction = annualTaxable * 0.7;
  } else if (annualTaxable <= 15_000_000) {
    earnedIncomeDeduction = 3_500_000 + (annualTaxable - 5_000_000) * 0.4;
  } else if (annualTaxable <= 45_000_000) {
    earnedIncomeDeduction = 7_500_000 + (annualTaxable - 15_000_000) * 0.15;
  } else if (annualTaxable <= 100_000_000) {
    earnedIncomeDeduction = 12_000_000 + (annualTaxable - 45_000_000) * 0.05;
  } else {
    earnedIncomeDeduction = 14_750_000 + (annualTaxable - 100_000_000) * 0.02;
  }

  const grossIncome = annualTaxable - earnedIncomeDeduction;

  // 인적공제 (1인당 150만원)
  const personalDeduction = dependents * 1_500_000;

  // 자녀세액공제용 (나중에 세액에서 차감)
  const childTaxCredit = childrenUnder20 <= 0 ? 0 :
    childrenUnder20 === 1 ? 150_000 :
    childrenUnder20 === 2 ? 350_000 :
    350_000 + (childrenUnder20 - 2) * 300_000;

  // 국민연금 공제 (연간)
  const npBase = Math.min(Math.max(taxableMonthly, NP_LOWER), NP_UPPER);
  const annualNP = npBase * NP_EMPLOYEE_RATE * 12;

  // 건강보험+장기요양 공제 (연간)
  const annualHI = taxableMonthly * HI_EMPLOYEE_RATE * 12;
  const annualLTC = annualHI * LTC_RATE;

  // 고용보험 공제 (연간)
  const annualEI = taxableMonthly * EI_EMPLOYEE_RATE * 12;

  // 과세표준
  const taxableBase = Math.max(0, grossIncome - personalDeduction - annualNP - annualHI - annualLTC - annualEI);

  // 산출세액 (누진세율 적용)
  let annualTax = 0;
  for (const bracket of INCOME_TAX_BRACKETS) {
    if (taxableBase <= bracket.limit) {
      annualTax = taxableBase * bracket.rate - bracket.deduction;
      break;
    }
  }
  annualTax = Math.max(0, annualTax);

  // 자녀세액공제 차감
  annualTax = Math.max(0, annualTax - childTaxCredit);

  // 월 소득세 (10원 미만 절사)
  const monthlyTax = Math.floor(annualTax / 12 / 10) * 10;
  return monthlyTax;
}

// ─────────────────────────────────────────
// 메인 계산 함수
// ─────────────────────────────────────────

export interface InsuranceCalcInput {
  monthlySalary: number;       // 월 급여 (세전)
  nonTaxableAmount?: number;   // 비과세 (식대 등)
  dependents?: number;         // 부양가족 수 (본인 포함)
  childrenUnder20?: number;    // 20세 이하 자녀 수
  companySize?: string;        // 사업장 규모 (under150, 150_to_1000, 1000_plus, govt_1000_plus)
  industryCode?: string;       // 산재보험 업종코드
  nationalPensionExempt?: boolean;
  healthInsuranceExempt?: boolean;
  employmentInsuranceExempt?: boolean;
}

export interface InsuranceDeduction {
  label: string;
  employeeAmount: number;
  employerAmount: number;
  rate?: string;
}

export interface InsuranceCalcResult {
  // 입력 요약
  monthlySalary: number;
  nonTaxableAmount: number;
  taxableAmount: number;

  // 공제 항목별
  nationalPension: InsuranceDeduction;
  healthInsurance: InsuranceDeduction;
  longTermCare: InsuranceDeduction;
  employmentInsurance: InsuranceDeduction;
  industrialAccident: InsuranceDeduction;
  incomeTax: InsuranceDeduction;
  localIncomeTax: InsuranceDeduction;

  // 합계
  totalEmployeeDeduction: number;
  totalEmployerBurden: number;
  netPay: number;
  totalLaborCost: number; // 사업주 총 인건비 (급여 + 사업주부담분)

  deductionsList: InsuranceDeduction[];
}

export function calculateInsurance(input: InsuranceCalcInput): InsuranceCalcResult {
  const salary = input.monthlySalary;
  const nonTaxable = input.nonTaxableAmount || 0;
  const dependents = input.dependents || 1;
  const children = input.childrenUnder20 || 0;
  const companySize = input.companySize || "under150";
  const industryCode = input.industryCode || "80";

  const taxable = Math.max(0, salary - nonTaxable);

  // 1) 국민연금
  const npExempt = input.nationalPensionExempt || false;
  const npBase = npExempt ? 0 : Math.min(Math.max(taxable, NP_LOWER), NP_UPPER);
  const npEmployee = npExempt ? 0 : Math.floor(npBase * NP_EMPLOYEE_RATE / 10) * 10;
  const npEmployer = npExempt ? 0 : Math.floor(npBase * NP_EMPLOYER_RATE / 10) * 10;

  // 2) 건강보험
  const hiExempt = input.healthInsuranceExempt || false;
  const hiEmployee = hiExempt ? 0 : Math.floor(taxable * HI_EMPLOYEE_RATE / 10) * 10;
  const hiEmployer = hiExempt ? 0 : Math.floor(taxable * HI_EMPLOYER_RATE / 10) * 10;

  // 3) 장기요양보험 (건보료 기준)
  const ltcEmployee = hiExempt ? 0 : Math.floor(hiEmployee * LTC_RATE / 10) * 10;
  const ltcEmployer = hiExempt ? 0 : Math.floor(hiEmployer * LTC_RATE / 10) * 10;

  // 4) 고용보험
  const eiExempt = input.employmentInsuranceExempt || false;
  const eiEmployee = eiExempt ? 0 : Math.floor(taxable * EI_EMPLOYEE_RATE / 10) * 10;
  const eiExtraRate = EI_EMPLOYER_EXTRA[companySize]?.rate || 0.0025;
  const eiEmployer = eiExempt ? 0 : Math.floor(taxable * (EI_EMPLOYER_BASE_RATE + eiExtraRate) / 10) * 10;

  // 5) 산재보험 (사업주 전액)
  const industry = INDUSTRY_RATES.find(i => i.code === industryCode);
  const iaRate = (industry?.rate || 0.7) / 100;
  const iaEmployer = Math.floor(taxable * iaRate / 10) * 10;

  // 6) 소득세
  const incomeTax = calculateMonthlyIncomeTax(salary, nonTaxable, dependents, children);

  // 7) 지방소득세 (소득세의 10%)
  const localIncomeTax = Math.floor(incomeTax * 0.1 / 10) * 10;

  // 항목별 정리
  const nationalPension: InsuranceDeduction = {
    label: "국민연금",
    employeeAmount: npEmployee,
    employerAmount: npEmployer,
    rate: `${(NP_RATE * 100).toFixed(1)}% (각 ${(NP_EMPLOYEE_RATE * 100).toFixed(2)}%)`,
  };

  const healthInsurance: InsuranceDeduction = {
    label: "건강보험",
    employeeAmount: hiEmployee,
    employerAmount: hiEmployer,
    rate: `${(HI_RATE * 100).toFixed(2)}% (각 ${(HI_EMPLOYEE_RATE * 100).toFixed(3)}%)`,
  };

  const longTermCare: InsuranceDeduction = {
    label: "장기요양보험",
    employeeAmount: ltcEmployee,
    employerAmount: ltcEmployer,
    rate: `건보료의 ${(LTC_RATE * 100).toFixed(2)}%`,
  };

  const employmentInsurance: InsuranceDeduction = {
    label: "고용보험",
    employeeAmount: eiEmployee,
    employerAmount: eiEmployer,
    rate: `근로자 ${(EI_EMPLOYEE_RATE * 100).toFixed(1)}% / 사업주 ${((EI_EMPLOYER_BASE_RATE + eiExtraRate) * 100).toFixed(2)}%`,
  };

  const industrialAccident: InsuranceDeduction = {
    label: "산재보험",
    employeeAmount: 0,
    employerAmount: iaEmployer,
    rate: `${(iaRate * 100).toFixed(1)}% (사업주 전액)`,
  };

  const incomeTaxItem: InsuranceDeduction = {
    label: "소득세",
    employeeAmount: incomeTax,
    employerAmount: 0,
    rate: "간이세액표",
  };

  const localIncomeTaxItem: InsuranceDeduction = {
    label: "지방소득세",
    employeeAmount: localIncomeTax,
    employerAmount: 0,
    rate: "소득세의 10%",
  };

  const deductionsList = [
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    industrialAccident,
    incomeTaxItem,
    localIncomeTaxItem,
  ];

  const totalEmployeeDeduction = npEmployee + hiEmployee + ltcEmployee + eiEmployee + incomeTax + localIncomeTax;
  const totalEmployerBurden = npEmployer + hiEmployer + ltcEmployer + eiEmployer + iaEmployer;
  const netPay = salary - totalEmployeeDeduction;

  return {
    monthlySalary: salary,
    nonTaxableAmount: nonTaxable,
    taxableAmount: taxable,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    industrialAccident,
    incomeTax: incomeTaxItem,
    localIncomeTax: localIncomeTaxItem,
    totalEmployeeDeduction,
    totalEmployerBurden,
    netPay,
    totalLaborCost: salary + totalEmployerBurden,
    deductionsList,
  };
}
