/**
 * =============================================================================
 * 정부24 딥링크 시스템
 * =============================================================================
 * 각 민원별 직접 신청 URL을 관리
 * 사용자를 '신청하기 직전 페이지'로 정확히 착륙시킴
 */

export interface Gov24Service {
  code: string;           // 민원 코드
  name: string;           // 민원명
  category: string;       // 카테고리
  applyUrl: string;       // 직접 신청 URL
  infoUrl?: string;       // 안내 페이지 URL
  requiredDocs: string[]; // 필요 서류
  processingDays: string; // 처리 기간
  fee: string;            // 수수료
  tips?: string[];        // 신청 팁
}

// 정부24 민원 딥링크 DB
export const GOV24_SERVICES: Record<string, Gov24Service> = {
  // ============= 사업자/영업 =============
  "통신판매업신고": {
    code: "MINWON_000001",
    name: "통신판매업 신고",
    category: "사업자/영업",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000181",
    requiredDocs: ["사업자등록증 사본", "통신판매업 신고서"],
    processingDays: "즉시",
    fee: "무료",
    tips: [
      "사업자등록증이 먼저 발급되어 있어야 합니다",
      "구매안전서비스 가입 후 신고하면 더 신뢰도가 높아집니다"
    ]
  },

  "식품제조업영업신고": {
    code: "MINWON_000002",
    name: "식품제조·가공업 영업신고",
    category: "사업자/영업",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000055",
    requiredDocs: ["영업신고서", "사업자등록증", "위생교육이수증", "시설평면도"],
    processingDays: "3일",
    fee: "무료",
    tips: [
      "위생교육을 먼저 이수해야 합니다 (한국식품산업협회)",
      "시설 요건을 미리 확인하세요"
    ]
  },

  "일반음식점영업신고": {
    code: "MINWON_000003",
    name: "일반음식점 영업신고",
    category: "사업자/영업",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000055",
    requiredDocs: ["영업신고서", "위생교육이수증", "시설평면도"],
    processingDays: "즉시",
    fee: "무료",
    tips: [
      "건축물대장상 용도가 '음식점'이어야 합니다",
      "소방시설완비증명원이 필요할 수 있습니다"
    ]
  },

  // ============= 부동산/건축 =============
  "건축물대장발급": {
    code: "MINWON_000010",
    name: "건축물대장 발급",
    category: "부동산",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
    tips: [
      "열람용과 발급용 중 선택하세요",
      "건축물 소재지 정확히 입력"
    ]
  },

  "토지대장발급": {
    code: "MINWON_000011",
    name: "토지대장 발급",
    category: "부동산",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000026",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "토지이용계획확인서": {
    code: "MINWON_000012",
    name: "토지이용계획확인서 발급",
    category: "부동산",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000013",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  // ============= 사업자등록/세무 =============
  "사업자등록증명발급": {
    code: "MINWON_000020",
    name: "사업자등록증명 발급",
    category: "세무",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000016",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "휴폐업사실증명발급": {
    code: "MINWON_000021",
    name: "휴폐업사실증명 발급",
    category: "세무",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000019",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  // ============= 가족/신분 =============
  "주민등록등본발급": {
    code: "MINWON_000030",
    name: "주민등록등본 발급",
    category: "가족관계",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "주민등록초본발급": {
    code: "MINWON_000031",
    name: "주민등록초본 발급",
    category: "가족관계",
    applyUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015",
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  // ============= 인허가 =============
  "건설업등록": {
    code: "MINWON_000040",
    name: "건설업 등록",
    category: "인허가",
    applyUrl: "https://www.kiscon.net",
    requiredDocs: ["건설업등록신청서", "기술자보유현황", "자본금확인서류", "사무실임대차계약서"],
    processingDays: "14일",
    fee: "등록면허세",
    tips: [
      "KISCON에서 온라인 신청",
      "업종별 기술자 요건 확인 필수"
    ]
  },

  "소방시설업등록": {
    code: "MINWON_000041",
    name: "소방시설업 등록",
    category: "인허가",
    applyUrl: "https://www.fipa.or.kr",
    requiredDocs: ["등록신청서", "기술인력보유현황", "장비보유현황"],
    processingDays: "14일",
    fee: "등록면허세",
  },
};

/**
 * 민원명으로 서비스 검색
 */
export function findGov24Service(keyword: string): Gov24Service | null {
  const normalizedKeyword = keyword.replace(/\s/g, "").toLowerCase();

  for (const [key, service] of Object.entries(GOV24_SERVICES)) {
    const normalizedKey = key.replace(/\s/g, "").toLowerCase();
    const normalizedName = service.name.replace(/\s/g, "").toLowerCase();

    if (normalizedKey.includes(normalizedKeyword) ||
        normalizedName.includes(normalizedKeyword) ||
        normalizedKeyword.includes(normalizedKey) ||
        normalizedKeyword.includes(normalizedName)) {
      return service;
    }
  }

  return null;
}

/**
 * 카테고리별 서비스 목록 조회
 */
export function getServicesByCategory(category: string): Gov24Service[] {
  return Object.values(GOV24_SERVICES).filter(s => s.category === category);
}

/**
 * 모든 카테고리 목록
 */
export function getAllCategories(): string[] {
  const categories = new Set(Object.values(GOV24_SERVICES).map(s => s.category));
  return Array.from(categories);
}
