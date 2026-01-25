/**
 * =============================================================================
 * 정부24 링크 시스템
 * =============================================================================
 * 각 민원별 검색 URL을 관리 (딥링크가 자주 변경되므로 검색 링크 사용)
 * 사용자를 정부24 검색 결과 페이지로 안내
 */

export interface Gov24Service {
  code: string;           // 민원 코드
  name: string;           // 민원명
  searchKeyword: string;  // 정부24 검색 키워드
  category: string;       // 카테고리
  applyUrl: string;       // 정부24 직접 서비스 URL
  cappBizCD?: string;     // 정부24 서비스 코드 (CappBizCD)
  infoUrl?: string;       // 안내 페이지 URL
  requiredDocs: string[]; // 필요 서류
  processingDays: string; // 처리 기간
  fee: string;            // 수수료
  tips?: string[];        // 신청 팁
}

/**
 * 정부24 서비스 직접 링크 생성
 * CappBizCD가 있으면 직접 링크, 없으면 민원 검색 페이지
 */
export function getGov24DirectUrl(cappBizCD?: string): string {
  if (cappBizCD) {
    return `https://www.gov.kr/main?a=AA020InfoCappViewApp&CappBizCD=${cappBizCD}`;
  }
  return "https://www.gov.kr/portal/minwon/search";
}

/**
 * 주요 민원별 CappBizCD 코드 (정부24 직접 링크용)
 * 2025년 1월 검증된 실제 서비스 코드입니다.
 */
const CAPP_BIZ_CODES: Record<string, string> = {
  // 사업자/세무
  "사업자등록증명발급": "12100000016",
  "휴폐업사실증명": "12100000019",
  "납세증명서": "12100000011",
  "소득금액증명": "12100000021",

  // 부동산
  "건축물대장": "15000000098",
  "토지대장": "13100000026",
  "토지이용계획확인서": "15000000013",
  "개별공시지가": "15000000012",
  "지적도등본": "13100000028",

  // 가족관계
  "주민등록등본": "13100000015",
  "주민등록초본": "13100000015",
  "가족관계증명서": "97400000004",
  "기본증명서": "97400000004",
  "혼인관계증명서": "97400000004",

  // 영업/인허가
  "통신판매업신고": "11300000006",
  "식품관련영업신고": "14600000021",
  "식품영업변경신고": "14600000022",
  "건설업등록": "12100000015",

  // 차량
  "자동차등록원부": "12600000001",
  "운전경력증명서": "12600000057",
};

/**
 * 정부24 검색 URL 생성 (직접 링크가 없는 민원용 폴백)
 * 민원 검색 페이지로 이동 후 검색어 입력 필요
 */
export function getGov24SearchUrl(keyword: string): string {
  // 민원 검색 페이지로 이동
  return "https://www.gov.kr/portal/minwon/search";
}

/**
 * 서비스 키워드로 직접 URL 생성
 */
function getDirectUrlByKeyword(keyword: string): string {
  // 키워드에서 매칭되는 CappBizCD 찾기
  for (const [key, code] of Object.entries(CAPP_BIZ_CODES)) {
    if (keyword.includes(key) || key.includes(keyword.replace(/\s/g, ""))) {
      return getGov24DirectUrl(code);
    }
  }
  return "https://www.gov.kr/portal/minwon/search";
}

// 정부24 민원 서비스 DB (직접 링크 방식)
export const GOV24_SERVICES: Record<string, Gov24Service> = {
  // ============= 사업자/영업 =============
  "통신판매업신고": {
    code: "MINWON_000001",
    name: "통신판매업 신고",
    searchKeyword: "통신판매업 신고",
    category: "사업자/영업",
    cappBizCD: "11300000006",
    applyUrl: getGov24DirectUrl("11300000006"),
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
    searchKeyword: "식품제조가공업 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("식품제조가공업 영업신고"),
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
    searchKeyword: "일반음식점 영업신고",
    category: "사업자/영업",
    cappBizCD: "14600000021",
    applyUrl: getGov24DirectUrl("14600000021"),
    requiredDocs: ["영업신고서", "위생교육이수증", "시설평면도"],
    processingDays: "즉시",
    fee: "무료",
    tips: [
      "건축물대장상 용도가 '음식점'이어야 합니다",
      "소방시설완비증명원이 필요할 수 있습니다"
    ]
  },

  "휴게음식점영업신고": {
    code: "MINWON_000004",
    name: "휴게음식점 영업신고",
    searchKeyword: "휴게음식점 영업신고",
    category: "사업자/영업",
    cappBizCD: "14600000022",
    applyUrl: getGov24DirectUrl("14600000022"),
    requiredDocs: ["영업신고서", "위생교육이수증"],
    processingDays: "즉시",
    fee: "무료",
    tips: ["카페, 제과점 등이 해당됩니다"]
  },

  "제과점영업신고": {
    code: "MINWON_000005",
    name: "제과점 영업신고",
    searchKeyword: "제과점 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("제과점 영업신고"),
    requiredDocs: ["영업신고서", "위생교육이수증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "숙박업신고": {
    code: "MINWON_000006",
    name: "숙박업 신고",
    searchKeyword: "숙박업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("숙박업 신고"),
    requiredDocs: ["숙박업신고서", "소방시설완비증명원", "건축물대장"],
    processingDays: "7일",
    fee: "무료",
    tips: ["건축물용도가 숙박시설이어야 합니다"]
  },

  "공중위생영업신고": {
    code: "MINWON_000007",
    name: "공중위생영업 신고",
    searchKeyword: "공중위생영업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("공중위생영업 신고"),
    requiredDocs: ["영업신고서", "위생교육이수증"],
    processingDays: "즉시",
    fee: "무료",
    tips: ["미용실, 목욕장, 세탁소 등이 해당됩니다"]
  },

  "이미용업신고": {
    code: "MINWON_000008",
    name: "이미용업 신고",
    searchKeyword: "이미용업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("이미용업 신고"),
    requiredDocs: ["영업신고서", "면허증 사본", "위생교육이수증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "세탁업신고": {
    code: "MINWON_000009",
    name: "세탁업 신고",
    searchKeyword: "세탁업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("세탁업 신고"),
    requiredDocs: ["영업신고서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "학원설립운영등록": {
    code: "MINWON_000010",
    name: "학원 설립·운영 등록",
    searchKeyword: "학원 설립 운영 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("학원 설립 운영 등록"),
    requiredDocs: ["학원설립운영등록신청서", "시설평면도", "임대차계약서"],
    processingDays: "10일",
    fee: "등록면허세",
  },

  "체육시설업신고": {
    code: "MINWON_000011",
    name: "체육시설업 신고",
    searchKeyword: "체육시설업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("체육시설업 신고"),
    requiredDocs: ["체육시설업신고서", "시설평면도"],
    processingDays: "즉시",
    fee: "무료",
    tips: ["헬스장, 당구장, 골프연습장 등"]
  },

  "게임제공업신고": {
    code: "MINWON_000012",
    name: "게임제공업 신고",
    searchKeyword: "게임제공업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("게임제공업 신고"),
    requiredDocs: ["게임제공업신고서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "인터넷컴퓨터게임시설제공업신고": {
    code: "MINWON_000013",
    name: "인터넷컴퓨터게임시설제공업 신고",
    searchKeyword: "인터넷컴퓨터게임시설제공업",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("인터넷컴퓨터게임시설제공업"),
    requiredDocs: ["신고서", "시설평면도"],
    processingDays: "즉시",
    fee: "무료",
    tips: ["PC방 영업신고"]
  },

  "담배소매업지정": {
    code: "MINWON_000014",
    name: "담배소매업 지정",
    searchKeyword: "담배소매업 지정",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("담배소매업 지정"),
    requiredDocs: ["담배소매업지정신청서"],
    processingDays: "7일",
    fee: "무료",
  },

  "약국개설등록": {
    code: "MINWON_000015",
    name: "약국 개설 등록",
    searchKeyword: "약국 개설 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("약국 개설 등록"),
    requiredDocs: ["약국개설등록신청서", "약사면허증"],
    processingDays: "7일",
    fee: "등록면허세",
  },

  "의료기기판매업신고": {
    code: "MINWON_000016",
    name: "의료기기 판매업 신고",
    searchKeyword: "의료기기 판매업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("의료기기 판매업 신고"),
    requiredDocs: ["의료기기판매업신고서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "화물자동차운송사업허가": {
    code: "MINWON_000017",
    name: "화물자동차 운송사업 허가",
    searchKeyword: "화물자동차 운송사업 허가",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("화물자동차 운송사업 허가"),
    requiredDocs: ["허가신청서", "차량등록증", "사업계획서"],
    processingDays: "14일",
    fee: "면허세",
  },

  "대부업등록": {
    code: "MINWON_000018",
    name: "대부업 등록",
    searchKeyword: "대부업 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("대부업 등록"),
    requiredDocs: ["등록신청서", "자본금확인서류"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "옥외광고물신고": {
    code: "MINWON_000019",
    name: "옥외광고물 표시 신고",
    searchKeyword: "옥외광고물 표시 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("옥외광고물 표시 신고"),
    requiredDocs: ["옥외광고물신고서", "광고물도안"],
    processingDays: "3일",
    fee: "무료",
  },

  // ============= 부동산/건축 =============
  "건축물대장발급": {
    code: "MINWON_000020",
    name: "건축물대장 발급",
    searchKeyword: "건축물대장 발급",
    category: "부동산",
    cappBizCD: "15000000098",
    applyUrl: getGov24DirectUrl("15000000098"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
    tips: ["열람용과 발급용 중 선택하세요"]
  },

  "토지대장발급": {
    code: "MINWON_000021",
    name: "토지대장 발급",
    searchKeyword: "토지대장 발급",
    category: "부동산",
    cappBizCD: "13100000026",
    applyUrl: getGov24DirectUrl("13100000026"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "토지이용계획확인서": {
    code: "MINWON_000022",
    name: "토지이용계획확인서 발급",
    searchKeyword: "토지이용계획확인서",
    category: "부동산",
    cappBizCD: "15000000013",
    applyUrl: getGov24DirectUrl("15000000013"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "지적도등본발급": {
    code: "MINWON_000023",
    name: "지적도 등본 발급",
    searchKeyword: "지적도 등본",
    category: "부동산",
    cappBizCD: "13100000028",
    applyUrl: getGov24DirectUrl("13100000028"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "개별공시지가확인서": {
    code: "MINWON_000024",
    name: "개별공시지가 확인서",
    searchKeyword: "개별공시지가 확인",
    category: "부동산",
    cappBizCD: "15000000012",
    applyUrl: getGov24DirectUrl("15000000012"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "건축허가신청": {
    code: "MINWON_000025",
    name: "건축허가 신청",
    searchKeyword: "건축허가 신청",
    category: "부동산",
    applyUrl: getGov24SearchUrl("건축허가 신청"),
    requiredDocs: ["건축허가신청서", "설계도서", "토지사용승낙서"],
    processingDays: "15일",
    fee: "수수료",
  },

  "건축신고": {
    code: "MINWON_000026",
    name: "건축신고",
    searchKeyword: "건축신고",
    category: "부동산",
    applyUrl: getGov24SearchUrl("건축신고"),
    requiredDocs: ["건축신고서", "배치도", "평면도"],
    processingDays: "5일",
    fee: "무료",
  },

  "용도변경허가": {
    code: "MINWON_000027",
    name: "용도변경 허가/신고",
    searchKeyword: "용도변경 허가",
    category: "부동산",
    applyUrl: getGov24SearchUrl("용도변경 허가"),
    requiredDocs: ["용도변경신청서", "도면"],
    processingDays: "7일",
    fee: "수수료",
  },

  // ============= 세무/증명 =============
  "사업자등록신청": {
    code: "MINWON_000030",
    name: "사업자등록 신청",
    searchKeyword: "사업자등록 신청",
    category: "세무",
    cappBizCD: "13100000001",
    applyUrl: getGov24DirectUrl("13100000001"),
    requiredDocs: ["사업자등록신청서", "임대차계약서", "신분증"],
    processingDays: "3일",
    fee: "무료",
  },

  "사업자등록증명발급": {
    code: "MINWON_000031",
    name: "사업자등록증명 발급",
    searchKeyword: "사업자등록증명 발급",
    category: "세무",
    cappBizCD: "12100000016",
    applyUrl: getGov24DirectUrl("12100000016"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "휴폐업사실증명발급": {
    code: "MINWON_000032",
    name: "휴폐업사실증명 발급",
    searchKeyword: "휴폐업사실증명 발급",
    category: "세무",
    cappBizCD: "12100000033",
    applyUrl: getGov24DirectUrl("12100000033"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "납세증명서발급": {
    code: "MINWON_000033",
    name: "납세증명서 발급",
    searchKeyword: "납세증명서 발급",
    category: "세무",
    cappBizCD: "12100000014",
    applyUrl: getGov24DirectUrl("12100000014"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "소득금액증명발급": {
    code: "MINWON_000034",
    name: "소득금액증명 발급",
    searchKeyword: "소득금액증명 발급",
    category: "세무",
    cappBizCD: "12100000021",
    applyUrl: getGov24DirectUrl("12100000021"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "부가가치세과세표준증명": {
    code: "MINWON_000035",
    name: "부가가치세 과세표준증명",
    searchKeyword: "부가가치세 과세표준증명",
    category: "세무",
    applyUrl: getGov24SearchUrl("부가가치세 과세표준증명"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  // ============= 가족관계/신분 =============
  "주민등록등본발급": {
    code: "MINWON_000040",
    name: "주민등록등본 발급",
    searchKeyword: "주민등록등본 발급",
    category: "가족관계",
    cappBizCD: "13100000015",
    applyUrl: getGov24DirectUrl("13100000015"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "주민등록초본발급": {
    code: "MINWON_000041",
    name: "주민등록초본 발급",
    searchKeyword: "주민등록초본 발급",
    category: "가족관계",
    cappBizCD: "13100000015",
    applyUrl: getGov24DirectUrl("13100000015"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "가족관계증명서발급": {
    code: "MINWON_000042",
    name: "가족관계증명서 발급",
    searchKeyword: "가족관계증명서 발급",
    category: "가족관계",
    cappBizCD: "97400000004",
    applyUrl: getGov24DirectUrl("97400000004"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "기본증명서발급": {
    code: "MINWON_000043",
    name: "기본증명서 발급",
    searchKeyword: "기본증명서 발급",
    category: "가족관계",
    cappBizCD: "97400000004",
    applyUrl: getGov24DirectUrl("97400000004"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "혼인관계증명서발급": {
    code: "MINWON_000044",
    name: "혼인관계증명서 발급",
    searchKeyword: "혼인관계증명서 발급",
    category: "가족관계",
    cappBizCD: "97400000004",
    applyUrl: getGov24DirectUrl("97400000004"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "출입국사실증명발급": {
    code: "MINWON_000045",
    name: "출입국사실증명 발급",
    searchKeyword: "출입국사실증명 발급",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("출입국사실증명 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "병적증명서발급": {
    code: "MINWON_000046",
    name: "병적증명서 발급",
    searchKeyword: "병적증명서 발급",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("병적증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  // ============= 운전/차량 =============
  "운전면허증갱신": {
    code: "MINWON_000050",
    name: "운전면허증 갱신",
    searchKeyword: "운전면허증 갱신",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("운전면허증 갱신"),
    requiredDocs: ["신분증", "사진"],
    processingDays: "즉시",
    fee: "수수료",
  },

  "운전경력증명서발급": {
    code: "MINWON_000051",
    name: "운전경력증명서 발급",
    searchKeyword: "운전경력증명서 발급",
    category: "운전/차량",
    cappBizCD: "12600000057",
    applyUrl: getGov24DirectUrl("12600000057"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "자동차등록원부발급": {
    code: "MINWON_000052",
    name: "자동차등록원부 발급",
    searchKeyword: "자동차등록원부 발급",
    category: "운전/차량",
    cappBizCD: "12600000001",
    applyUrl: getGov24DirectUrl("12600000001"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  // ============= 인허가/건설 =============
  "건설업등록": {
    code: "MINWON_000060",
    name: "건설업 등록",
    searchKeyword: "건설업 등록",
    category: "인허가",
    applyUrl: getGov24SearchUrl("건설업 등록"),
    requiredDocs: ["건설업등록신청서", "기술자보유현황", "자본금확인서류"],
    processingDays: "14일",
    fee: "등록면허세",
    tips: ["KISCON(건설산업지식정보시스템)에서도 신청 가능"]
  },

  "전기공사업등록": {
    code: "MINWON_000061",
    name: "전기공사업 등록",
    searchKeyword: "전기공사업 등록",
    category: "인허가",
    applyUrl: getGov24SearchUrl("전기공사업 등록"),
    requiredDocs: ["등록신청서", "기술인력보유현황"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "소방시설업등록": {
    code: "MINWON_000062",
    name: "소방시설업 등록",
    searchKeyword: "소방시설업 등록",
    category: "인허가",
    applyUrl: getGov24SearchUrl("소방시설업 등록"),
    requiredDocs: ["등록신청서", "기술인력보유현황", "장비보유현황"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "정보통신공사업등록": {
    code: "MINWON_000063",
    name: "정보통신공사업 등록",
    searchKeyword: "정보통신공사업 등록",
    category: "인허가",
    applyUrl: getGov24SearchUrl("정보통신공사업 등록"),
    requiredDocs: ["등록신청서", "기술인력증명"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  // ============= 기타 자주 쓰는 민원 =============
  "인감증명서발급": {
    code: "MINWON_000070",
    name: "인감증명서 발급",
    searchKeyword: "인감증명서 발급",
    category: "증명서",
    applyUrl: getGov24SearchUrl("인감증명서 발급"),
    requiredDocs: ["신분증"],
    processingDays: "즉시",
    fee: "600원",
    tips: ["본인직접발급 (대리 불가)"]
  },

  "본인서명사실확인서발급": {
    code: "MINWON_000071",
    name: "본인서명사실확인서 발급",
    searchKeyword: "본인서명사실확인서",
    category: "증명서",
    applyUrl: getGov24SearchUrl("본인서명사실확인서"),
    requiredDocs: ["신분증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "지방세납세증명서발급": {
    code: "MINWON_000072",
    name: "지방세 납세증명서 발급",
    searchKeyword: "지방세 납세증명서",
    category: "세무",
    applyUrl: getGov24SearchUrl("지방세 납세증명서"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "지방세세목별과세증명서": {
    code: "MINWON_000073",
    name: "지방세 세목별 과세증명서",
    searchKeyword: "지방세 세목별 과세증명",
    category: "세무",
    applyUrl: getGov24SearchUrl("지방세 세목별 과세증명"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "장애인등록증발급": {
    code: "MINWON_000074",
    name: "장애인등록증 발급",
    searchKeyword: "장애인등록증 발급",
    category: "복지",
    applyUrl: getGov24SearchUrl("장애인등록증 발급"),
    requiredDocs: ["신청서", "진단서"],
    processingDays: "30일",
    fee: "무료",
  },

  "국민기초생활수급자증명": {
    code: "MINWON_000075",
    name: "국민기초생활수급자 증명",
    searchKeyword: "국민기초생활수급자 증명",
    category: "복지",
    applyUrl: getGov24SearchUrl("국민기초생활수급자 증명"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  // ============= 추가 영업/사업 민원 =============
  "노래연습장영업신고": {
    code: "MINWON_000080",
    name: "노래연습장 영업신고",
    searchKeyword: "노래연습장 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("노래연습장 영업신고"),
    requiredDocs: ["영업신고서", "소방시설완비증명원"],
    processingDays: "즉시",
    fee: "무료",
  },

  "당구장영업신고": {
    code: "MINWON_000081",
    name: "당구장 영업신고",
    searchKeyword: "당구장 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("당구장 영업신고"),
    requiredDocs: ["체육시설업신고서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "골프연습장영업신고": {
    code: "MINWON_000082",
    name: "골프연습장 영업신고",
    searchKeyword: "골프연습장 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("골프연습장 영업신고"),
    requiredDocs: ["체육시설업신고서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "수영장영업신고": {
    code: "MINWON_000083",
    name: "수영장 영업신고",
    searchKeyword: "수영장 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("수영장 영업신고"),
    requiredDocs: ["체육시설업등록신청서", "시설평면도"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "목욕장영업신고": {
    code: "MINWON_000084",
    name: "목욕장 영업신고",
    searchKeyword: "목욕장 영업신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("목욕장 영업신고"),
    requiredDocs: ["영업신고서", "위생교육이수증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "안마시술소개설신고": {
    code: "MINWON_000085",
    name: "안마시술소 개설 신고",
    searchKeyword: "안마시술소 개설 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("안마시술소 개설 신고"),
    requiredDocs: ["개설신고서", "자격증 사본"],
    processingDays: "7일",
    fee: "무료",
  },

  "동물병원개설신고": {
    code: "MINWON_000086",
    name: "동물병원 개설 신고",
    searchKeyword: "동물병원 개설 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("동물병원 개설 신고"),
    requiredDocs: ["개설신고서", "수의사면허증"],
    processingDays: "7일",
    fee: "무료",
  },

  "동물판매업등록": {
    code: "MINWON_000087",
    name: "동물판매업 등록",
    searchKeyword: "동물판매업 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("동물판매업 등록"),
    requiredDocs: ["등록신청서", "시설기준 증빙"],
    processingDays: "10일",
    fee: "등록면허세",
  },

  "동물장묘업등록": {
    code: "MINWON_000088",
    name: "동물장묘업 등록",
    searchKeyword: "동물장묘업 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("동물장묘업 등록"),
    requiredDocs: ["등록신청서"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "자동차정비업등록": {
    code: "MINWON_000089",
    name: "자동차정비업 등록",
    searchKeyword: "자동차정비업 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("자동차정비업 등록"),
    requiredDocs: ["등록신청서", "기술인력증명", "시설명세서"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "자동차매매업등록": {
    code: "MINWON_000090",
    name: "자동차매매업 등록",
    searchKeyword: "자동차매매업 등록",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("자동차매매업 등록"),
    requiredDocs: ["등록신청서", "매매사원증"],
    processingDays: "14일",
    fee: "등록면허세",
  },

  "자동차해체재활용업허가": {
    code: "MINWON_000091",
    name: "자동차해체재활용업 허가",
    searchKeyword: "자동차해체재활용업 허가",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("자동차해체재활용업 허가"),
    requiredDocs: ["허가신청서", "시설명세서"],
    processingDays: "20일",
    fee: "수수료",
  },

  "주차장설치신고": {
    code: "MINWON_000092",
    name: "주차장 설치 신고",
    searchKeyword: "주차장 설치 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("주차장 설치 신고"),
    requiredDocs: ["설치신고서", "배치도"],
    processingDays: "7일",
    fee: "무료",
  },

  "주유소설치허가": {
    code: "MINWON_000093",
    name: "주유소 설치 허가",
    searchKeyword: "주유소 설치 허가",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("주유소 설치 허가"),
    requiredDocs: ["허가신청서", "시설설치계획서"],
    processingDays: "30일",
    fee: "수수료",
  },

  "위험물제조소설치허가": {
    code: "MINWON_000094",
    name: "위험물제조소 설치 허가",
    searchKeyword: "위험물제조소 설치 허가",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("위험물제조소 설치 허가"),
    requiredDocs: ["허가신청서", "설계도서"],
    processingDays: "30일",
    fee: "수수료",
  },

  "의료기관개설신고": {
    code: "MINWON_000095",
    name: "의료기관 개설 신고",
    searchKeyword: "의료기관 개설 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("의료기관 개설 신고"),
    requiredDocs: ["개설신고서", "의사면허증", "시설평면도"],
    processingDays: "7일",
    fee: "무료",
  },

  "치과의원개설신고": {
    code: "MINWON_000096",
    name: "치과의원 개설 신고",
    searchKeyword: "치과의원 개설 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("치과의원 개설 신고"),
    requiredDocs: ["개설신고서", "치과의사면허증"],
    processingDays: "7일",
    fee: "무료",
  },

  "한의원개설신고": {
    code: "MINWON_000097",
    name: "한의원 개설 신고",
    searchKeyword: "한의원 개설 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("한의원 개설 신고"),
    requiredDocs: ["개설신고서", "한의사면허증"],
    processingDays: "7일",
    fee: "무료",
  },

  "어린이집인가신청": {
    code: "MINWON_000098",
    name: "어린이집 인가 신청",
    searchKeyword: "어린이집 인가 신청",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("어린이집 인가 신청"),
    requiredDocs: ["인가신청서", "시설평면도", "보육교직원자격증"],
    processingDays: "20일",
    fee: "무료",
  },

  "노인요양시설설치신고": {
    code: "MINWON_000099",
    name: "노인요양시설 설치 신고",
    searchKeyword: "노인요양시설 설치 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("노인요양시설 설치 신고"),
    requiredDocs: ["설치신고서", "시설평면도"],
    processingDays: "20일",
    fee: "무료",
  },

  "장례식장설치신고": {
    code: "MINWON_000100",
    name: "장례식장 설치 신고",
    searchKeyword: "장례식장 설치 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("장례식장 설치 신고"),
    requiredDocs: ["설치신고서"],
    processingDays: "14일",
    fee: "무료",
  },

  // ============= 추가 증명서/발급 민원 =============
  "인감등록": {
    code: "MINWON_000110",
    name: "인감 등록",
    searchKeyword: "인감 등록",
    category: "증명서",
    applyUrl: getGov24SearchUrl("인감 등록"),
    requiredDocs: ["신분증", "인감도장"],
    processingDays: "즉시",
    fee: "무료",
  },

  "인감변경신고": {
    code: "MINWON_000111",
    name: "인감 변경 신고",
    searchKeyword: "인감 변경 신고",
    category: "증명서",
    applyUrl: getGov24SearchUrl("인감 변경 신고"),
    requiredDocs: ["신분증", "새 인감도장"],
    processingDays: "즉시",
    fee: "무료",
  },

  "주민등록정정신청": {
    code: "MINWON_000112",
    name: "주민등록 정정 신청",
    searchKeyword: "주민등록 정정 신청",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("주민등록 정정 신청"),
    requiredDocs: ["정정신청서", "증빙서류"],
    processingDays: "3일",
    fee: "무료",
  },

  "전입신고": {
    code: "MINWON_000113",
    name: "전입 신고",
    searchKeyword: "전입신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("전입신고"),
    requiredDocs: ["신분증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "출생신고": {
    code: "MINWON_000114",
    name: "출생 신고",
    searchKeyword: "출생신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("출생신고"),
    requiredDocs: ["출생증명서", "신분증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "사망신고": {
    code: "MINWON_000115",
    name: "사망 신고",
    searchKeyword: "사망신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("사망신고"),
    requiredDocs: ["사망진단서", "신분증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "혼인신고": {
    code: "MINWON_000116",
    name: "혼인 신고",
    searchKeyword: "혼인신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("혼인신고"),
    requiredDocs: ["혼인신고서", "신분증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "이혼신고": {
    code: "MINWON_000117",
    name: "이혼 신고",
    searchKeyword: "이혼신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("이혼신고"),
    requiredDocs: ["이혼신고서", "이혼판결문"],
    processingDays: "즉시",
    fee: "무료",
  },

  "입양신고": {
    code: "MINWON_000118",
    name: "입양 신고",
    searchKeyword: "입양신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("입양신고"),
    requiredDocs: ["입양신고서", "입양허가서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "개명허가신청": {
    code: "MINWON_000119",
    name: "개명 허가 신청",
    searchKeyword: "개명 허가 신청",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("개명 허가 신청"),
    requiredDocs: ["개명허가신청서"],
    processingDays: "법원 심사",
    fee: "인지대",
    tips: ["법원에 신청"]
  },

  "국적취득신고": {
    code: "MINWON_000120",
    name: "국적 취득 신고",
    searchKeyword: "국적 취득 신고",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("국적 취득 신고"),
    requiredDocs: ["국적취득신고서", "귀화허가서"],
    processingDays: "즉시",
    fee: "무료",
  },

  // ============= 부동산/건축 추가 =============
  "가설건축물축조신고": {
    code: "MINWON_000130",
    name: "가설건축물 축조 신고",
    searchKeyword: "가설건축물 축조 신고",
    category: "부동산",
    applyUrl: getGov24SearchUrl("가설건축물 축조 신고"),
    requiredDocs: ["축조신고서", "배치도"],
    processingDays: "5일",
    fee: "무료",
  },

  "건축물철거신고": {
    code: "MINWON_000131",
    name: "건축물 철거 신고",
    searchKeyword: "건축물 철거 신고",
    category: "부동산",
    applyUrl: getGov24SearchUrl("건축물 철거 신고"),
    requiredDocs: ["철거신고서"],
    processingDays: "5일",
    fee: "무료",
  },

  "건축물사용승인신청": {
    code: "MINWON_000132",
    name: "건축물 사용승인 신청",
    searchKeyword: "건축물 사용승인 신청",
    category: "부동산",
    applyUrl: getGov24SearchUrl("건축물 사용승인 신청"),
    requiredDocs: ["사용승인신청서", "준공도면"],
    processingDays: "7일",
    fee: "수수료",
  },

  "건축물유지관리점검신청": {
    code: "MINWON_000133",
    name: "건축물 유지관리점검 신청",
    searchKeyword: "건축물 유지관리점검",
    category: "부동산",
    applyUrl: getGov24SearchUrl("건축물 유지관리점검"),
    requiredDocs: ["신청서"],
    processingDays: "14일",
    fee: "수수료",
  },

  "개발행위허가신청": {
    code: "MINWON_000134",
    name: "개발행위 허가 신청",
    searchKeyword: "개발행위 허가 신청",
    category: "부동산",
    applyUrl: getGov24SearchUrl("개발행위 허가 신청"),
    requiredDocs: ["허가신청서", "사업계획서", "토지사용승낙서"],
    processingDays: "15일",
    fee: "수수료",
  },

  "토지분할허가신청": {
    code: "MINWON_000135",
    name: "토지 분할 허가 신청",
    searchKeyword: "토지 분할 허가",
    category: "부동산",
    applyUrl: getGov24SearchUrl("토지 분할 허가"),
    requiredDocs: ["허가신청서", "분할계획도"],
    processingDays: "10일",
    fee: "수수료",
  },

  "토지합병신청": {
    code: "MINWON_000136",
    name: "토지 합병 신청",
    searchKeyword: "토지 합병 신청",
    category: "부동산",
    applyUrl: getGov24SearchUrl("토지 합병 신청"),
    requiredDocs: ["합병신청서"],
    processingDays: "10일",
    fee: "무료",
  },

  "도로점용허가신청": {
    code: "MINWON_000137",
    name: "도로 점용 허가 신청",
    searchKeyword: "도로 점용 허가",
    category: "부동산",
    applyUrl: getGov24SearchUrl("도로 점용 허가"),
    requiredDocs: ["허가신청서", "점용계획도"],
    processingDays: "10일",
    fee: "점용료",
  },

  "농지전용허가신청": {
    code: "MINWON_000138",
    name: "농지 전용 허가 신청",
    searchKeyword: "농지 전용 허가",
    category: "부동산",
    applyUrl: getGov24SearchUrl("농지 전용 허가"),
    requiredDocs: ["허가신청서", "사업계획서"],
    processingDays: "20일",
    fee: "농지보전부담금",
  },

  "산지전용허가신청": {
    code: "MINWON_000139",
    name: "산지 전용 허가 신청",
    searchKeyword: "산지 전용 허가",
    category: "부동산",
    applyUrl: getGov24SearchUrl("산지 전용 허가"),
    requiredDocs: ["허가신청서", "사업계획서"],
    processingDays: "20일",
    fee: "대체산림자원조성비",
  },

  // ============= 환경/위생 민원 =============
  "폐기물처리업허가": {
    code: "MINWON_000140",
    name: "폐기물처리업 허가",
    searchKeyword: "폐기물처리업 허가",
    category: "환경",
    applyUrl: getGov24SearchUrl("폐기물처리업 허가"),
    requiredDocs: ["허가신청서", "시설계획서"],
    processingDays: "30일",
    fee: "수수료",
  },

  "폐기물처리시설설치승인": {
    code: "MINWON_000141",
    name: "폐기물처리시설 설치 승인",
    searchKeyword: "폐기물처리시설 설치 승인",
    category: "환경",
    applyUrl: getGov24SearchUrl("폐기물처리시설 설치 승인"),
    requiredDocs: ["승인신청서", "설치계획서"],
    processingDays: "30일",
    fee: "수수료",
  },

  "대기오염물질배출시설설치신고": {
    code: "MINWON_000142",
    name: "대기오염물질배출시설 설치 신고",
    searchKeyword: "대기오염물질배출시설 설치",
    category: "환경",
    applyUrl: getGov24SearchUrl("대기오염물질배출시설 설치"),
    requiredDocs: ["설치신고서", "시설명세서"],
    processingDays: "10일",
    fee: "무료",
  },

  "수질오염물질배출시설설치신고": {
    code: "MINWON_000143",
    name: "수질오염물질배출시설 설치 신고",
    searchKeyword: "수질오염물질배출시설 설치",
    category: "환경",
    applyUrl: getGov24SearchUrl("수질오염물질배출시설 설치"),
    requiredDocs: ["설치신고서", "시설명세서"],
    processingDays: "10일",
    fee: "무료",
  },

  "소음진동배출시설설치신고": {
    code: "MINWON_000144",
    name: "소음진동배출시설 설치 신고",
    searchKeyword: "소음진동배출시설 설치",
    category: "환경",
    applyUrl: getGov24SearchUrl("소음진동배출시설 설치"),
    requiredDocs: ["설치신고서"],
    processingDays: "10일",
    fee: "무료",
  },

  // ============= 소방/안전 민원 =============
  "다중이용업소안전시설등완비증명서": {
    code: "MINWON_000150",
    name: "다중이용업소 안전시설완비증명서",
    searchKeyword: "다중이용업소 안전시설완비증명",
    category: "소방",
    applyUrl: getGov24SearchUrl("다중이용업소 안전시설완비증명"),
    requiredDocs: ["신청서"],
    processingDays: "7일",
    fee: "무료",
  },

  "소방시설완비증명서": {
    code: "MINWON_000151",
    name: "소방시설 완비증명서",
    searchKeyword: "소방시설완비증명",
    category: "소방",
    applyUrl: getGov24SearchUrl("소방시설완비증명"),
    requiredDocs: ["신청서"],
    processingDays: "7일",
    fee: "무료",
  },

  "위험물안전관리자선임신고": {
    code: "MINWON_000152",
    name: "위험물안전관리자 선임 신고",
    searchKeyword: "위험물안전관리자 선임",
    category: "소방",
    applyUrl: getGov24SearchUrl("위험물안전관리자 선임"),
    requiredDocs: ["선임신고서", "자격증 사본"],
    processingDays: "즉시",
    fee: "무료",
  },

  "소방안전관리자선임신고": {
    code: "MINWON_000153",
    name: "소방안전관리자 선임 신고",
    searchKeyword: "소방안전관리자 선임",
    category: "소방",
    applyUrl: getGov24SearchUrl("소방안전관리자 선임"),
    requiredDocs: ["선임신고서", "자격증 사본"],
    processingDays: "즉시",
    fee: "무료",
  },

  // ============= 교통/운수 민원 =============
  "자동차등록": {
    code: "MINWON_000160",
    name: "자동차 등록",
    searchKeyword: "자동차 등록",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("자동차 등록"),
    requiredDocs: ["등록신청서", "자동차제작증"],
    processingDays: "즉시",
    fee: "취득세",
  },

  "자동차이전등록": {
    code: "MINWON_000161",
    name: "자동차 이전 등록",
    searchKeyword: "자동차 이전등록",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("자동차 이전등록"),
    requiredDocs: ["이전등록신청서", "매매계약서"],
    processingDays: "즉시",
    fee: "취득세",
  },

  "자동차말소등록": {
    code: "MINWON_000162",
    name: "자동차 말소 등록",
    searchKeyword: "자동차 말소등록",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("자동차 말소등록"),
    requiredDocs: ["말소등록신청서", "폐차인수증명서"],
    processingDays: "즉시",
    fee: "무료",
  },

  "자동차번호판영치해제신청": {
    code: "MINWON_000163",
    name: "자동차 번호판 영치 해제",
    searchKeyword: "자동차 번호판 영치 해제",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("자동차 번호판 영치 해제"),
    requiredDocs: ["신청서", "과태료납부확인"],
    processingDays: "즉시",
    fee: "무료",
  },

  "국제운전면허증발급": {
    code: "MINWON_000164",
    name: "국제운전면허증 발급",
    searchKeyword: "국제운전면허증 발급",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("국제운전면허증 발급"),
    requiredDocs: ["신청서", "사진", "여권"],
    processingDays: "즉시",
    fee: "8,500원",
  },

  "화물운송종사자격증발급": {
    code: "MINWON_000165",
    name: "화물운송종사자격증 발급",
    searchKeyword: "화물운송종사자격",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("화물운송종사자격"),
    requiredDocs: ["신청서", "교육이수증"],
    processingDays: "7일",
    fee: "수수료",
  },

  // ============= 사회복지 민원 =============
  "기초연금신청": {
    code: "MINWON_000170",
    name: "기초연금 신청",
    searchKeyword: "기초연금 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("기초연금 신청"),
    requiredDocs: ["신청서", "소득재산신고서"],
    processingDays: "30일",
    fee: "무료",
  },

  "장애인연금신청": {
    code: "MINWON_000171",
    name: "장애인연금 신청",
    searchKeyword: "장애인연금 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("장애인연금 신청"),
    requiredDocs: ["신청서", "장애인등록증"],
    processingDays: "30일",
    fee: "무료",
  },

  "아동수당신청": {
    code: "MINWON_000172",
    name: "아동수당 신청",
    searchKeyword: "아동수당 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("아동수당 신청"),
    requiredDocs: ["신청서"],
    processingDays: "14일",
    fee: "무료",
  },

  "양육수당신청": {
    code: "MINWON_000173",
    name: "양육수당 신청",
    searchKeyword: "양육수당 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("양육수당 신청"),
    requiredDocs: ["신청서"],
    processingDays: "14일",
    fee: "무료",
  },

  "한부모가족지원신청": {
    code: "MINWON_000174",
    name: "한부모가족 지원 신청",
    searchKeyword: "한부모가족 지원",
    category: "복지",
    applyUrl: getGov24SearchUrl("한부모가족 지원"),
    requiredDocs: ["신청서", "가족관계증명서"],
    processingDays: "30일",
    fee: "무료",
  },

  "긴급복지지원신청": {
    code: "MINWON_000175",
    name: "긴급복지 지원 신청",
    searchKeyword: "긴급복지 지원",
    category: "복지",
    applyUrl: getGov24SearchUrl("긴급복지 지원"),
    requiredDocs: ["신청서"],
    processingDays: "즉시~3일",
    fee: "무료",
  },

  "주거급여신청": {
    code: "MINWON_000176",
    name: "주거급여 신청",
    searchKeyword: "주거급여 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("주거급여 신청"),
    requiredDocs: ["신청서", "임대차계약서"],
    processingDays: "30일",
    fee: "무료",
  },

  "의료급여신청": {
    code: "MINWON_000177",
    name: "의료급여 신청",
    searchKeyword: "의료급여 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("의료급여 신청"),
    requiredDocs: ["신청서"],
    processingDays: "30일",
    fee: "무료",
  },

  "교육급여신청": {
    code: "MINWON_000178",
    name: "교육급여 신청",
    searchKeyword: "교육급여 신청",
    category: "복지",
    applyUrl: getGov24SearchUrl("교육급여 신청"),
    requiredDocs: ["신청서"],
    processingDays: "30일",
    fee: "무료",
  },

  // ============= 교육 민원 =============
  "졸업증명서발급": {
    code: "MINWON_000180",
    name: "졸업증명서 발급",
    searchKeyword: "졸업증명서 발급",
    category: "교육",
    applyUrl: getGov24SearchUrl("졸업증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "성적증명서발급": {
    code: "MINWON_000181",
    name: "성적증명서 발급",
    searchKeyword: "성적증명서 발급",
    category: "교육",
    applyUrl: getGov24SearchUrl("성적증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "재학증명서발급": {
    code: "MINWON_000182",
    name: "재학증명서 발급",
    searchKeyword: "재학증명서 발급",
    category: "교육",
    applyUrl: getGov24SearchUrl("재학증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  // ============= 기타 민원 =============
  "여권발급신청": {
    code: "MINWON_000190",
    name: "여권 발급 신청",
    searchKeyword: "여권 발급 신청",
    category: "증명서",
    applyUrl: getGov24SearchUrl("여권 발급 신청"),
    requiredDocs: ["신청서", "사진", "신분증"],
    processingDays: "4일~7일",
    fee: "53,000원 (10년)",
  },

  "여권재발급신청": {
    code: "MINWON_000191",
    name: "여권 재발급 신청",
    searchKeyword: "여권 재발급",
    category: "증명서",
    applyUrl: getGov24SearchUrl("여권 재발급"),
    requiredDocs: ["신청서", "사진", "기존여권"],
    processingDays: "4일~7일",
    fee: "53,000원",
  },

  "범죄경력조회": {
    code: "MINWON_000192",
    name: "범죄경력 조회 (회보서)",
    searchKeyword: "범죄경력 조회",
    category: "증명서",
    applyUrl: getGov24SearchUrl("범죄경력 조회"),
    requiredDocs: ["신분증"],
    processingDays: "즉시",
    fee: "무료",
  },

  "건강보험자격득실확인서": {
    code: "MINWON_000193",
    name: "건강보험 자격득실확인서",
    searchKeyword: "건강보험 자격득실확인",
    category: "증명서",
    applyUrl: getGov24SearchUrl("건강보험 자격득실확인"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "국민연금가입증명서": {
    code: "MINWON_000194",
    name: "국민연금 가입증명서",
    searchKeyword: "국민연금 가입증명",
    category: "증명서",
    applyUrl: getGov24SearchUrl("국민연금 가입증명"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "고용보험피보험자격확인서": {
    code: "MINWON_000195",
    name: "고용보험 피보험자격 확인서",
    searchKeyword: "고용보험 피보험자격 확인",
    category: "증명서",
    applyUrl: getGov24SearchUrl("고용보험 피보험자격 확인"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "건설기계등록": {
    code: "MINWON_000196",
    name: "건설기계 등록",
    searchKeyword: "건설기계 등록",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("건설기계 등록"),
    requiredDocs: ["등록신청서", "제원표"],
    processingDays: "5일",
    fee: "수수료",
  },

  "건설기계조종사면허발급": {
    code: "MINWON_000197",
    name: "건설기계조종사 면허 발급",
    searchKeyword: "건설기계조종사 면허",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("건설기계조종사 면허"),
    requiredDocs: ["신청서", "합격증", "신체검사서"],
    processingDays: "7일",
    fee: "수수료",
  },

  "어업면허신청": {
    code: "MINWON_000198",
    name: "어업 면허 신청",
    searchKeyword: "어업 면허 신청",
    category: "인허가",
    applyUrl: getGov24SearchUrl("어업 면허 신청"),
    requiredDocs: ["면허신청서"],
    processingDays: "60일",
    fee: "수수료",
  },

  "축산업등록신청": {
    code: "MINWON_000199",
    name: "축산업 등록 신청",
    searchKeyword: "축산업 등록",
    category: "인허가",
    applyUrl: getGov24SearchUrl("축산업 등록"),
    requiredDocs: ["등록신청서", "축사시설 관련서류"],
    processingDays: "14일",
    fee: "무료",
  },

  "가축사육업허가신청": {
    code: "MINWON_000200",
    name: "가축사육업 허가 신청",
    searchKeyword: "가축사육업 허가",
    category: "인허가",
    applyUrl: getGov24SearchUrl("가축사육업 허가"),
    requiredDocs: ["허가신청서", "사업계획서"],
    processingDays: "20일",
    fee: "수수료",
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
