// 인허가 업종 및 서식 데이터베이스

export interface FormField {
  key: string;
  label: string;
  example: string;
}

export interface BusinessType {
  id: string;
  name: string;
  description: string;
  category: string;
  formName: string;
  formUrl: string;
  lawPage: string;
  law?: string;
  permitType?: string;
  authority?: string;
  requiredDocs: string[];
  fields: FormField[];
  tips: string;
  zoneRequirements?: {
    allowed: string[];
    prohibited: string[];
    note: string;
  };
  // 정부24 신청 정보
  gov24Url?: string;           // 정부24 직접 신청 URL
  gov24ServiceName?: string;   // 정부24 민원 서비스명
  applicationSteps?: string[]; // 신청 절차 단계별 안내
  gov24InputFields?: string[]; // 정부24 입력 항목
  gov24UploadDocs?: string[];  // 정부24 업로드 서류 및 준비 방법
}

// =============================================================================
// URL 생성 헬퍼 함수 (검색 결과 페이지 사용)
// =============================================================================

// 주요 민원의 정부24 직접 링크 (CappBizCD 기반)
const GOV24_DIRECT_LINKS: Record<string, string> = {
  // 식품위생법
  "영업신고": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000039",
  "영업신고 일반음식점": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000039",
  "영업신고 휴게음식점": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000039",
  "영업신고 제과점": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000039",
  // 공중위생관리법
  "숙박업 신고": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15100000048",
  "숙박업 신고 생활숙박": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15100000048",
  // 관광진흥법
  "관광사업 등록": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12400000091",
  "관광사업 등록 호스텔": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12400000091",
  // 산업집적활성화법
  "공장설립 완료신고": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12600000055",
  "공장설립 승인": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12600000056",
  // 물류정책기본법
  "창고업 등록": "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12700000066",
};

// 정부24 민원 URL 생성 (직접 링크 또는 검색 페이지)
function getGov24SearchUrl(serviceName: string): string {
  // 직접 링크가 있으면 사용
  if (GOV24_DIRECT_LINKS[serviceName]) {
    return GOV24_DIRECT_LINKS[serviceName];
  }
  // 없으면 검색 페이지로 연결
  return `https://www.gov.kr/portal/search/searchMain?searchGb=service&query=${encodeURIComponent(serviceName)}`;
}

// 국가법령정보센터 서식 검색 URL 생성 (검색 결과 페이지)
function getLawFormSearchUrl(lawName: string, formKeyword: string = ""): string {
  const searchQuery = formKeyword ? `${lawName} ${formKeyword}` : lawName;
  return `https://www.law.go.kr/LSW/lsBylSc.do?menuId=8&query=${encodeURIComponent(searchQuery)}`;
}

// 국가법령정보센터 법령 서식 페이지 URL 생성
function getLawFormPageUrl(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=1&subMenuId=15&query=${encodeURIComponent(lawName)}#liBylSc`;
}

// 식품위생법 업종 분류
export const FOOD_BUSINESS_TYPES: Record<string, BusinessType> = {
  general_restaurant: {
    id: "general_restaurant",
    name: "일반음식점",
    description: "음식류를 조리/판매하며 음주 허용 (식당, 한식집, 중식집 등)",
    category: "식품위생법",
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getLawFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
    requiredDocs: [
      "위생교육 이수증 (식품위생교육 6시간)",
      "건강진단결과서 (보건증)",
      "영업장 시설 배치도",
      "임대차계약서 또는 등기부등본",
    ],
    fields: [
      { key: "business_name", label: "상호(가게 이름)", example: "맛있는 식당" },
      { key: "owner_name", label: "대표자 성함", example: "홍길동" },
      { key: "owner_birth", label: "대표자 생년월일", example: "1980-01-15" },
      { key: "address", label: "영업장 소재지 (도로명주소)", example: "인천광역시 계양구 오조산로45번길 12" },
      { key: "phone", label: "전화번호", example: "032-123-4567" },
      { key: "area_size", label: "영업장 면적 (m2)", example: "66" },
    ],
    tips: "일반음식점은 주류 판매가 가능하며, 영업 시작 전 위생교육을 반드시 이수해야 합니다.",
    // 정부24 신청 정보
    gov24Url: getGov24SearchUrl("영업신고 일반음식점"),
    gov24ServiceName: "식품위생법에 따른 영업신고(일반음식점)",
    applicationSteps: [
      "1. 정부24 접속 후 로그인 (공동인증서/간편인증)",
      "2. '영업신고' 검색 또는 직접 링크 클릭",
      "3. 신청서 작성: 상호, 대표자, 영업장 소재지, 면적 등 입력",
      "4. 첨부서류 업로드",
      "5. 신청 완료 후 접수증 출력",
    ],
    gov24InputFields: [
      "상호(가게 이름)",
      "대표자 성명",
      "대표자 생년월일",
      "영업장 소재지 (도로명주소)",
      "영업장 면적 (m²)",
      "전화번호",
    ],
    gov24UploadDocs: [
      "위생교육 이수증 (식품위생교육 6시간) - 한국식품산업협회에서 발급, PDF/사진 업로드",
      "건강진단결과서 (보건증) - 보건소 또는 지정 병원 발급, 스캔본/사진",
      "영업장 시설 배치도 - 직접 작성 또는 CAD 도면, PDF/이미지",
      "임대차계약서 또는 등기부등본 - 스캔본",
    ],
  },
  snack_bar: {
    id: "snack_bar",
    name: "휴게음식점",
    description: "음식류를 조리/판매하나 음주 불가 (카페, 분식점, 베이커리 등)",
    category: "식품위생법",
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getLawFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
    requiredDocs: [
      "위생교육 이수증 (식품위생교육 6시간)",
      "건강진단결과서 (보건증)",
      "영업장 시설 배치도",
      "임대차계약서 또는 등기부등본",
    ],
    fields: [
      { key: "business_name", label: "상호(가게 이름)", example: "카페 아름다운" },
      { key: "owner_name", label: "대표자 성함", example: "김철수" },
      { key: "owner_birth", label: "대표자 생년월일", example: "1985-05-20" },
      { key: "address", label: "영업장 소재지 (도로명주소)", example: "서울특별시 강남구 테헤란로 123" },
      { key: "phone", label: "전화번호", example: "02-555-1234" },
      { key: "area_size", label: "영업장 면적 (m2)", example: "45" },
    ],
    tips: "휴게음식점은 주류 판매가 불가능합니다. 카페, 제과점, 분식점 등이 해당됩니다.",
    // 정부24 신청 정보
    gov24Url: getGov24SearchUrl("영업신고 휴게음식점"),
    gov24ServiceName: "식품위생법에 따른 영업신고(휴게음식점)",
    applicationSteps: [
      "1. 정부24 접속 후 로그인 (공동인증서/간편인증)",
      "2. '영업신고' 검색 또는 직접 링크 클릭",
      "3. 신청서 작성: 상호, 대표자, 영업장 소재지, 면적 등 입력",
      "4. 업종 선택에서 '휴게음식점' 선택",
      "5. 첨부서류 업로드 후 신청 완료",
    ],
    gov24InputFields: [
      "상호(가게 이름)",
      "대표자 성명",
      "대표자 생년월일",
      "영업장 소재지 (도로명주소)",
      "영업장 면적 (m²)",
      "전화번호",
    ],
    gov24UploadDocs: [
      "위생교육 이수증 (식품위생교육 6시간) - 한국식품산업협회에서 발급, PDF/사진 업로드",
      "건강진단결과서 (보건증) - 보건소 또는 지정 병원 발급, 스캔본/사진",
      "영업장 시설 배치도 - 직접 작성 또는 CAD 도면, PDF/이미지",
      "임대차계약서 또는 등기부등본 - 스캔본",
    ],
  },
  bakery: {
    id: "bakery",
    name: "제과점영업",
    description: "빵, 케이크, 과자류를 제조/판매 (베이커리, 제과점)",
    category: "식품위생법",
    formName: "영업신고서 (별지 제37호서식)",
    formUrl: getLawFormSearchUrl("식품위생법시행규칙", "영업신고서"),
    lawPage: getLawFormPageUrl("식품위생법시행규칙"),
    requiredDocs: [
      "위생교육 이수증",
      "건강진단결과서 (보건증)",
      "영업장 시설 배치도",
      "제조시설 목록",
    ],
    fields: [
      { key: "business_name", label: "상호(가게 이름)", example: "달콤빵집" },
      { key: "owner_name", label: "대표자 성함", example: "박영희" },
      { key: "owner_birth", label: "대표자 생년월일", example: "1990-03-10" },
      { key: "address", label: "영업장 소재지", example: "부산광역시 해운대구 마린시티로 100" },
      { key: "phone", label: "전화번호", example: "051-777-8888" },
      { key: "area_size", label: "영업장 면적 (m2)", example: "80" },
    ],
    tips: "제과점은 현장 제조 시설이 필요하며, 시설기준을 충족해야 합니다.",
    // 정부24 신청 정보
    gov24Url: getGov24SearchUrl("영업신고 제과점"),
    gov24ServiceName: "식품위생법에 따른 영업신고(제과점영업)",
    applicationSteps: [
      "1. 정부24 접속 후 로그인 (공동인증서/간편인증)",
      "2. '영업신고' 검색 또는 직접 링크 클릭",
      "3. 신청서 작성: 상호, 대표자, 영업장 소재지, 면적 등 입력",
      "4. 업종 선택에서 '제과점영업' 선택",
      "5. 첨부서류 업로드 후 신청 완료",
    ],
    gov24InputFields: [
      "상호(가게 이름)",
      "대표자 성명",
      "대표자 생년월일",
      "영업장 소재지 (도로명주소)",
      "영업장 면적 (m²)",
      "전화번호",
      "제조시설 목록",
    ],
    gov24UploadDocs: [
      "위생교육 이수증 - 한국식품산업협회에서 발급, PDF/사진 업로드",
      "건강진단결과서 (보건증) - 보건소 또는 지정 병원 발급, 스캔본/사진",
      "영업장 시설 배치도 - 제조시설 포함 표시, PDF/이미지",
      "제조시설 목록 - 오븐, 믹서기 등 제조 설비 목록",
    ],
  },
};

// 관광진흥법 업종 분류
export const TOURISM_BUSINESS_TYPES: Record<string, BusinessType> = {
  hotel: {
    id: "hotel",
    name: "관광호텔업",
    description: "관광객 숙박시설 (호텔, 리조트) - 관광진흥법",
    category: "관광진흥법",
    formName: "관광사업 등록신청서",
    formUrl: getLawFormSearchUrl("관광진흥법시행규칙", "등록신청서"),
    lawPage: getLawFormPageUrl("관광진흥법시행규칙"),
    law: "관광진흥법",
    requiredDocs: [
      "사업계획서",
      "건축물대장",
      "토지이용계획확인서",
      "소방시설 완비증명서",
    ],
    fields: [
      { key: "business_name", label: "업소명", example: "그랜드호텔" },
      { key: "owner_name", label: "대표자 성함", example: "이대표" },
      { key: "address", label: "소재지", example: "서울특별시 중구 명동길 100" },
      { key: "room_count", label: "객실 수", example: "50" },
      { key: "total_area", label: "연면적 (m2)", example: "3000" },
    ],
    tips: "관광호텔업은 등록 전 시설 및 설비 기준 충족 필요. 용도지역 확인 필수.",
    gov24Url: getGov24SearchUrl("관광사업 등록"),
  },
  hostel: {
    id: "hostel",
    name: "호스텔업",
    description: "배낭여행객 등을 위한 저가 숙박시설 - 관광진흥법",
    category: "관광진흥법",
    formName: "관광사업 등록신청서",
    formUrl: getLawFormSearchUrl("관광진흥법시행규칙", "등록신청서"),
    lawPage: getLawFormPageUrl("관광진흥법시행규칙"),
    law: "관광진흥법",
    requiredDocs: [
      "사업계획서",
      "건축물대장",
      "토지이용계획확인서",
      "소방시설 완비증명서",
    ],
    fields: [
      { key: "business_name", label: "업소명", example: "서울게스트하우스" },
      { key: "owner_name", label: "대표자 성함", example: "김대표" },
      { key: "address", label: "소재지", example: "서울특별시 종로구 인사동길 50" },
      { key: "bed_count", label: "침대 수", example: "30" },
      { key: "total_area", label: "연면적 (m2)", example: "300" },
    ],
    tips: "호스텔업은 객실당 침대 수 등 시설기준 확인 필요.",
    gov24Url: getGov24SearchUrl("관광사업 등록 호스텔"),
  },
};

// 공중위생관리법 숙박업
export const PUBLIC_HEALTH_BUSINESS_TYPES: Record<string, BusinessType> = {
  general_lodging: {
    id: "general_lodging",
    name: "일반숙박업",
    description: "호텔, 여관, 여인숙 등 일반 숙박시설 - 공중위생관리법",
    category: "공중위생관리법",
    formName: "숙박업 신고서",
    formUrl: getLawFormSearchUrl("공중위생관리법시행규칙", "숙박업"),
    lawPage: getLawFormPageUrl("공중위생관리법시행규칙"),
    law: "공중위생관리법",
    permitType: "신고",
    authority: "시/군/구청 위생과",
    requiredDocs: [
      "숙박업 신고서",
      "건축물대장 (숙박시설 용도)",
      "소방시설 완비증명서",
      "위생교육 이수증",
      "사업자등록증 사본",
    ],
    fields: [
      { key: "business_name", label: "상호(업소명)", example: "행복호텔" },
      { key: "owner_name", label: "대표자 성함", example: "홍길동" },
      { key: "owner_birth", label: "대표자 생년월일", example: "1980-01-15" },
      { key: "address", label: "소재지", example: "인천광역시 계양구 오조산로45번길 12" },
      { key: "phone", label: "전화번호", example: "032-123-4567" },
      { key: "room_count", label: "객실 수", example: "20" },
      { key: "total_area", label: "연면적 (m2)", example: "500" },
    ],
    zoneRequirements: {
      allowed: ["상업지역", "준주거지역", "일반주거지역(조건부)"],
      prohibited: ["전용주거지역", "녹지지역", "공업지역(일부)"],
      note: "학교정화구역(200m) 내 설치 제한. 용도지역별 조례 확인 필수.",
    },
    tips: `일반숙박업 핵심 체크리스트:
1. 건축물 용도: '숙박시설'로 되어 있어야 함 (용도변경 필요시 별도 절차)
2. 소방: 스프링클러, 자동화재탐지설비 등 소방시설 완비
3. 위치: 학교정화구역(200m), 청소년유해시설 주변 제한
4. 주차: 지자체 조례에 따른 주차장 확보
5. 객실기준: 객실별 욕실, 환기시설 등 시설기준 충족`,
    // 정부24 신청 정보
    gov24Url: getGov24SearchUrl("숙박업 신고"),
    gov24ServiceName: "공중위생관리법에 따른 숙박업 신고",
    applicationSteps: [
      "1. 정부24 접속 후 로그인 (공동인증서/간편인증)",
      "2. '숙박업 신고' 검색 또는 직접 링크 클릭",
      "3. 신청서 작성: 상호, 대표자, 소재지, 객실 수 등 입력",
      "4. 첨부서류 업로드",
      "5. 신청 완료 후 접수증 출력",
      "6. 관할 구청 위생과에서 현장 확인 후 신고증 발급",
    ],
    gov24InputFields: [
      "상호(업소명)",
      "대표자 성명",
      "대표자 생년월일",
      "소재지 (도로명주소)",
      "객실 수",
      "연면적 (m²)",
      "전화번호",
    ],
    gov24UploadDocs: [
      "건축물대장 (숙박시설 용도 확인) - 정부24에서 발급 가능",
      "소방시설 완비증명서 - 관할 소방서 발급",
      "위생교육 이수증 - 공중위생영업자 위생교육, 한국공중위생협회",
      "사업자등록증 사본",
      "임대차계약서 또는 등기부등본",
    ],
  },
  living_lodging: {
    id: "living_lodging",
    name: "생활숙박업",
    description: "에어비앤비, 공유숙박 등 - 공중위생관리법",
    category: "공중위생관리법",
    formName: "숙박업 신고서",
    formUrl: getLawFormSearchUrl("공중위생관리법시행규칙", "숙박업"),
    lawPage: getLawFormPageUrl("공중위생관리법시행규칙"),
    law: "공중위생관리법",
    permitType: "신고",
    authority: "시/군/구청 위생과",
    requiredDocs: [
      "숙박업 신고서",
      "건축물대장",
      "소방시설 완비증명서",
      "위생교육 이수증",
    ],
    fields: [
      { key: "business_name", label: "상호(업소명)", example: "OO게스트하우스" },
      { key: "owner_name", label: "대표자 성함", example: "김철수" },
      { key: "address", label: "소재지", example: "서울특별시 마포구 연남동 123" },
      { key: "room_count", label: "객실 수", example: "3" },
    ],
    tips: "생활숙박업은 주거지역에서도 가능하나, 아파트 등 공동주택은 관리규약 확인 필요.",
    // 정부24 신청 정보
    gov24Url: getGov24SearchUrl("숙박업 신고 생활숙박"),
    gov24ServiceName: "공중위생관리법에 따른 숙박업 신고(생활숙박업)",
    applicationSteps: [
      "1. 정부24 접속 후 로그인 (공동인증서/간편인증)",
      "2. '숙박업 신고' 검색 후 '생활숙박업' 선택",
      "3. 신청서 작성: 상호, 대표자, 소재지, 객실 수 등 입력",
      "4. 첨부서류 업로드",
      "5. 신청 완료 후 접수증 출력",
      "6. 관할 구청에서 신고증 발급 (보통 3~5일 소요)",
    ],
    gov24InputFields: [
      "상호(업소명)",
      "대표자 성명",
      "대표자 생년월일",
      "소재지 (도로명주소)",
      "객실 수",
      "전화번호",
    ],
    gov24UploadDocs: [
      "건축물대장 - 정부24에서 발급 가능, 용도 확인",
      "소방시설 완비증명서 - 관할 소방서 발급 (소화기, 화재경보기 등)",
      "위생교육 이수증 - 공중위생영업자 위생교육 이수",
      "공동주택 관리규약 동의서 (아파트의 경우) - 입주자대표회의 동의",
    ],
  },
};

// 기업 인증 관련
export const BUSINESS_CERTIFICATIONS: Record<string, any> = {
  venture: {
    id: "venture",
    name: "벤처기업 확인",
    description: "기술성, 사업성이 우수한 중소기업에 대한 정부 인증",
    mainPortal: "https://www.smes.go.kr/venturein/home/viewHome",
    formUrl: "https://www.smes.go.kr/venturein",
    requiredDocs: [
      "사업계획서 (기술성/혁신성 포함)",
      "재무제표",
      "기술 관련 증빙 (특허, 인증서 등)",
      "사업자등록증",
      "법인등기부등본 (법인의 경우)",
    ],
    benefits: [
      "세제 혜택 (법인세, 소득세 감면)",
      "정책자금 우대",
      "공공입찰 가점",
      "코스닥 상장 시 우대",
      "병역특례 지정 가능",
    ],
    tips: "벤처기업 확인은 기술보증기금, 중소벤처기업진흥공단 등 확인기관을 통해 진행됩니다.",
  },
  innobiz: {
    id: "innobiz",
    name: "이노비즈(기술혁신형 중소기업) 인증",
    description: "기술 우위를 바탕으로 경쟁력을 확보한 기술혁신형 중소기업 인증",
    mainPortal: "https://www.innobiz.net/",
    formUrl: "https://www.innobiz.net/",
    requiredDocs: [
      "기술혁신시스템 평가 서류",
      "재무제표",
      "사업자등록증",
      "기술 관련 증빙자료",
    ],
    benefits: [
      "정책자금 우대 (중소벤처기업진흥공단)",
      "신용보증 우대 (신용보증기금, 기술보증기금)",
      "공공구매 우대",
      "R&D 사업 가점",
      "수출보험 우대",
    ],
    tips: "이노비즈 인증은 기술혁신시스템(R&D, 기술사업화 등) 평가를 통해 진행됩니다. 유효기간 3년.",
  },
  mainbiz: {
    id: "mainbiz",
    name: "메인비즈(경영혁신형 중소기업) 인증",
    description: "경영혁신 활동을 통해 경쟁력을 확보한 경영혁신형 중소기업 인증",
    mainPortal: "https://www.smes.go.kr/mainbiz/main.do",
    formUrl: "https://www.smes.go.kr/mainbiz/main.do",
    requiredDocs: [
      "경영혁신역량 평가 서류",
      "재무제표",
      "사업자등록증",
      "경영혁신 활동 증빙자료",
    ],
    benefits: [
      "정책자금 우대",
      "신용보증 우대",
      "공공구매 우대",
      "세제 혜택",
      "컨설팅 지원",
    ],
    tips: "메인비즈 인증은 경영혁신역량(마케팅, 인사, 재무 등) 평가를 통해 진행됩니다. 유효기간 3년.",
  },
};

// 공장 등록 관련
export const FACTORY_BUSINESS_TYPES: Record<string, BusinessType> = {
  factory_registration: {
    id: "factory_registration",
    name: "공장등록",
    description: "제조업을 영위하기 위한 공장 설립 및 등록 (산업집적활성화법)",
    category: "산업집적활성화법",
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: getLawFormSearchUrl("산업집적활성화및공장설립에관한법률시행규칙", "완료신고"),
    lawPage: getLawFormPageUrl("산업집적활성화및공장설립에관한법률시행규칙"),
    law: "산업집적활성화 및 공장설립에 관한 법률",
    permitType: "등록/신고",
    authority: "시/군/구청 또는 한국산업단지공단",
    requiredDocs: [
      "공장설립등의 완료신고서",
      "공장배치도",
      "건축물대장 또는 건축허가서 사본",
      "토지등기부등본 또는 임대차계약서",
      "사업자등록증 사본",
      "환경관련 인허가 서류 (해당시)",
    ],
    fields: [
      { key: "company_name", label: "상호(회사명)", example: "주식회사 OO제조" },
      { key: "representative", label: "대표자", example: "홍길동" },
      { key: "factory_address", label: "공장 소재지", example: "경기도 화성시 OO읍 OO리 123" },
      { key: "factory_area", label: "공장부지면적 (m²)", example: "3,000" },
      { key: "building_area", label: "건축면적 (m²)", example: "1,500" },
      { key: "industry_code", label: "업종코드(KSIC)", example: "C29 (기타 기계 및 장비 제조업)" },
    ],
    zoneRequirements: {
      allowed: ["공업지역", "준공업지역", "계획관리지역(조건부)", "산업단지"],
      prohibited: ["주거지역", "상업지역(일부)", "농림지역", "자연환경보전지역"],
      note: "공장 설립 가능 여부는 용도지역, 면적, 업종에 따라 다름. 개별입지/계획입지 구분 필요.",
    },
    tips: `공장등록 핵심 체크리스트:
1. 용도지역 확인: 공업지역, 준공업지역, 계획관리지역(조건부) 등에서 가능
2. 면적기준: 제조시설 면적 500m² 이상 시 공장등록 대상
3. 환경규제: 대기/수질/소음 관련 배출시설 설치 시 별도 허가 필요
4. 산업단지: 산업단지 입주 시 입주계약 절차 별도 진행
5. 개별입지: 비도시지역 개별입지 시 공장설립승인 필요 (500m² 미만 제외)`,
    gov24Url: getGov24SearchUrl("공장설립 완료신고"),
    gov24ServiceName: "공장설립등의 완료신고",
    applicationSteps: [
      "1. 정부24 접속 후 로그인 (공동인증서/간편인증)",
      "2. '공장설립' 또는 '공장등록' 검색",
      "3. 공장설립등의 완료신고서 작성",
      "4. 첨부서류 업로드 (공장배치도, 건축물대장 등)",
      "5. 신청 완료 후 담당 부서 현장 확인",
    ],
  },
  factory_approval: {
    id: "factory_approval",
    name: "공장설립승인",
    description: "비도시지역에서 일정 규모 이상 공장 설립 시 필요한 승인",
    category: "산업집적활성화법",
    formName: "공장설립등의 완료신고서 (별지 제7호서식)",
    formUrl: getLawFormSearchUrl("산업집적활성화및공장설립에관한법률시행규칙", "승인신청"),
    lawPage: getLawFormPageUrl("산업집적활성화및공장설립에관한법률시행규칙"),
    law: "산업집적활성화 및 공장설립에 관한 법률",
    permitType: "승인",
    authority: "시/군/구청",
    requiredDocs: [
      "공장설립등의 승인신청서",
      "사업계획서",
      "공장배치도",
      "토지이용계획확인서",
      "환경영향평가서 (해당시)",
      "교통영향평가서 (해당시)",
    ],
    fields: [
      { key: "company_name", label: "상호(회사명)", example: "주식회사 OO제조" },
      { key: "factory_address", label: "공장 예정지", example: "경기도 이천시 OO면 OO리 산123" },
      { key: "factory_area", label: "공장부지면적 (m²)", example: "10,000" },
      { key: "investment", label: "투자금액", example: "50억원" },
    ],
    zoneRequirements: {
      allowed: ["계획관리지역", "생산관리지역(조건부)", "농림지역(조건부)"],
      prohibited: ["보전관리지역", "자연환경보전지역"],
      note: "개별입지 공장은 계획관리지역 우선. 농림지역은 농지전용 등 추가 절차 필요.",
    },
    tips: `공장설립승인 핵심사항:
1. 대상: 비도시지역 공장부지 500m² 이상 (업종별 상이)
2. 승인기간: 약 20~40일 (환경영향평가 대상 시 연장)
3. 농지전용: 농지 위 설립 시 농지전용허가 선행 필요
4. 산지전용: 산지 위 설립 시 산지전용허가 선행 필요`,
    gov24Url: getGov24SearchUrl("공장설립 승인"),
  },
  warehouse: {
    id: "warehouse",
    name: "창고업 등록",
    description: "타인의 물품을 보관하는 창고업 등록 (물류정책기본법)",
    category: "물류정책기본법",
    formName: "창고업 등록신청서",
    formUrl: getLawFormSearchUrl("물류정책기본법시행규칙", "창고업"),
    lawPage: getLawFormPageUrl("물류정책기본법시행규칙"),
    law: "물류정책기본법",
    permitType: "등록",
    authority: "시/도지사",
    requiredDocs: [
      "창고업 등록신청서",
      "창고시설 배치도",
      "건축물대장",
      "토지등기부등본 또는 임대차계약서",
      "소방시설 완비증명서",
    ],
    fields: [
      { key: "company_name", label: "상호", example: "OO물류" },
      { key: "warehouse_address", label: "창고 소재지", example: "경기도 용인시 처인구 OO로 123" },
      { key: "warehouse_area", label: "창고면적 (m²)", example: "5,000" },
      { key: "storage_type", label: "보관물품 종류", example: "일반화물" },
    ],
    zoneRequirements: {
      allowed: ["공업지역", "준공업지역", "일반상업지역", "계획관리지역"],
      prohibited: ["전용주거지역", "일반주거지역(대부분)"],
      note: "창고시설은 건축법상 창고시설 용도 확인 필요.",
    },
    tips: `창고업 등록 요건:
1. 시설기준: 연면적 1,000m² 이상 (영업용 창고)
2. 안전기준: 소방시설, 환기시설, 방수시설 등
3. 보험가입: 화재보험, 적하보험 등 필수
4. 자가창고: 자사 물품만 보관 시 등록 불요`,
    gov24Url: getGov24SearchUrl("창고업 등록"),
  },
};

// 출입국관리법 - 비자/체류 관련
// 비자 서식은 하이코리아 공식 민원서식 페이지로 연결
const HIKOREA_FORM_URL = "https://www.hikorea.go.kr/board/BoardApplicationListR.pt";

export const IMMIGRATION_VISA_TYPES: Record<string, BusinessType> = {
  f4_visa: {
    id: "f4_visa",
    name: "F-4 재외동포 비자",
    description: "대한민국 국적을 보유했던 자 또는 그 직계비속으로서 외국 국적을 취득한 재외동포를 위한 체류자격",
    category: "출입국관리법",
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: HIKOREA_FORM_URL,
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
    law: "출입국관리법",
    permitType: "사증발급",
    authority: "재외공관 (대사관/총영사관)",
    requiredDocs: [
      "사증발급신청서 (별지 제17호서식)",
      "여권 (유효기간 6개월 이상)",
      "여권용 사진 1매 (최근 6개월 이내)",
      "재외동포 입증서류 (기본증명서, 가족관계증명서, 제적등본 등)",
      "국적상실 관련 서류 (해당시)",
      "범죄경력증명서 (해당 국가 발급)",
    ],
    fields: [
      { key: "applicant_name", label: "신청인 성명 (영문)", example: "HONG GILDONG" },
      { key: "applicant_name_kr", label: "신청인 성명 (한글)", example: "홍길동" },
      { key: "birth_date", label: "생년월일", example: "1980-01-15" },
      { key: "nationality", label: "국적", example: "미국" },
      { key: "passport_no", label: "여권번호", example: "M12345678" },
      { key: "korean_address", label: "국내 체류지 (예정)", example: "서울특별시 강남구 테헤란로 123" },
      { key: "phone", label: "연락처", example: "+1-123-456-7890" },
    ],
    tips: `F-4 비자 핵심 체크리스트:
1. 신청 장소: 반드시 재외공관(대사관/총영사관) 방문 신청 (온라인 불가)
2. 재외동포 입증: 본인 또는 부모/조부모의 대한민국 국적 보유 이력 증명 필요
3. 유효기간: 최대 5년 복수사증 발급 가능
4. 체류활동: 취업활동 가능 (단순노무직 제외)
5. 국내 체류기간: 1회 입국 시 최대 2년 체류 가능`,
    gov24Url: "https://www.hikorea.go.kr/Main.pt",  // 하이코리아 메인
  },
  f5_visa: {
    id: "f5_visa",
    name: "F-5 영주 비자",
    description: "대한민국에 영주할 수 있는 체류자격 (영주권)",
    category: "출입국관리법",
    formName: "체류자격변경허가신청서 (별지 제34호서식)",
    formUrl: HIKOREA_FORM_URL,
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
    law: "출입국관리법",
    permitType: "체류자격변경",
    authority: "출입국·외국인청",
    requiredDocs: [
      "체류자격변경허가신청서",
      "여권 및 외국인등록증",
      "체류기간 충족 증빙 (5년 이상 합법체류)",
      "생계유지능력 증명 (소득금액증명원, 재산세 납세증명 등)",
      "기본소양 증명 (사회통합프로그램 이수 또는 영주용 종합평가 합격)",
      "범죄경력증명서",
    ],
    fields: [
      { key: "applicant_name", label: "신청인 성명", example: "HONG GILDONG" },
      { key: "alien_reg_no", label: "외국인등록번호", example: "123456-1234567" },
      { key: "current_status", label: "현재 체류자격", example: "F-4" },
      { key: "stay_period", label: "국내 체류기간", example: "5년 6개월" },
    ],
    tips: `F-5 영주비자 핵심 요건:
1. 체류기간: 5년 이상 합법적 체류
2. 소득요건: 전년도 1인당 GNI 이상 소득 또는 자산
3. 기본소양: 사회통합프로그램 5단계 이수 또는 영주용 종합평가 합격
4. 품행단정: 범죄경력 없어야 함`,
    gov24Url: "https://www.hikorea.go.kr/Main.pt",
  },
  d10_visa: {
    id: "d10_visa",
    name: "D-10 구직 비자",
    description: "국내 대학 졸업자 또는 해외 우수인재의 구직활동을 위한 체류자격",
    category: "출입국관리법",
    formName: "사증발급신청서 (별지 제17호서식)",
    formUrl: HIKOREA_FORM_URL,
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
    law: "출입국관리법",
    permitType: "사증발급",
    authority: "재외공관 / 출입국·외국인청",
    requiredDocs: [
      "사증발급신청서",
      "여권",
      "졸업증명서 또는 학위증명서",
      "성적증명서",
      "구직활동계획서",
      "체류비용 입증서류 (은행잔고증명 등)",
    ],
    fields: [
      { key: "applicant_name", label: "신청인 성명", example: "HONG GILDONG" },
      { key: "university", label: "졸업 대학", example: "서울대학교" },
      { key: "major", label: "전공", example: "컴퓨터공학" },
      { key: "graduation_date", label: "졸업일", example: "2024-02-28" },
    ],
    tips: `D-10 구직비자 핵심사항:
1. 대상: 국내 전문학사 이상 졸업자, 해외 학사 이상 졸업자
2. 체류기간: 최대 2년 (6개월 단위 연장)
3. 활동범위: 구직활동, 연수, 시간제 취업(주 20시간 이내)
4. 취업 시: E-7 등 취업자격으로 변경 필요`,
    gov24Url: "https://www.hikorea.go.kr/Main.pt",
  },
  e7_visa: {
    id: "e7_visa",
    name: "E-7 특정활동 비자",
    description: "전문인력으로서 국내 기업에 취업하기 위한 체류자격",
    category: "출입국관리법",
    formName: "사증발급인정신청서 (별지 제21호서식)",
    formUrl: HIKOREA_FORM_URL,
    lawPage: getLawFormPageUrl("출입국관리법시행규칙"),
    law: "출입국관리법",
    permitType: "사증발급인정",
    authority: "출입국·외국인청",
    requiredDocs: [
      "사증발급인정신청서",
      "고용계약서",
      "사업자등록증 사본",
      "학력 및 경력 증명서",
      "자격증 사본 (해당시)",
      "납세증명서 (고용업체)",
    ],
    fields: [
      { key: "applicant_name", label: "신청인 성명", example: "HONG GILDONG" },
      { key: "company_name", label: "고용업체명", example: "삼성전자" },
      { key: "job_code", label: "직업코드", example: "E-7-1 (경영·회계)" },
      { key: "salary", label: "연봉", example: "50,000,000원" },
    ],
    tips: `E-7 특정활동비자 핵심사항:
1. 전문인력 요건: 학사 이상 + 관련 경력 또는 자격증
2. 임금요건: 내국인 근로자 평균임금 이상
3. 고용업체: 세금체납 없어야 함
4. 사증발급인정서: 국내 업체가 먼저 신청 후, 본인이 재외공관에서 비자 발급`,
    gov24Url: "https://www.hikorea.go.kr/Main.pt",
  },
};

// 정부 포털
export const GOVERNMENT_PORTALS = {
  gov24: {
    name: "정부24",
    url: "https://www.gov.kr",
    description: "정부 민원 통합 포털 - 각종 인허가 신청 가능",
  },
  hikorea: {
    name: "하이코리아",
    url: "https://www.hikorea.go.kr/Main.pt",
    description: "외국인 출입국/체류 관련 민원 포털 (비자, 외국인등록 등)",
  },
  law_info: {
    name: "국가법령정보센터",
    url: "https://www.law.go.kr",
    description: "법령 및 서식 검색/다운로드",
  },
  eum: {
    name: "토지이용규제정보서비스",
    url: "https://luris.molit.go.kr",
    description: "토지이용계획 확인",
  },
  g2b: {
    name: "나라장터 (G2B)",
    url: "https://www.g2b.go.kr/",
    description: "국가 공공조달 통합 플랫폼 - 입찰공고, 계약, 대금 지급",
  },
};

// 모든 업종 통합 검색
export function searchBusinessTypes(keyword: string): BusinessType[] {
  const allTypes = {
    ...FOOD_BUSINESS_TYPES,
    ...TOURISM_BUSINESS_TYPES,
    ...PUBLIC_HEALTH_BUSINESS_TYPES,
    ...FACTORY_BUSINESS_TYPES,
    ...IMMIGRATION_VISA_TYPES,
  };

  const results: BusinessType[] = [];
  const lowerKeyword = keyword.toLowerCase();

  for (const type of Object.values(allTypes)) {
    if (
      type.name.toLowerCase().includes(lowerKeyword) ||
      type.description.toLowerCase().includes(lowerKeyword) ||
      type.formName.toLowerCase().includes(lowerKeyword) ||
      type.category.toLowerCase().includes(lowerKeyword)
    ) {
      results.push(type);
    }
  }

  return results;
}

// 서식 URL로 다운로드 정보 가져오기
export function getFormDownloadInfo(businessTypeId: string): {
  name: string;
  formName: string;
  formUrl: string;
  lawPage: string;
} | null {
  const allTypes = {
    ...FOOD_BUSINESS_TYPES,
    ...TOURISM_BUSINESS_TYPES,
    ...PUBLIC_HEALTH_BUSINESS_TYPES,
  };

  const type = allTypes[businessTypeId];
  if (!type) return null;

  return {
    name: type.name,
    formName: type.formName,
    formUrl: type.formUrl,
    lawPage: type.lawPage,
  };
}
