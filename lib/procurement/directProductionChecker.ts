// =============================================================================
// 직접생산확인 자가진단 엔진 (smpp.go.kr 기반 전면 재설계)
// 37개 업종 카테고리, 4대 요건(생산공장/생산시설/생산인력/생산공정) 각 25점
// 핵심공정 직접 수행 여부가 핵심 판정 기준
// =============================================================================

// ---------------------------------------------------------------------------
// 37개 업종 카테고리 (smpp.go.kr 기반)
// ---------------------------------------------------------------------------
export interface IndustryCategory {
  code: string;
  name: string;
  items: string[];
}

export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  { code: "01", name: "사무기기", items: ["복사기", "프린터", "스캐너", "팩스", "모니터", "PC", "노트북"] },
  { code: "02", name: "가구", items: ["사무용가구", "학교가구", "병원가구", "실험실가구", "수납가구"] },
  { code: "03", name: "전기/조명", items: ["LED조명", "형광등기구", "비상조명", "가로등", "전선/케이블"] },
  { code: "04", name: "통신/방송장비", items: ["CCTV", "네트워크장비", "인터폰", "방송장비", "통신모듈"] },
  { code: "05", name: "의료기기", items: ["진단기기", "치료기기", "재활기기", "위생용품", "의료소모품"] },
  { code: "06", name: "차량/운송장비", items: ["특장차", "전기차", "이륜차", "자전거", "트레일러"] },
  { code: "07", name: "기계/설비", items: ["산업기계", "공작기계", "농업기계", "건설기계", "펌프/밸브"] },
  { code: "08", name: "금속가공품", items: ["볼트/너트", "파이프", "주물/주강", "판금/용접", "금형"] },
  { code: "09", name: "고무/플라스틱", items: ["플라스틱용기", "고무패킹", "호스/튜브", "PVC제품", "사출물"] },
  { code: "10", name: "섬유/의류", items: ["작업복", "군복", "의료복", "침구류", "텐트/천막"] },
  { code: "11", name: "식품/음료", items: ["급식용식품", "음료", "가공식품", "유제품", "냉동식품"] },
  { code: "12", name: "화학제품", items: ["세제/세정제", "접착제", "도료/페인트", "소독제", "윤활유"] },
  { code: "13", name: "건축자재", items: ["철근", "레미콘", "시멘트", "단열재", "방수재"] },
  { code: "14", name: "환경/수처리", items: ["정수기", "수처리장비", "공기청정기", "환기설비", "소음방지"] },
  { code: "15", name: "소방/안전", items: ["소화기", "소방호스", "방화문", "안전표지", "보호장구"] },
  { code: "16", name: "측정/계량기기", items: ["저울", "온도계", "유량계", "가스감지기", "계측기"] },
  { code: "17", name: "SW/솔루션", items: ["업무용SW", "보안SW", "ERP/MES", "웹솔루션", "모바일앱"] },
  { code: "18", name: "교육/훈련용품", items: ["교구", "실험기구", "시청각장비", "운동기구", "모형/모의장비"] },
  { code: "19", name: "인쇄/출판", items: ["인쇄물", "간판/현수막", "포장재", "라벨/스티커"] },
  { code: "20", name: "사무용품", items: ["종이제품", "문구류", "파일/바인더", "사무보조용품"] },
  { code: "21", name: "전자부품", items: ["PCB", "반도체부품", "센서", "커넥터", "수동소자"] },
  { code: "22", name: "광학/정밀기기", items: ["렌즈", "현미경", "카메라", "광통신부품", "레이저장비"] },
  { code: "23", name: "에너지/발전", items: ["태양광패널", "ESS", "발전기", "UPS", "전력변환장치"] },
  { code: "24", name: "보안/경비장비", items: ["출입통제장비", "금고", "잠금장치", "검색장비"] },
  { code: "25", name: "포장/물류", items: ["팔레트", "컨테이너", "포장기계", "무인운반차"] },
  { code: "26", name: "청소/위생", items: ["청소기", "세탁기(산업용)", "청소로봇", "위생용품"] },
  { code: "27", name: "주방/급식", items: ["조리기구", "식기", "급식설비", "냉장/냉동고"] },
  { code: "28", name: "농림/수산", items: ["비료", "사료", "종자", "농기구", "양식장비"] },
  { code: "29", name: "방위/군수", items: ["군용장비", "피복/군화", "전투식량", "통신장비(군용)"] },
  { code: "30", name: "항공/우주", items: ["항공부품", "드론", "위성부품", "항법장비"] },
  { code: "31", name: "해양/조선", items: ["선박부품", "해양장비", "수중장비", "항해장비"] },
  { code: "32", name: "철도/교통", items: ["신호장비", "차량부품", "궤도용품", "교통표지"] },
  { code: "33", name: "도시/시설물", items: ["맨홀뚜껑", "볼라드", "가드레일", "조경시설"] },
  { code: "34", name: "복지/재활", items: ["보조기기", "휠체어", "의수/의족", "점자제품"] },
  { code: "35", name: "문화/체육", items: ["악기", "체육시설", "전시장비", "무대장비"] },
  { code: "36", name: "원자력/방사선", items: ["방사선측정기", "차폐용품", "방호장비"] },
  { code: "37", name: "기타", items: ["분류 외 물품"] },
];

// ---------------------------------------------------------------------------
// 업종별 핵심공정 정의
// ---------------------------------------------------------------------------
export const CORE_PROCESSES: Record<string, string[]> = {
  "01": ["조립", "검사", "포장"],
  "02": ["절단", "조립", "도장"],
  "03": ["배선/결선", "조립", "검사"],
  "04": ["PCB실장", "조립", "시험"],
  "05": ["조립", "멸균", "검사"],
  "06": ["차체조립", "도장", "검사"],
  "07": ["가공", "조립", "검사"],
  "08": ["절단", "성형(절곡/프레스)", "용접", "표면처리"],
  "09": ["사출", "압출", "가공", "조립"],
  "10": ["재단", "봉제", "검사"],
  "11": ["원료처리", "제조/가공", "포장"],
  "12": ["배합", "충전", "포장"],
  "13": ["성형", "양생", "가공"],
  "14": ["조립", "배관", "시험"],
  "15": ["성형/가공", "조립", "검사"],
  "16": ["가공", "조립", "교정/검사"],
  "17": ["설계", "개발(코딩)", "테스트"],
  "18": ["가공", "조립", "검사"],
  "19": ["인쇄", "후가공", "검사"],
  "20": ["재단/가공", "조립", "포장"],
  "21": ["SMT실장", "조립", "검사"],
  "22": ["가공/연마", "조립", "광학검사"],
  "23": ["셀조립", "모듈화", "검사"],
  "24": ["조립", "프로그래밍", "시험"],
  "25": ["성형/가공", "조립", "검사"],
  "26": ["가공", "조립", "검사"],
  "27": ["성형/가공", "조립", "검사"],
  "28": ["배합/가공", "성형", "포장"],
  "29": ["가공", "조립", "검사"],
  "30": ["가공", "조립", "시험"],
  "31": ["가공", "조립/용접", "검사"],
  "32": ["가공", "조립", "검사"],
  "33": ["주조/성형", "가공", "표면처리"],
  "34": ["가공", "조립", "적합성검사"],
  "35": ["가공", "조립", "검사"],
  "36": ["가공", "조립", "방사선검사"],
  "37": ["가공", "조립", "검사"],
};

// SW/솔루션은 공장 대신 사무실 허용
const SOFTWARE_INDUSTRY_CODE = "17";

// ---------------------------------------------------------------------------
// 업종별 필요 증빙서류 추가 정보
// ---------------------------------------------------------------------------
const INDUSTRY_EXTRA_DOCUMENTS: Record<string, string[]> = {
  "05": ["의료기기 제조허가(신고)증", "GMP 적합인정서"],
  "11": ["식품제조가공업 영업허가(신고)증", "HACCP 인증서(해당 시)"],
  "12": ["화학물질 관련 인허가 서류"],
  "15": ["소방용품 형식승인서"],
  "17": ["SW사업자 신고확인서"],
  "29": ["방산업체 지정서(해당 시)"],
  "36": ["방사선 관련 인허가 서류"],
};

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------
export interface DiagnosisInput {
  companyName: string;
  bizRegNo?: string;
  productName: string;
  industryCode: string; // 37개 업종 코드

  // 1. 생산공장 (생산장소)
  hasProductionSite: boolean;
  siteType: "factory_registered" | "leased_site" | "shared_site" | "home_office" | "none";
  siteArea?: number; // 면적 (m2)
  siteAddress?: string;

  // 2. 생산시설
  hasMainEquipment: boolean;
  equipmentOwnership: "owned" | "leased" | "shared";
  equipmentList?: string;
  hasMeasuringInstruments: boolean;

  // 3. 생산인력
  totalEmployees: number;
  productionWorkers: number;
  hasTechnicalStaff: boolean; // 기술인력 (기사/산업기사/기능사)
  hasQualityInspector: boolean;

  // 4. 생산공정
  performsCoreProcess: boolean; // 핵심공정 직접 수행 여부
  coreProcessList?: string[]; // 수행하는 핵심공정들
  outsourcedProcesses?: string[]; // 외주 공정
  hasProcessDocumentation: boolean; // 공정도/작업표준서 보유

  // 추가 확인 항목
  hasProductionRecord: boolean; // 생산실적
  hasBizRegistration: boolean; // 사업자등록 (제조업)
  hasQualityCertification: boolean; // 품질인증 (ISO/KS 등)
  isSmallBiz: boolean; // 중소기업 여부 (수수료 감면)
}

export interface RequirementResult {
  category: string;
  name: string;
  passed: boolean;
  score: number;
  maxScore: number;
  details: string;
  advice?: string;
}

export interface DiagnosisResult {
  overallPass: boolean;
  totalScore: number; // 0~100
  grade: "A" | "B" | "C" | "D" | "F";
  requirements: RequirementResult[];
  recommendations: string[];
  requiredDocuments: string[];
  estimatedFee: number; // 예상 수수료
  validityPeriod: string; // "3년 (1회 연장 가능, 최대 6년)"
  confirmationType: "factory_visit" | "document_only"; // 공장확인 vs 서면확인
  industryName: string;
  coreProcesses: string[];
}

// ---------------------------------------------------------------------------
// 등급 산정
// ---------------------------------------------------------------------------
function calcGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

// ---------------------------------------------------------------------------
// 확인유형 판정 (SW/솔루션은 서면확인, 나머지는 공장확인)
// ---------------------------------------------------------------------------
function determineConfirmationType(
  industryCode: string
): "factory_visit" | "document_only" {
  if (industryCode === SOFTWARE_INDUSTRY_CODE) return "document_only";
  return "factory_visit";
}

// ---------------------------------------------------------------------------
// 수수료 계산
// ---------------------------------------------------------------------------
const BASE_FEE = 33000; // 품목당 33,000원
const SME_DISCOUNT_RATE = 0.5; // 중소기업 50% 감면

function calcFee(isSmallBiz: boolean): number {
  return isSmallBiz ? Math.round(BASE_FEE * SME_DISCOUNT_RATE) : BASE_FEE;
}

// ---------------------------------------------------------------------------
// 업종 코드로 핵심공정 조회
// ---------------------------------------------------------------------------
export function getCoreProcesses(industryCode: string): string[] {
  return CORE_PROCESSES[industryCode] || CORE_PROCESSES["37"];
}

// ---------------------------------------------------------------------------
// 업종 코드로 카테고리 정보 조회
// ---------------------------------------------------------------------------
export function getIndustryCategory(
  industryCode: string
): IndustryCategory | undefined {
  return INDUSTRY_CATEGORIES.find((c) => c.code === industryCode);
}

// ---------------------------------------------------------------------------
// 진단 실행
// ---------------------------------------------------------------------------
export function runDiagnosis(input: DiagnosisInput): DiagnosisResult {
  const requirements: RequirementResult[] = [];
  const recommendations: string[] = [];
  const requiredDocuments: string[] = [];

  const isSoftware = input.industryCode === SOFTWARE_INDUSTRY_CODE;
  const industry = getIndustryCategory(input.industryCode);
  const industryName = industry?.name || "기타";
  const coreProcesses = getCoreProcesses(input.industryCode);

  // 업종별 추가 서류
  const extraDocs = INDUSTRY_EXTRA_DOCUMENTS[input.industryCode];

  // =========================================================================
  // 1. 생산공장 (생산장소) - 25점
  // =========================================================================
  let siteScore = 0;
  const siteMax = 25;
  let siteDetails = "";
  let siteAdvice: string | undefined;

  if (!input.hasProductionSite || input.siteType === "none") {
    // 생산장소 없음
    siteScore = 0;
    siteDetails = "생산장소가 없습니다.";
    siteAdvice = isSoftware
      ? "SW/솔루션 업종도 최소 개발 사무실(사업장)이 필요합니다. 사업장을 확보하세요."
      : "직접생산확인을 위해 독립된 생산장소(공장/작업장)가 필수입니다.";
    recommendations.push(
      "[필수] 생산장소(공장/작업장)를 확보하세요."
    );
  } else {
    switch (input.siteType) {
      case "factory_registered":
        siteScore = 25;
        siteDetails = "공장등록된 생산장소를 보유하고 있습니다.";
        requiredDocuments.push("공장등록증명서");
        break;
      case "leased_site":
        siteScore = 20;
        siteDetails =
          "임차 생산장소를 보유하고 있습니다. (공장등록 대비 감점)";
        siteAdvice =
          "임대차계약서(잔여기간 1년 이상)를 준비하세요. 공장등록을 하면 만점이 가능합니다.";
        requiredDocuments.push("생산장소 임대차계약서 (잔여기간 1년 이상 권장)");
        recommendations.push(
          "임차 생산장소를 공장등록하면 생산공장 항목 만점이 가능합니다."
        );
        break;
      case "shared_site":
        siteScore = 14;
        siteDetails =
          "공유/공동 생산장소를 사용 중입니다. (독립 장소 대비 감점)";
        siteAdvice =
          "공유 공간은 독립 생산장소에 비해 불리합니다. 별도 장소를 확보하면 점수가 올라갑니다.";
        requiredDocuments.push("공유 공간 이용계약서");
        recommendations.push(
          "독립된 생산장소를 확보하면 생산공장 항목 점수를 크게 올릴 수 있습니다."
        );
        break;
      case "home_office":
        if (isSoftware) {
          // SW/솔루션은 사무실 허용
          siteScore = 22;
          siteDetails =
            "SW/솔루션 업종으로 사무실(홈오피스)을 생산장소로 인정합니다.";
          siteAdvice =
            "별도 사업장(사무실)을 임차하면 만점에 가까운 점수를 받을 수 있습니다.";
          requiredDocuments.push("사업장 주소 확인 서류");
        } else {
          siteScore = 8;
          siteDetails =
            "홈오피스는 제조업 생산장소로 부적합합니다. (대폭 감점)";
          siteAdvice =
            "제조업은 독립된 공장/작업장이 필요합니다. 생산시설을 갖춘 별도 장소를 확보하세요.";
          recommendations.push(
            "[필수] 제조업 물품은 독립된 공장/작업장이 필요합니다. 홈오피스로는 확인이 어렵습니다."
          );
        }
        break;
    }

    // 면적 보너스/감점 (공장등록/임차 한정)
    if (
      input.siteArea !== undefined &&
      input.siteType !== "home_office"
    ) {
      if (input.siteArea < 30) {
        siteScore = Math.max(0, siteScore - 3);
        siteDetails += ` 면적(${input.siteArea}m2)이 협소하여 추가 감점됩니다.`;
        recommendations.push(
          "생산장소 면적이 30m2 미만으로 협소합니다. 실사 시 불리할 수 있습니다."
        );
      }
    }
  }

  // 점수 범위 보정
  siteScore = Math.max(0, Math.min(siteMax, siteScore));

  requirements.push({
    category: "생산공장",
    name: "생산장소 보유 및 적정성",
    passed: siteScore >= 14,
    score: siteScore,
    maxScore: siteMax,
    details: siteDetails,
    advice: siteAdvice,
  });

  // =========================================================================
  // 2. 생산시설 - 25점
  // =========================================================================
  let facilityScore = 0;
  const facilityMax = 25;
  let facilityDetails = "";
  let facilityAdvice: string | undefined;

  // 주요 설비 보유 (18점)
  if (input.hasMainEquipment) {
    switch (input.equipmentOwnership) {
      case "owned":
        facilityScore += 18;
        facilityDetails = "자체 보유 생산설비가 있습니다.";
        requiredDocuments.push(
          "생산설비 목록표 (설비명, 규격, 수량, 취득일)"
        );
        break;
      case "leased":
        facilityScore += 14;
        facilityDetails = "임차 생산설비를 사용 중입니다. (자체 보유 대비 감점)";
        facilityAdvice =
          "주요 설비를 자체 보유하면 점수가 올라갑니다. 임대차 계약서를 준비하세요.";
        requiredDocuments.push("설비 임대차계약서");
        requiredDocuments.push(
          "생산설비 목록표 (설비명, 규격, 수량, 임차일)"
        );
        recommendations.push(
          "핵심 생산설비를 자체 보유(매입)하면 생산시설 점수가 올라갑니다."
        );
        break;
      case "shared":
        facilityScore += 10;
        facilityDetails = "공용/공유 설비를 사용 중입니다. (대폭 감점)";
        facilityAdvice =
          "공유 설비는 직접생산 입증에 불리합니다. 자체 설비를 확보하세요.";
        requiredDocuments.push("설비 공동이용 계약서");
        recommendations.push(
          "[중요] 핵심공정 설비를 자체 보유해야 직접생산으로 인정받기 유리합니다."
        );
        break;
    }
  } else {
    facilityScore += 0;
    facilityDetails = "주요 생산설비가 없습니다.";
    facilityAdvice = isSoftware
      ? "개발 장비(컴퓨터, 서버 등)를 보유하고 있어야 합니다."
      : "핵심공정 수행에 필요한 생산설비를 반드시 확보하세요.";
    recommendations.push(
      "[필수] 납품 물품의 핵심공정에 필요한 생산설비를 확보하세요."
    );
  }

  // 계측/검사 장비 보유 (7점)
  if (input.hasMeasuringInstruments) {
    facilityScore += 7;
    facilityDetails += " 계측/검사 장비를 보유하고 있습니다.";
    requiredDocuments.push(
      "계측/검사 장비 목록 (장비명, 규격, 교정일)"
    );
  } else {
    facilityDetails += " 계측/검사 장비가 없습니다.";
    if (!facilityAdvice) {
      facilityAdvice =
        "품질 검증을 위한 계측/검사 장비를 확보하면 점수를 올릴 수 있습니다.";
    }
    recommendations.push(
      "계측/검사 장비를 확보하면 생산시설 점수를 올릴 수 있습니다."
    );
  }

  facilityScore = Math.max(0, Math.min(facilityMax, facilityScore));

  requirements.push({
    category: "생산시설",
    name: "핵심공정 수행 설비 보유",
    passed: facilityScore >= 14,
    score: facilityScore,
    maxScore: facilityMax,
    details: facilityDetails,
    advice: facilityAdvice,
  });

  // =========================================================================
  // 3. 생산인력 - 25점
  // =========================================================================
  let hrScore = 0;
  const hrMax = 25;
  let hrDetails = "";
  let hrAdvice: string | undefined;

  // 총 종업원 수 (7점)
  if (input.totalEmployees >= 10) {
    hrScore += 7;
    hrDetails = `총 종업원 ${input.totalEmployees}명 (충분).`;
  } else if (input.totalEmployees >= 5) {
    hrScore += 5;
    hrDetails = `총 종업원 ${input.totalEmployees}명 (양호).`;
  } else if (input.totalEmployees >= 1) {
    hrScore += 3;
    hrDetails = `총 종업원 ${input.totalEmployees}명 (최소).`;
    recommendations.push(
      "종업원 수가 적으면 생산능력 입증이 어려울 수 있습니다. 인력 보강을 권장합니다."
    );
  } else {
    hrScore += 0;
    hrDetails = "종업원이 0명입니다.";
    hrAdvice = "최소 1인 이상의 종업원이 있어야 합니다.";
    recommendations.push("[필수] 최소 1인 이상의 인력을 확보하세요.");
  }

  // 생산직 근로자 (8점)
  if (input.productionWorkers >= 5) {
    hrScore += 8;
    hrDetails += ` 생산직 ${input.productionWorkers}명 (충분).`;
  } else if (input.productionWorkers >= 3) {
    hrScore += 6;
    hrDetails += ` 생산직 ${input.productionWorkers}명 (양호).`;
  } else if (input.productionWorkers >= 1) {
    hrScore += 3;
    hrDetails += ` 생산직 ${input.productionWorkers}명 (최소).`;
    recommendations.push(
      "생산직 근로자를 3인 이상으로 확보하면 인력 점수가 올라갑니다."
    );
  } else {
    hrScore += 0;
    hrDetails += " 생산직 근로자가 없습니다.";
    if (!hrAdvice) {
      hrAdvice =
        "직접생산을 위해 최소 1인 이상의 생산직 근로자가 필요합니다.";
    }
    recommendations.push(
      "[필수] 생산직 근로자를 최소 1인 이상 확보하세요."
    );
  }

  // 기술인력 (5점)
  if (input.hasTechnicalStaff) {
    hrScore += 5;
    hrDetails += " 기술인력(기사/산업기사/기능사) 보유.";
    requiredDocuments.push(
      "기술자격증 사본 (기사, 산업기사, 기능사 등)"
    );
  } else {
    hrDetails += " 기술인력 미보유.";
    recommendations.push(
      "관련 기술자격(기사/산업기사) 보유 인력을 확보하면 인력 점수가 올라갑니다."
    );
  }

  // 품질검사 인력 (5점)
  if (input.hasQualityInspector) {
    hrScore += 5;
    hrDetails += " 품질검사 전담인력 보유.";
  } else {
    hrDetails += " 품질검사 전담인력 미지정.";
    recommendations.push(
      "품질검사 전담(또는 겸직) 인력을 지정하면 인력 점수를 올릴 수 있습니다."
    );
  }

  hrScore = Math.max(0, Math.min(hrMax, hrScore));

  requirements.push({
    category: "생산인력",
    name: "생산 투입 인력 적정성",
    passed: hrScore >= 14,
    score: hrScore,
    maxScore: hrMax,
    details: hrDetails,
    advice: hrAdvice,
  });

  // =========================================================================
  // 4. 생산공정 - 25점 (가장 중요)
  // =========================================================================
  let processScore = 0;
  const processMax = 25;
  let processDetails = "";
  let processAdvice: string | undefined;

  const industryCoreProcesses = getCoreProcesses(input.industryCode);
  const totalCoreCount = industryCoreProcesses.length;

  // 핵심공정 직접 수행 여부 (15점) - 가장 핵심
  if (input.performsCoreProcess) {
    // 수행하는 핵심공정 개수에 따라 점수
    const performedCount = input.coreProcessList?.length || 0;
    if (performedCount >= totalCoreCount) {
      processScore += 15;
      processDetails = `핵심공정(${industryCoreProcesses.join(", ")})을 모두 직접 수행합니다.`;
    } else if (performedCount >= Math.ceil(totalCoreCount / 2)) {
      processScore += 12;
      processDetails = `핵심공정 중 ${performedCount}/${totalCoreCount}개를 직접 수행합니다.`;
      processAdvice = `나머지 핵심공정도 직접 수행하면 만점에 가까워집니다.`;
    } else if (performedCount >= 1) {
      processScore += 8;
      processDetails = `핵심공정 중 ${performedCount}/${totalCoreCount}개만 직접 수행합니다. (부족)`;
      processAdvice = `핵심공정의 과반 이상을 직접 수행해야 확인을 받기 유리합니다.`;
      recommendations.push(
        `[중요] 핵심공정(${industryCoreProcesses.join(", ")}) 중 더 많은 공정을 직접 수행하세요.`
      );
    } else {
      // performsCoreProcess = true 이지만 목록이 비어있는 경우
      processScore += 10;
      processDetails = "핵심공정을 직접 수행한다고 답하였으나 구체적 공정이 미지정입니다.";
      processAdvice = "구체적으로 어떤 핵심공정을 수행하는지 명시하세요.";
    }
  } else {
    // 핵심공정을 직접 수행하지 않음 → 치명적 감점
    processScore += 0;
    processDetails =
      "핵심공정을 직접 수행하지 않습니다. (치명적 감점: 확인 불가 사유)";
    processAdvice = `직접생산확인의 핵심은 '핵심공정의 직접 수행'입니다. ${industryName} 업종의 핵심공정(${industryCoreProcesses.join(", ")})을 반드시 직접 수행해야 합니다.`;
    recommendations.push(
      `[필수] 핵심공정(${industryCoreProcesses.join(", ")})을 직접 수행해야 직접생산확인을 받을 수 있습니다. 현재 상태로는 확인이 불가합니다.`
    );
  }

  // 외주공정 감점
  const outsourcedCount = input.outsourcedProcesses?.length || 0;
  if (outsourcedCount > 0) {
    // 외주 비율에 따른 감점
    const outsourceRatio =
      totalCoreCount > 0 ? outsourcedCount / totalCoreCount : 0;
    if (outsourceRatio >= 0.5) {
      processScore = Math.max(0, processScore - 5);
      processDetails += ` 핵심공정의 절반 이상(${outsourcedCount}개)을 외주하고 있어 추가 감점됩니다.`;
      recommendations.push(
        "[중요] 핵심공정의 외주 비율이 높습니다. 핵심공정은 직접 수행해야 합니다."
      );
    } else if (outsourcedCount >= 1) {
      processScore = Math.max(0, processScore - 2);
      processDetails += ` 일부 공정(${outsourcedCount}개)을 외주하고 있습니다. (소폭 감점)`;
    }
  }

  // 공정 문서화 (5점)
  if (input.hasProcessDocumentation) {
    processScore += 5;
    processDetails += " 공정도/작업표준서를 보유하고 있습니다.";
    requiredDocuments.push("제조공정도 (핵심공정 포함)");
    requiredDocuments.push("작업표준서/작업지도서");
  } else {
    processDetails += " 공정도/작업표준서가 없습니다.";
    recommendations.push(
      "제조공정도와 작업표준서를 작성하면 공정 항목 점수를 올릴 수 있습니다."
    );
  }

  // 생산실적 가점 (5점)
  if (input.hasProductionRecord) {
    processScore += 5;
    processDetails += " 생산/납품 실적이 있습니다.";
    requiredDocuments.push(
      "생산실적 증빙 (세금계산서, 거래명세서 등)"
    );
  } else {
    processDetails += " 생산/납품 실적이 없습니다.";
    recommendations.push(
      "해당 물품(또는 유사 물품)의 생산/납품 실적을 확보하면 공정 점수가 올라갑니다."
    );
  }

  processScore = Math.max(0, Math.min(processMax, processScore));

  requirements.push({
    category: "생산공정",
    name: "핵심공정 직접 수행 및 문서화",
    passed: processScore >= 14,
    score: processScore,
    maxScore: processMax,
    details: processDetails,
    advice: processAdvice,
  });

  // =========================================================================
  // 추가 서류/인증 (점수 외 가감점 요소 → 권고사항으로만)
  // =========================================================================
  if (input.hasBizRegistration) {
    if (isSoftware) {
      requiredDocuments.push("사업자등록증 사본 (업종: 소프트웨어 개발 등)");
    } else {
      requiredDocuments.push("사업자등록증 사본 (업종: 제조업 포함)");
    }
  } else {
    if (isSoftware) {
      recommendations.push(
        "[필수] 사업자등록증에 SW 관련 업종이 포함되어야 합니다."
      );
    } else {
      recommendations.push(
        '[필수] 사업자등록증의 업종에 "제조업"이 포함되어야 합니다.'
      );
    }
  }

  if (input.hasQualityCertification) {
    requiredDocuments.push("품질인증서 (ISO 9001, KS 인증 등) 사본");
  } else {
    recommendations.push(
      "ISO 9001 등 품질인증을 취득하면 실사 시 유리합니다."
    );
  }

  // =========================================================================
  // 기본 서류 항상 추가
  // =========================================================================
  const baseDocuments = [
    "중소기업확인서 (중소벤처기업부 발급)",
    "법인등기부등본 (법인) 또는 사업자등록증 사본",
    "직접생산확인증명 신청서 (중소벤처기업부 양식)",
    "직접생산 물품 설명서 (제조공정도 포함)",
    "4대 사회보험 가입자명부 (사업장 단위)",
    "부가가치세 과세표준증명원 (최근 1년)",
  ];

  // 업종별 추가 서류
  if (extraDocs) {
    extraDocs.forEach((doc) => requiredDocuments.push(doc));
  }

  // 중복 제거
  const allDocs = Array.from(
    new Set([...baseDocuments, ...requiredDocuments])
  );

  // =========================================================================
  // 총점 계산
  // =========================================================================
  const totalScore = requirements.reduce((sum, r) => sum + r.score, 0);
  const overallPass = totalScore >= 70;
  const grade = calcGrade(totalScore);

  // 종합 권고
  if (overallPass) {
    recommendations.unshift(
      `총점 ${totalScore}점으로 직접생산확인 신청 기준(70점)을 충족합니다. 서류를 갖추어 중소벤처기업부(smpp.go.kr)에 신청하세요.`
    );
  } else {
    recommendations.unshift(
      `총점 ${totalScore}점으로 기준 미달(70점 이상 필요)입니다. 아래 개선사항을 보완한 뒤 신청하세요.`
    );
  }

  // 핵심공정 미수행 시 추가 경고
  if (!input.performsCoreProcess) {
    recommendations.splice(
      1,
      0,
      `[경고] 핵심공정 미수행은 직접생산확인 거부의 가장 큰 사유입니다. 점수와 관계없이 핵심공정 직접 수행이 전제되어야 합니다.`
    );
  }

  return {
    overallPass,
    totalScore,
    grade,
    requirements,
    recommendations,
    requiredDocuments: allDocs,
    estimatedFee: calcFee(input.isSmallBiz),
    validityPeriod: "3년 (1회 연장 가능, 최대 6년)",
    confirmationType: determineConfirmationType(input.industryCode),
    industryName,
    coreProcesses,
  };
}
