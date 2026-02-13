/**
 * 연차 계산기
 * 근로기준법 제60조 기준
 */

export interface AnnualLeaveInput {
  hireDate: string;       // 입사일 (YYYY-MM-DD)
  usedDays?: number;      // 사용일수
  asOfDate?: string;      // 기준일 (미입력 시 오늘)
}

export interface YearlyLeave {
  year: number;        // 근무 N년차
  periodStart: string;
  periodEnd: string;
  entitled: number;    // 발생일수
  description: string;
}

export interface AnnualLeaveResult {
  hireDate: string;
  asOfDate: string;
  totalServiceDays: number;
  serviceYears: number;
  serviceMonths: number;

  // 현재 기간 연차
  currentEntitled: number;
  usedDays: number;
  remainingDays: number;

  // 연도별 내역
  yearlyHistory: YearlyLeave[];

  // 총 누적
  totalEntitled: number;
}

export function calculateAnnualLeave(input: AnnualLeaveInput): AnnualLeaveResult {
  const hire = new Date(input.hireDate);
  const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
  const usedDays = input.usedDays || 0;

  const totalServiceDays = Math.floor((asOf.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24));

  // 연/월 계산
  let serviceYears = asOf.getFullYear() - hire.getFullYear();
  let serviceMonths = asOf.getMonth() - hire.getMonth();
  if (asOf.getDate() < hire.getDate()) serviceMonths--;
  if (serviceMonths < 0) {
    serviceYears--;
    serviceMonths += 12;
  }

  const yearlyHistory: YearlyLeave[] = [];
  let totalEntitled = 0;
  let currentEntitled = 0;

  // 1년차 (입사 후 1년 미만): 매월 1일 발생, 최대 11일
  const firstYearEnd = new Date(hire);
  firstYearEnd.setFullYear(firstYearEnd.getFullYear() + 1);

  if (totalServiceDays < 365) {
    // 아직 1년 미만
    const completedMonths = Math.min(serviceYears * 12 + serviceMonths, 11);
    const entitled = completedMonths;
    yearlyHistory.push({
      year: 1,
      periodStart: hire.toISOString().split('T')[0],
      periodEnd: firstYearEnd.toISOString().split('T')[0],
      entitled,
      description: `1년 미만: 매월 개근 시 1일 발생 (${completedMonths}개월 완료)`,
    });
    currentEntitled = entitled;
    totalEntitled = entitled;
  } else {
    // 1년차 내역 (11일)
    yearlyHistory.push({
      year: 1,
      periodStart: hire.toISOString().split('T')[0],
      periodEnd: firstYearEnd.toISOString().split('T')[0],
      entitled: 11,
      description: "1년 미만 기간: 매월 1일 × 11개월 = 11일",
    });
    totalEntitled += 11;

    // 2년차 이후
    for (let y = 1; y <= serviceYears; y++) {
      const periodStart = new Date(hire);
      periodStart.setFullYear(periodStart.getFullYear() + y);
      const periodEnd = new Date(hire);
      periodEnd.setFullYear(periodEnd.getFullYear() + y + 1);

      // 15일 + 2년마다 1일 추가, 최대 25일
      const extraDays = Math.floor(Math.max(0, y - 1) / 2);
      const entitled = Math.min(15 + extraDays, 25);

      yearlyHistory.push({
        year: y + 1,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        entitled,
        description: y === 1
          ? `1년 이상 근무: 기본 15일`
          : `${y}년 근속: 15일 + 추가 ${extraDays}일 = ${entitled}일${entitled >= 25 ? " (상한)" : ""}`,
      });

      // 현재 기간인지 확인
      if (asOf >= periodStart && asOf < periodEnd) {
        currentEntitled = entitled;
      }

      totalEntitled += entitled;
    }

    // 현재 기간이 설정되지 않았으면 마지막 연도
    if (currentEntitled === 0 && yearlyHistory.length > 1) {
      currentEntitled = yearlyHistory[yearlyHistory.length - 1].entitled;
    }
  }

  return {
    hireDate: input.hireDate,
    asOfDate: asOf.toISOString().split('T')[0],
    totalServiceDays,
    serviceYears,
    serviceMonths,
    currentEntitled,
    usedDays,
    remainingDays: Math.max(0, currentEntitled - usedDays),
    yearlyHistory,
    totalEntitled,
  };
}
