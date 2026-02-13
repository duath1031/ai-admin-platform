/**
 * 주휴수당 계산기
 * 근로기준법 제55조 기준
 */

export interface WeeklyHolidayInput {
  hourlyWage: number;          // 시급
  weeklyWorkHours: number;     // 주 소정근로시간
  contractDaysPerWeek?: number; // 주 계약근무일수 (기본 5)
  actualDaysWorked?: number;    // 실제 근무일수 (주) - 결근 시
  isMonthlySalary?: boolean;   // 월급제 여부
}

export interface WeeklyHolidayResult {
  eligible: boolean;
  reason: string;

  // 입력값
  hourlyWage: number;
  weeklyWorkHours: number;
  contractDaysPerWeek: number;
  actualDaysWorked: number;

  // 주휴수당
  weeklyHolidayHours: number;   // 주휴시간
  weeklyHolidayPay: number;     // 주휴수당 (주)
  monthlyHolidayPay: number;    // 주휴수당 (월 환산)

  // 총 주급/월급
  weeklyBasePay: number;
  weeklyTotalPay: number;       // 기본급 + 주휴수당
  monthlyBasePay: number;
  monthlyTotalPay: number;

  // 시급 환산
  effectiveHourlyWage: number;  // 주휴수당 포함 시급

  // 계산 과정
  formula: string[];

  // 월급제 안내
  monthlySalaryNote?: string;
}

export function calculateWeeklyHolidayPay(input: WeeklyHolidayInput): WeeklyHolidayResult {
  const hourlyWage = input.hourlyWage;
  const weeklyHours = input.weeklyWorkHours;
  const contractDays = input.contractDaysPerWeek || 5;
  const actualDays = input.actualDaysWorked ?? contractDays;
  const isMonthlySalary = input.isMonthlySalary || false;

  const formula: string[] = [];

  // 주 15시간 미만이면 자격 없음
  if (weeklyHours < 15) {
    return {
      eligible: false,
      reason: "주 소정근로시간이 15시간 미만이므로 주휴수당 대상이 아닙니다.",
      hourlyWage,
      weeklyWorkHours: weeklyHours,
      contractDaysPerWeek: contractDays,
      actualDaysWorked: actualDays,
      weeklyHolidayHours: 0,
      weeklyHolidayPay: 0,
      monthlyHolidayPay: 0,
      weeklyBasePay: hourlyWage * weeklyHours,
      weeklyTotalPay: hourlyWage * weeklyHours,
      monthlyBasePay: hourlyWage * weeklyHours * (52 / 12),
      monthlyTotalPay: hourlyWage * weeklyHours * (52 / 12),
      effectiveHourlyWage: hourlyWage,
      formula: ["주 15시간 미만 근무로 주휴수당 미발생"],
    };
  }

  // 소정근로일수 개근 확인
  const isFullAttendance = actualDays >= contractDays;

  if (!isFullAttendance) {
    formula.push(`계약 근무일수: ${contractDays}일, 실제 근무일수: ${actualDays}일`);
    formula.push("소정근로일을 개근하지 않으면 주휴수당이 발생하지 않습니다.");

    return {
      eligible: false,
      reason: `주 ${contractDays}일 중 ${actualDays}일만 근무하여 개근 요건 미충족`,
      hourlyWage,
      weeklyWorkHours: weeklyHours,
      contractDaysPerWeek: contractDays,
      actualDaysWorked: actualDays,
      weeklyHolidayHours: 0,
      weeklyHolidayPay: 0,
      monthlyHolidayPay: 0,
      weeklyBasePay: hourlyWage * weeklyHours,
      weeklyTotalPay: hourlyWage * weeklyHours,
      monthlyBasePay: hourlyWage * weeklyHours * (52 / 12),
      monthlyTotalPay: hourlyWage * weeklyHours * (52 / 12),
      effectiveHourlyWage: hourlyWage,
      formula,
    };
  }

  // 주휴시간 계산: (주 소정근로시간 / 40) × 8
  // 40시간 이상이면 8시간 고정
  const weeklyHolidayHours = weeklyHours >= 40 ? 8 : Math.round((weeklyHours / 40) * 8 * 100) / 100;

  // 주휴수당
  const weeklyHolidayPay = Math.round(hourlyWage * weeklyHolidayHours);

  // 월 환산 (52주/12개월 = 4.345주)
  const weeksPerMonth = 52 / 12;
  const monthlyHolidayPay = Math.round(weeklyHolidayPay * weeksPerMonth);

  // 기본급
  const weeklyBasePay = hourlyWage * weeklyHours;
  const weeklyTotalPay = weeklyBasePay + weeklyHolidayPay;
  const monthlyBasePay = Math.round(weeklyBasePay * weeksPerMonth);
  const monthlyTotalPay = Math.round(weeklyTotalPay * weeksPerMonth);

  // 실질 시급
  const totalWeeklyHours = weeklyHours + weeklyHolidayHours;
  const effectiveHourlyWage = Math.round(weeklyTotalPay / weeklyHours);

  formula.push(`시급: ${hourlyWage.toLocaleString()}원`);
  formula.push(`주 소정근로시간: ${weeklyHours}시간`);
  formula.push(`주휴시간 = ${weeklyHours >= 40 ? "8시간 (40시간 이상)" : `(${weeklyHours}/40) × 8 = ${weeklyHolidayHours}시간`}`);
  formula.push(`주휴수당 = ${hourlyWage.toLocaleString()} × ${weeklyHolidayHours} = ${weeklyHolidayPay.toLocaleString()}원`);
  formula.push(`월 환산 = ${weeklyHolidayPay.toLocaleString()} × 4.345 = ${monthlyHolidayPay.toLocaleString()}원`);

  return {
    eligible: true,
    reason: "주 15시간 이상 근무 + 소정근로일 개근으로 주휴수당 발생",
    hourlyWage,
    weeklyWorkHours: weeklyHours,
    contractDaysPerWeek: contractDays,
    actualDaysWorked: actualDays,
    weeklyHolidayHours,
    weeklyHolidayPay,
    monthlyHolidayPay,
    weeklyBasePay,
    weeklyTotalPay,
    monthlyBasePay,
    monthlyTotalPay,
    effectiveHourlyWage,
    formula,
    monthlySalaryNote: isMonthlySalary
      ? "월급제의 경우 통상 주휴수당이 이미 월급에 포함되어 있습니다. 근로계약서를 확인하세요."
      : undefined,
  };
}
