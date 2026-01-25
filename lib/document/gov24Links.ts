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
  applyUrl: string;       // 검색 URL (동적 생성)
  infoUrl?: string;       // 안내 페이지 URL
  requiredDocs: string[]; // 필요 서류
  processingDays: string; // 처리 기간
  fee: string;            // 수수료
  tips?: string[];        // 신청 팁
}

/**
 * 정부24 검색 URL 생성
 */
export function getGov24SearchUrl(keyword: string): string {
  return `https://www.gov.kr/portal/service/serviceList?srchText=${encodeURIComponent(keyword)}`;
}

// 정부24 민원 서비스 DB (검색 링크 방식)
export const GOV24_SERVICES: Record<string, Gov24Service> = {
  // ============= 사업자/영업 =============
  "통신판매업신고": {
    code: "MINWON_000001",
    name: "통신판매업 신고",
    searchKeyword: "통신판매업 신고",
    category: "사업자/영업",
    applyUrl: getGov24SearchUrl("통신판매업 신고"),
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
    applyUrl: getGov24SearchUrl("일반음식점 영업신고"),
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
    applyUrl: getGov24SearchUrl("휴게음식점 영업신고"),
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
    applyUrl: getGov24SearchUrl("건축물대장 발급"),
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
    applyUrl: getGov24SearchUrl("토지대장 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "토지이용계획확인서": {
    code: "MINWON_000022",
    name: "토지이용계획확인서 발급",
    searchKeyword: "토지이용계획확인서",
    category: "부동산",
    applyUrl: getGov24SearchUrl("토지이용계획확인서"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "지적도등본발급": {
    code: "MINWON_000023",
    name: "지적도 등본 발급",
    searchKeyword: "지적도 등본",
    category: "부동산",
    applyUrl: getGov24SearchUrl("지적도 등본"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "개별공시지가확인서": {
    code: "MINWON_000024",
    name: "개별공시지가 확인서",
    searchKeyword: "개별공시지가 확인",
    category: "부동산",
    applyUrl: getGov24SearchUrl("개별공시지가 확인"),
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
    applyUrl: getGov24SearchUrl("사업자등록 신청"),
    requiredDocs: ["사업자등록신청서", "임대차계약서", "신분증"],
    processingDays: "3일",
    fee: "무료",
  },

  "사업자등록증명발급": {
    code: "MINWON_000031",
    name: "사업자등록증명 발급",
    searchKeyword: "사업자등록증명 발급",
    category: "세무",
    applyUrl: getGov24SearchUrl("사업자등록증명 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "휴폐업사실증명발급": {
    code: "MINWON_000032",
    name: "휴폐업사실증명 발급",
    searchKeyword: "휴폐업사실증명 발급",
    category: "세무",
    applyUrl: getGov24SearchUrl("휴폐업사실증명 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "납세증명서발급": {
    code: "MINWON_000033",
    name: "납세증명서 발급",
    searchKeyword: "납세증명서 발급",
    category: "세무",
    applyUrl: getGov24SearchUrl("납세증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료",
  },

  "소득금액증명발급": {
    code: "MINWON_000034",
    name: "소득금액증명 발급",
    searchKeyword: "소득금액증명 발급",
    category: "세무",
    applyUrl: getGov24SearchUrl("소득금액증명 발급"),
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
    applyUrl: getGov24SearchUrl("주민등록등본 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "주민등록초본발급": {
    code: "MINWON_000041",
    name: "주민등록초본 발급",
    searchKeyword: "주민등록초본 발급",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("주민등록초본 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "가족관계증명서발급": {
    code: "MINWON_000042",
    name: "가족관계증명서 발급",
    searchKeyword: "가족관계증명서 발급",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("가족관계증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "기본증명서발급": {
    code: "MINWON_000043",
    name: "기본증명서 발급",
    searchKeyword: "기본증명서 발급",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("기본증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "혼인관계증명서발급": {
    code: "MINWON_000044",
    name: "혼인관계증명서 발급",
    searchKeyword: "혼인관계증명서 발급",
    category: "가족관계",
    applyUrl: getGov24SearchUrl("혼인관계증명서 발급"),
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
    applyUrl: getGov24SearchUrl("운전경력증명서 발급"),
    requiredDocs: [],
    processingDays: "즉시",
    fee: "무료 (온라인)",
  },

  "자동차등록원부발급": {
    code: "MINWON_000052",
    name: "자동차등록원부 발급",
    searchKeyword: "자동차등록원부 발급",
    category: "운전/차량",
    applyUrl: getGov24SearchUrl("자동차등록원부 발급"),
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
