// =============================================================================
// 정부24 민원 서비스 링크 설정
// =============================================================================
// 정부24에서 제공하는 주요 민원 서비스 바로가기 링크
// 링크가 불확실한 경우 검색 URL을 사용

export interface Gov24ServiceLink {
  serviceName: string;          // 서비스명
  serviceUrl: string;           // 바로가기 URL
  searchUrl: string;            // 검색 URL (fallback)
  category: string;             // 분류
  relatedLaw?: string;          // 관련 법령
  lawSearchUrl?: string;        // 국가법령정보센터 시행규칙 검색 URL
}

// 정부24 검색 URL 생성
export function getGov24SearchUrl(keyword: string): string {
  return `https://www.gov.kr/search?svcType=&srhWrd=${encodeURIComponent(keyword)}`;
}

// 국가법령정보센터 시행규칙 검색 URL 생성
export function getLawRuleSearchUrl(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=1&query=${encodeURIComponent(lawName + ' 시행규칙')}`;
}

// 국가법령정보센터 서식 검색 URL 생성
export function getLawFormSearchUrl(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=8&query=${encodeURIComponent(lawName)}`;
}

// 주요 민원 서비스 링크 데이터베이스
export const GOV24_SERVICES: Record<string, Gov24ServiceLink> = {
  // ===== 식품위생 관련 =====
  restaurant: {
    serviceName: '일반음식점 영업신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12500000056',
    searchUrl: getGov24SearchUrl('일반음식점 영업신고'),
    category: '식품위생',
    relatedLaw: '식품위생법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('식품위생법시행규칙'),
  },
  cafe: {
    serviceName: '휴게음식점 영업신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12500000057',
    searchUrl: getGov24SearchUrl('휴게음식점 영업신고'),
    category: '식품위생',
    relatedLaw: '식품위생법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('식품위생법시행규칙'),
  },
  bakery: {
    serviceName: '제과점 영업신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12500000058',
    searchUrl: getGov24SearchUrl('제과점 영업신고'),
    category: '식품위생',
    relatedLaw: '식품위생법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('식품위생법시행규칙'),
  },
  food_manufacturing: {
    serviceName: '즉석판매제조가공업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12500000060',
    searchUrl: getGov24SearchUrl('즉석판매제조가공업'),
    category: '식품위생',
    relatedLaw: '식품위생법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('식품위생법시행규칙'),
  },

  // ===== 공장/제조업 관련 =====
  factory_approval: {
    serviceName: '공장설립(변경) 승인신청',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=14100000003',
    searchUrl: getGov24SearchUrl('공장설립 승인신청'),
    category: '산업/공장',
    relatedLaw: '산업집적활성화 및 공장설립에 관한 법률 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('산업집적활성화 및 공장설립에 관한 법률 시행규칙'),
  },
  factory_registration: {
    serviceName: '공장등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=14100000005',
    searchUrl: getGov24SearchUrl('공장등록'),
    category: '산업/공장',
    relatedLaw: '산업집적활성화 및 공장설립에 관한 법률 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('산업집적활성화 및 공장설립에 관한 법률 시행규칙'),
  },
  manufacturing: {
    serviceName: '제조업 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=14100000001',
    searchUrl: getGov24SearchUrl('제조업 등록'),
    category: '산업/공장',
    relatedLaw: '산업집적활성화 및 공장설립에 관한 법률 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('산업집적활성화 및 공장설립에 관한 법률 시행규칙'),
  },

  // ===== 건설업 관련 =====
  construction: {
    serviceName: '건설업 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15100000001',
    searchUrl: getGov24SearchUrl('건설업 등록'),
    category: '건설업',
    relatedLaw: '건설산업기본법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('건설산업기본법 시행규칙'),
  },

  // ===== 숙박업/관광업 관련 =====
  lodging: {
    serviceName: '숙박업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15700000001',
    searchUrl: getGov24SearchUrl('숙박업 신고'),
    category: '관광/숙박',
    relatedLaw: '공중위생관리법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('공중위생관리법 시행규칙'),
  },
  hostel: {
    serviceName: '호스텔업 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15700000050',
    searchUrl: getGov24SearchUrl('호스텔업 등록'),
    category: '관광/숙박',
    relatedLaw: '관광진흥법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('관광진흥법 시행규칙'),
  },
  tourist_hotel: {
    serviceName: '관광호텔업 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15700000040',
    searchUrl: getGov24SearchUrl('관광호텔업 등록'),
    category: '관광/숙박',
    relatedLaw: '관광진흥법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('관광진흥법 시행규칙'),
  },
  minbak: {
    serviceName: '농어촌민박업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12800000020',
    searchUrl: getGov24SearchUrl('농어촌민박업 신고'),
    category: '관광/숙박',
    relatedLaw: '농어촌정비법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('농어촌정비법 시행규칙'),
  },
  urban_minbak: {
    serviceName: '외국인관광 도시민박업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15700000055',
    searchUrl: getGov24SearchUrl('외국인관광 도시민박업'),
    category: '관광/숙박',
    relatedLaw: '관광진흥법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('관광진흥법 시행규칙'),
  },

  // ===== 부동산 관련 =====
  realestate: {
    serviceName: '부동산중개업 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15500000001',
    searchUrl: getGov24SearchUrl('부동산중개업 등록'),
    category: '부동산',
    relatedLaw: '공인중개사법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('공인중개사법 시행규칙'),
  },

  // ===== 미용/이용 관련 =====
  beauty: {
    serviceName: '미용업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15700000010',
    searchUrl: getGov24SearchUrl('미용업 신고'),
    category: '위생업',
    relatedLaw: '공중위생관리법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('공중위생관리법 시행규칙'),
  },
  barber: {
    serviceName: '이용업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15700000011',
    searchUrl: getGov24SearchUrl('이용업 신고'),
    category: '위생업',
    relatedLaw: '공중위생관리법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('공중위생관리법 시행규칙'),
  },

  // ===== 동물/애완 관련 =====
  petshop: {
    serviceName: '동물판매업 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12800000040',
    searchUrl: getGov24SearchUrl('동물판매업 등록'),
    category: '동물관련업',
    relatedLaw: '동물보호법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('동물보호법 시행규칙'),
  },
  pet_grooming: {
    serviceName: '동물미용업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=12800000041',
    searchUrl: getGov24SearchUrl('동물미용업 신고'),
    category: '동물관련업',
    relatedLaw: '동물보호법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('동물보호법 시행규칙'),
  },

  // ===== 의료/약국 관련 =====
  pharmacy: {
    serviceName: '약국 개설등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=13100000001',
    searchUrl: getGov24SearchUrl('약국 개설등록'),
    category: '보건의료',
    relatedLaw: '약사법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('약사법 시행규칙'),
  },
  clinic: {
    serviceName: '의원 개설신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=13100000010',
    searchUrl: getGov24SearchUrl('의원 개설신고'),
    category: '보건의료',
    relatedLaw: '의료법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('의료법 시행규칙'),
  },

  // ===== 사회복지 관련 =====
  daycare: {
    serviceName: '어린이집 설치인가',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=16100000001',
    searchUrl: getGov24SearchUrl('어린이집 설치인가'),
    category: '사회복지',
    relatedLaw: '영유아보육법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('영유아보육법 시행규칙'),
  },
  elderly_care: {
    serviceName: '노인요양시설 설치허가',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=16100000020',
    searchUrl: getGov24SearchUrl('노인요양시설 설치허가'),
    category: '사회복지',
    relatedLaw: '노인복지법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('노인복지법 시행규칙'),
  },

  // ===== 교육 관련 =====
  academy: {
    serviceName: '학원 설립·운영 등록',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=16300000001',
    searchUrl: getGov24SearchUrl('학원 설립 운영 등록'),
    category: '교육',
    relatedLaw: '학원의 설립·운영 및 과외교습에 관한 법률 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('학원의 설립 운영에 관한 법률 시행규칙'),
  },

  // ===== 체육/스포츠 관련 =====
  gym: {
    serviceName: '체육시설업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15900000001',
    searchUrl: getGov24SearchUrl('체육시설업 신고'),
    category: '체육시설',
    relatedLaw: '체육시설의 설치·이용에 관한 법률 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('체육시설의 설치 이용에 관한 법률 시행규칙'),
  },

  // ===== 운송업 관련 =====
  freight: {
    serviceName: '화물자동차 운송사업 허가',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15300000001',
    searchUrl: getGov24SearchUrl('화물자동차 운송사업 허가'),
    category: '운송',
    relatedLaw: '화물자동차 운수사업법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('화물자동차 운수사업법 시행규칙'),
  },
  taxi: {
    serviceName: '택시운송사업 면허',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15300000010',
    searchUrl: getGov24SearchUrl('택시운송사업 면허'),
    category: '운송',
    relatedLaw: '여객자동차 운수사업법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('여객자동차 운수사업법 시행규칙'),
  },

  // ===== 환경 관련 =====
  recycling: {
    serviceName: '폐기물처리업 허가',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=14500000001',
    searchUrl: getGov24SearchUrl('폐기물처리업 허가'),
    category: '환경',
    relatedLaw: '폐기물관리법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('폐기물관리법 시행규칙'),
  },

  // ===== 주류 관련 =====
  liquor_retail: {
    serviceName: '주류소매업 면허',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=11200000005',
    searchUrl: getGov24SearchUrl('주류소매업 면허'),
    category: '주류',
    relatedLaw: '주세법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('주세법 시행규칙'),
  },

  // ===== 건축 관련 =====
  building_permit: {
    serviceName: '건축허가',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15200000001',
    searchUrl: getGov24SearchUrl('건축허가'),
    category: '건축',
    relatedLaw: '건축법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('건축법 시행규칙'),
  },
  building_report: {
    serviceName: '건축신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15200000002',
    searchUrl: getGov24SearchUrl('건축신고'),
    category: '건축',
    relatedLaw: '건축법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('건축법 시행규칙'),
  },
  use_change: {
    serviceName: '용도변경 허가/신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=15200000003',
    searchUrl: getGov24SearchUrl('건축물 용도변경'),
    category: '건축',
    relatedLaw: '건축법 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('건축법 시행규칙'),
  },

  // ===== 통신판매/전자상거래 =====
  ecommerce: {
    serviceName: '통신판매업 신고',
    serviceUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=14800000001',
    searchUrl: getGov24SearchUrl('통신판매업 신고'),
    category: '전자상거래',
    relatedLaw: '전자상거래 등에서의 소비자보호에 관한 법률 시행규칙',
    lawSearchUrl: getLawFormSearchUrl('전자상거래법 시행규칙'),
  },
};

// 서비스 ID로 링크 정보 조회
export function getGov24Service(serviceId: string): Gov24ServiceLink | null {
  return GOV24_SERVICES[serviceId] || null;
}

// 키워드로 서비스 검색
export function searchGov24Services(keyword: string): Gov24ServiceLink[] {
  const lowerKeyword = keyword.toLowerCase();
  return Object.values(GOV24_SERVICES).filter(
    service =>
      service.serviceName.toLowerCase().includes(lowerKeyword) ||
      service.category.toLowerCase().includes(lowerKeyword)
  );
}

// 마크다운 링크 형식으로 변환
export function formatGov24Link(service: Gov24ServiceLink): string {
  return `[${service.serviceName}](${service.serviceUrl})`;
}

// 법령 링크와 함께 포맷
export function formatServiceWithLawLink(service: Gov24ServiceLink): string {
  let result = `- **정부24 신청**: [${service.serviceName}](${service.serviceUrl})\n`;
  if (service.lawSearchUrl) {
    result += `- **관련 서식**: [${service.relatedLaw} 서식 페이지](${service.lawSearchUrl})`;
  }
  return result;
}
