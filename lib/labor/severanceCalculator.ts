/**
 * 퇴직금 계산기
 * 근로기준법 제34조 기준
 */

export interface SeveranceInput {
  hireDate: string;          // 입사일 (YYYY-MM-DD)
  resignDate: string;        // 퇴직일 (YYYY-MM-DD)
  monthlySalary: number;     // 월 기본급
  recentThreeMonthPay?: number; // 최근 3개월 총 급여 (미입력 시 월급*3)
  annualBonus?: number;      // 연간 상여금
  annualAllowance?: number;  // 연간 기타수당
}

export interface SeveranceResult {
  eligible: boolean;
  reason?: string;
  totalDays: number;           // 총 재직일수
  years: number;               // 재직연수
  months: number;
  days: number;

  // 평균임금 계산
  recentThreeMonthPay: number;
  recentThreeMonthDays: number;
  dailyAverageWage: number;    // 1일 평균임금
  dailyMinWage: number;        // 통상임금 기준 1일 (비교용)

  // 퇴직금
  severancePay: number;

  // 퇴직소득세 (간이)
  retirementIncomeTax: number;
  localRetirementTax: number;
  netSeverancePay: number;

  // 계산 과정
  formula: string[];
}

export function calculateSeverance(input: SeveranceInput): SeveranceResult {
  const hire = new Date(input.hireDate);
  const resign = new Date(input.resignDate);

  // 재직일수 계산
  const totalDays = Math.floor((resign.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));

  // 연/월/일 분리
  let years = resign.getFullYear() - hire.getFullYear();
  let months = resign.getMonth() - hire.getMonth();
  let days = resign.getDate() - hire.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(resign.getFullYear(), resign.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  // 1년 미만 근무 시
  if (totalDays < 365) {
    return {
      eligible: false,
      reason: "1년 미만 근무자는 퇴직금 지급 대상이 아닙니다.",
      totalDays,
      years,
      months,
      days,
      recentThreeMonthPay: 0,
      recentThreeMonthDays: 0,
      dailyAverageWage: 0,
      dailyMinWage: 0,
      severancePay: 0,
      retirementIncomeTax: 0,
      localRetirementTax: 0,
      netSeverancePay: 0,
      formula: ["1년 미만 근무로 퇴직금 미발생"],
    };
  }

  // 평균임금 계산
  const recentThreeMonthPay = input.recentThreeMonthPay || (input.monthlySalary * 3);

  // 최근 3개월 일수 (퇴직일 기준 직전 3개월)
  const threeMonthAgo = new Date(resign);
  threeMonthAgo.setMonth(threeMonthAgo.getMonth() - 3);
  const recentThreeMonthDays = Math.floor((resign.getTime() - threeMonthAgo.getTime()) / (1000 * 60 * 60 * 24));

  // 상여금/수당 일할
  const bonusPerDay = (input.annualBonus || 0) / 365 * recentThreeMonthDays / recentThreeMonthDays;
  const bonusForThreeMonths = ((input.annualBonus || 0) / 12) * 3;
  const allowanceForThreeMonths = ((input.annualAllowance || 0) / 12) * 3;

  const totalThreeMonthPay = recentThreeMonthPay + bonusForThreeMonths + allowanceForThreeMonths;
  const dailyAverageWage = Math.round(totalThreeMonthPay / recentThreeMonthDays);

  // 통상임금 기준 1일 (비교용, 월 소정근로일수 약 209시간/8 = 26.125일)
  const dailyMinWage = Math.round(input.monthlySalary / 30);

  // 실제 적용 평균임금 (평균임금 vs 통상임금 중 큰 것)
  const effectiveDailyWage = Math.max(dailyAverageWage, dailyMinWage);

  // 퇴직금 = 1일 평균임금 × 30 × (재직일수/365)
  const severancePay = Math.round(effectiveDailyWage * 30 * (totalDays / 365));

  // 퇴직소득세 간이 계산
  const { tax, localTax } = calculateRetirementTax(severancePay, years || 1);

  const formula = [
    `재직기간: ${years}년 ${months}개월 ${days}일 (총 ${totalDays}일)`,
    `최근 3개월 총급여: ${totalThreeMonthPay.toLocaleString()}원 / ${recentThreeMonthDays}일`,
    `1일 평균임금: ${dailyAverageWage.toLocaleString()}원`,
    `1일 통상임금: ${dailyMinWage.toLocaleString()}원`,
    `적용 일급: ${effectiveDailyWage.toLocaleString()}원 (둘 중 큰 값)`,
    `퇴직금 = ${effectiveDailyWage.toLocaleString()} × 30 × (${totalDays}/365)`,
    `퇴직금 = ${severancePay.toLocaleString()}원`,
  ];

  return {
    eligible: true,
    totalDays,
    years,
    months,
    days,
    recentThreeMonthPay: totalThreeMonthPay,
    recentThreeMonthDays,
    dailyAverageWage,
    dailyMinWage,
    severancePay,
    retirementIncomeTax: tax,
    localRetirementTax: localTax,
    netSeverancePay: severancePay - tax - localTax,
    formula,
  };
}

/** 퇴직소득세 간이 계산 */
function calculateRetirementTax(severancePay: number, serviceYears: number) {
  // 근속연수 공제
  let serviceDeduction = 0;
  if (serviceYears <= 5) {
    serviceDeduction = serviceYears * 1_000_000;
  } else if (serviceYears <= 10) {
    serviceDeduction = 5_000_000 + (serviceYears - 5) * 2_000_000;
  } else if (serviceYears <= 20) {
    serviceDeduction = 15_000_000 + (serviceYears - 10) * 2_500_000;
  } else {
    serviceDeduction = 40_000_000 + (serviceYears - 20) * 3_000_000;
  }

  // 환산급여
  const retirementIncome = Math.max(0, severancePay - serviceDeduction);
  const convertedSalary = Math.max(0, retirementIncome * 12 / serviceYears);

  // 환산급여 공제
  let convertedDeduction = 0;
  if (convertedSalary <= 8_000_000) {
    convertedDeduction = convertedSalary;
  } else if (convertedSalary <= 70_000_000) {
    convertedDeduction = 8_000_000 + (convertedSalary - 8_000_000) * 0.6;
  } else if (convertedSalary <= 100_000_000) {
    convertedDeduction = 45_200_000 + (convertedSalary - 70_000_000) * 0.55;
  } else {
    convertedDeduction = 61_700_000 + (convertedSalary - 100_000_000) * 0.45;
  }

  const taxBase = Math.max(0, convertedSalary - convertedDeduction);

  // 세율 적용 (일반 소득세 구간 동일)
  let annualTax = 0;
  if (taxBase <= 14_000_000) annualTax = taxBase * 0.06;
  else if (taxBase <= 50_000_000) annualTax = taxBase * 0.15 - 1_260_000;
  else if (taxBase <= 88_000_000) annualTax = taxBase * 0.24 - 5_760_000;
  else if (taxBase <= 150_000_000) annualTax = taxBase * 0.35 - 15_440_000;
  else annualTax = taxBase * 0.38 - 19_940_000;

  // 환산세액 → 실제세액
  const tax = Math.max(0, Math.round(annualTax * serviceYears / 12));
  const localTax = Math.round(tax * 0.1);

  return { tax, localTax };
}
