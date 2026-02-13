/**
 * 자동차 이전등록 취등록세 계산 엔진
 *
 * 2026년 기준 자동차 취득세/등록면허세/교육세/공채매입 계산
 * 지방세법, 지방교육세법, 공채매입규정 적용
 */

// ─── Types ───

export interface TransferCostInput {
  vehicleType: "sedan" | "suv" | "van" | "truck" | "bus" | "special" | "motorcycle";
  purchasePrice: number;         // 취득가액 (원)
  displacement?: number;         // 배기량 (cc)
  isElectric?: boolean;          // 전기차 여부
  isHybrid?: boolean;            // 하이브리드 여부
  isCommercial?: boolean;        // 영업용 여부
  isDisabled?: boolean;          // 장애인 감면 여부
  isMultiChild?: boolean;        // 다자녀 감면 (3자녀 이상)
  region: string;                // 지역 (서울, 경기, 부산 등)
  isFirstCar?: boolean;          // 생애최초 차량 여부
  transferType: "new" | "used";  // 신차/중고차
  passengerCapacity?: number;    // 승객 수(인승) - 승합차 세율 분기용
  loadCapacity?: number;         // 적재량 (톤) - 화물차 참고용
}

export interface TransferCostResult {
  // 세금 항목
  acquisitionTax: number;       // 취득세
  registrationTax: number;      // 등록면허세
  educationTax: number;         // 교육세 (취득세의 20%)
  specialTax: number;           // 농어촌특별세 (일부 면제 차종)

  // 공채
  bondAmount: number;           // 공채매입액
  bondDiscount: number;         // 공채할인매입액 (할인율 적용)
  bondRate: number;             // 공채매입비율 (%)

  // 기타
  stampTax: number;             // 인지세 (비영업용: 3,000원)
  plateChangeFee: number;       // 번호판 교체비 (중고차 이전시)

  // 합계
  totalTax: number;             // 세금 합계
  totalCost: number;            // 총 비용 (세금 + 공채할인 + 기타)

  // 감면 내역
  discounts: { name: string; amount: number }[];

  // 계산 상세
  breakdown: { label: string; amount: number; note?: string }[];
}

// ─── 세율 테이블 (2026년 기준) ───

// 취득세율 (지방세법 제12조)
const ACQUISITION_TAX_RATES: Record<string, number> = {
  // 비영업용
  "sedan": 0.07,          // 승용차 7%
  "suv": 0.07,            // SUV 7%
  "van": 0.07,            // 승합차(15인 이하) 7% (비영업용), 15인 초과는 5%
  "truck": 0.05,          // 화물차 5%
  "bus": 0.05,            // 버스 5%
  "special": 0.05,        // 특수차 5%
  "motorcycle": 0.02,     // 이륜차 2%
};

// 경차 취득세율 (1000cc 이하, 최대 75만원 감면)
const LIGHT_CAR_TAX_RATE = 0.04;

// 영업용 취득세율
const COMMERCIAL_TAX_RATE = 0.04;

// 등록면허세 (지방세법 제28조) - 정액
const REGISTRATION_TAX: Record<string, number> = {
  // 비영업용
  "sedan": 15000,
  "suv": 15000,
  "van": 10000,
  "truck": 10000,
  "bus": 10000,
  "special": 10000,
  "motorcycle": 10000,
};

// 공채매입비율 (지역별, 차종별 상이)
// 서울 기준 비영업용 승용차: 배기량에 따라 차등
const BOND_RATES: Record<string, Record<string, number>> = {
  "서울": {
    "under1600": 0.09,   // 1600cc 이하: 9%
    "1600to2000": 0.12,  // 1600~2000cc: 12%
    "over2000": 0.20,    // 2000cc 초과: 20%
    "electric": 0.09,    // 전기차: 9%
    "truck": 0.05,       // 화물차: 5%
    "van": 0.05,         // 승합차: 5%
  },
  "경기": {
    "under1600": 0.05,
    "1600to2000": 0.08,
    "over2000": 0.12,
    "electric": 0.05,
    "truck": 0.03,
    "van": 0.03,
  },
  "부산": {
    "under1600": 0.04,
    "1600to2000": 0.07,
    "over2000": 0.10,
    "electric": 0.04,
    "truck": 0.03,
    "van": 0.03,
  },
  // 기본값 (기타 지역)
  "default": {
    "under1600": 0.04,
    "1600to2000": 0.06,
    "over2000": 0.08,
    "electric": 0.04,
    "truck": 0.02,
    "van": 0.02,
  },
};

// 공채할인율 (보통 약 3~5% 할인매입)
const BOND_DISCOUNT_RATE = 0.04; // 4% 할인매입 기준

// 전기차 취득세 감면한도 (2026년: 최대 140만원)
const EV_TAX_DISCOUNT_LIMIT = 1_400_000;

// 하이브리드 취득세 감면한도 (2026년: 최대 40만원)
const HYBRID_TAX_DISCOUNT_LIMIT = 400_000;

// 다자녀 감면 (취득세 50% 감면, 최대 140만원)
const MULTI_CHILD_DISCOUNT_RATE = 0.5;
const MULTI_CHILD_DISCOUNT_LIMIT = 1_400_000;

// 경차 취득세 감면한도 (최대 75만원 면제)
const LIGHT_CAR_TAX_DISCOUNT_LIMIT = 750_000;

// 생애최초 차량 감면 (취득가액 4000만원 이하 승용차, 취득세 100% 면제, 최대 150만원)
const FIRST_CAR_PRICE_LIMIT = 40_000_000;
const FIRST_CAR_DISCOUNT_LIMIT = 1_500_000;

// ─── 계산 함수 ───

export function calculateTransferCost(input: TransferCostInput): TransferCostResult {
  const discounts: { name: string; amount: number }[] = [];
  const breakdown: { label: string; amount: number; note?: string }[] = [];

  // 경차 여부 판정 (배기량 1000cc 이하)
  const isLightCar = !!(input.displacement && input.displacement <= 1000);

  // 1. 취득세율 결정
  let taxRate: number;
  if (input.isCommercial) {
    // 영업용: 전차종 4%
    taxRate = COMMERCIAL_TAX_RATE;
  } else if (isLightCar) {
    // 경차 (1000cc 이하): 4%
    taxRate = LIGHT_CAR_TAX_RATE;
  } else if (input.vehicleType === "van") {
    // 비영업용 승합차: 인승에 따라 분기
    const capacity = input.passengerCapacity ?? 15;
    taxRate = capacity <= 15 ? 0.07 : 0.05;
  } else {
    taxRate = ACQUISITION_TAX_RATES[input.vehicleType] || 0.07;
  }

  let acquisitionTax = Math.floor(input.purchasePrice * taxRate);

  // 경차 취득세 감면 (최대 75만원 면제)
  if (isLightCar && !input.isCommercial) {
    const lightCarDiscount = Math.min(acquisitionTax, LIGHT_CAR_TAX_DISCOUNT_LIMIT);
    discounts.push({ name: "경차 취득세 감면 (최대 75만원)", amount: lightCarDiscount });
    acquisitionTax -= lightCarDiscount;
  }

  // 전기차 감면
  if (input.isElectric) {
    const evDiscount = Math.min(acquisitionTax, EV_TAX_DISCOUNT_LIMIT);
    discounts.push({ name: "전기차 취득세 감면", amount: evDiscount });
    acquisitionTax -= evDiscount;
  }

  // 하이브리드 감면
  if (input.isHybrid && !input.isElectric) {
    const hybridDiscount = Math.min(acquisitionTax, HYBRID_TAX_DISCOUNT_LIMIT);
    discounts.push({ name: "하이브리드 취득세 감면", amount: hybridDiscount });
    acquisitionTax -= hybridDiscount;
  }

  // 생애최초 차량 감면 (취득가액 4000만원 이하 승용차, 취득세 100% 면제, 최대 150만원)
  if (
    input.isFirstCar &&
    !input.isDisabled &&
    (input.vehicleType === "sedan" || input.vehicleType === "suv") &&
    input.purchasePrice <= FIRST_CAR_PRICE_LIMIT
  ) {
    const firstCarDiscount = Math.min(acquisitionTax, FIRST_CAR_DISCOUNT_LIMIT);
    discounts.push({ name: "생애최초 차량 취득세 감면 (최대 150만원)", amount: firstCarDiscount });
    acquisitionTax -= firstCarDiscount;
  }

  // 장애인 감면 (전액 면제 가능)
  if (input.isDisabled) {
    const disabledDiscount = acquisitionTax;
    discounts.push({ name: "장애인 취득세 면제", amount: disabledDiscount });
    acquisitionTax = 0;
  }

  // 다자녀 감면
  if (input.isMultiChild && !input.isDisabled) {
    const multiDiscount = Math.min(
      Math.floor(acquisitionTax * MULTI_CHILD_DISCOUNT_RATE),
      MULTI_CHILD_DISCOUNT_LIMIT
    );
    discounts.push({ name: "다자녀 취득세 감면 (50%)", amount: multiDiscount });
    acquisitionTax -= multiDiscount;
  }

  // 10원 미만 절사
  acquisitionTax = Math.floor(acquisitionTax / 10) * 10;

  // 세율 표시 텍스트 (승합차 인승 정보 포함)
  let taxRateNote = `취득가액 ${input.purchasePrice.toLocaleString()}원 × ${(taxRate * 100).toFixed(1)}%`;
  if (!input.isCommercial && input.vehicleType === "van") {
    const capacity = input.passengerCapacity ?? 15;
    taxRateNote += ` (${capacity}인승)`;
  }

  breakdown.push({
    label: "취득세",
    amount: acquisitionTax,
    note: taxRateNote,
  });

  // 2. 등록면허세 (경차 1000cc 이하: 면제)
  let registrationTax = REGISTRATION_TAX[input.vehicleType] || 15000;
  if (isLightCar && !input.isCommercial) {
    discounts.push({ name: "경차 등록면허세 면제", amount: registrationTax });
    registrationTax = 0;
  }
  breakdown.push({
    label: "등록면허세",
    amount: registrationTax,
    note: isLightCar && !input.isCommercial ? "경차 면제" : "정액",
  });

  // 3. 교육세 (취득세의 20%)
  const educationTax = Math.floor(acquisitionTax * 0.2 / 10) * 10;
  breakdown.push({
    label: "지방교육세",
    amount: educationTax,
    note: "취득세의 20%",
  });

  // 4. 농어촌특별세 (비영업용 승용 1600cc 초과만, 경차는 면제)
  let specialTax = 0;
  if (
    !input.isCommercial &&
    !isLightCar &&
    (input.vehicleType === "sedan" || input.vehicleType === "suv") &&
    input.displacement &&
    input.displacement > 1600 &&
    !input.isElectric
  ) {
    specialTax = Math.floor(acquisitionTax * 0.1 / 10) * 10;
    breakdown.push({
      label: "농어촌특별세",
      amount: specialTax,
      note: "1600cc 초과 승용차, 취득세의 10%",
    });
  } else if (isLightCar && !input.isCommercial) {
    // 경차는 농어촌특별세 면제 (0원이므로 표시만)
    breakdown.push({
      label: "농어촌특별세",
      amount: 0,
      note: "경차 면제",
    });
  }

  // 5. 공채 매입
  const regionBonds = BOND_RATES[input.region] || BOND_RATES["default"];
  let bondKey: string;

  if (input.isElectric) {
    bondKey = "electric";
  } else if (input.vehicleType === "truck") {
    bondKey = "truck";
  } else if (input.vehicleType === "van" || input.vehicleType === "bus") {
    bondKey = "van";
  } else if (input.displacement && input.displacement <= 1600) {
    bondKey = "under1600";
  } else if (input.displacement && input.displacement <= 2000) {
    bondKey = "1600to2000";
  } else {
    bondKey = "over2000";
  }

  const bondRate = regionBonds[bondKey] || 0.05;
  const bondAmount = Math.floor(input.purchasePrice * bondRate / 10) * 10;
  const bondDiscount = Math.floor(bondAmount * BOND_DISCOUNT_RATE / 10) * 10;

  breakdown.push({
    label: "공채매입",
    amount: bondAmount,
    note: `취득가액의 ${(bondRate * 100).toFixed(1)}% (${input.region || "기본"} 기준)`,
  });
  breakdown.push({
    label: "공채할인매입 (실비용)",
    amount: bondDiscount,
    note: `공채액의 ${(BOND_DISCOUNT_RATE * 100)}% 할인매입`,
  });

  // 6. 인지세
  const stampTax = input.isCommercial ? 0 : 3000;
  if (stampTax > 0) {
    breakdown.push({ label: "인지세", amount: stampTax });
  }

  // 7. 번호판 교체비 (중고차 이전시)
  const plateChangeFee = input.transferType === "used" ? 12000 : 0;
  if (plateChangeFee > 0) {
    breakdown.push({ label: "번호판 교체비", amount: plateChangeFee, note: "중고차 이전등록" });
  }

  // 합계
  const totalTax = acquisitionTax + registrationTax + educationTax + specialTax;
  const totalCost = totalTax + bondDiscount + stampTax + plateChangeFee;

  return {
    acquisitionTax,
    registrationTax,
    educationTax,
    specialTax,
    bondAmount,
    bondDiscount,
    bondRate: bondRate * 100,
    stampTax,
    plateChangeFee,
    totalTax,
    totalCost,
    discounts,
    breakdown,
  };
}

// ─── 지역 목록 ───

export const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

// ─── 차종 목록 ───

export const VEHICLE_TYPES: { value: string; label: string }[] = [
  { value: "sedan", label: "승용차" },
  { value: "suv", label: "SUV/RV" },
  { value: "van", label: "승합차" },
  { value: "truck", label: "화물차" },
  { value: "bus", label: "버스" },
  { value: "special", label: "특수차" },
  { value: "motorcycle", label: "이륜차" },
];

// ─── 연료 목록 ───

export const FUEL_TYPES: { value: string; label: string }[] = [
  { value: "gasoline", label: "가솔린" },
  { value: "diesel", label: "디젤" },
  { value: "lpg", label: "LPG" },
  { value: "electric", label: "전기" },
  { value: "hybrid", label: "하이브리드" },
  { value: "hydrogen", label: "수소" },
];
