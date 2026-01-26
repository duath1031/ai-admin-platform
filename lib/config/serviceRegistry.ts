/**
 * =============================================================================
 * Universal Service Registry
 * =============================================================================
 * 모든 민원 서비스 정보를 중앙에서 관리
 * - 정부24 링크 정보
 * - PDF 템플릿 정보
 * - 필요 서류 및 수수료 정보
 *
 * 기존 gov24Links.ts 파일들의 데이터를 통합
 */

/**
 * 서비스 정의 인터페이스
 */
export interface ServiceDefinition {
  code: string;                   // 고유 코드 (예: "MAIL_ORDER_SALES")
  name: string;                   // 서비스명 (예: "통신판매업 신고")
  category: string;               // 카테고리

  gov24: {
    cappBizCD?: string;           // 정부24 서비스 코드
    directUrl?: string;           // 검증된 딥링크
    searchKeyword: string;        // 검색 폴백용 키워드
  };

  document: {
    hasTemplate: boolean;         // 템플릿 존재 여부
    templateType?: 'pdf' | 'docx' | 'both';
    mappingFile?: string;         // PDF 매핑 파일명
    relatedLaw?: string;          // 관련 법령
    lawFormUrl?: string;          // 국가법령정보센터 서식 URL
  };

  info: {
    processingDays: string;       // 처리 기간
    fee: string;                  // 수수료
    requiredDocs: string[];       // 필요 서류
    tips?: string[];              // 신청 팁
  };

  metadata?: {
    keywords?: string[];          // 검색 키워드
    aliases?: string[];           // 다른 이름들
    lastVerified?: string;        // 마지막 검증일
  };
}

/**
 * 정부24 직접 URL 생성
 * 원본 형식: https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=xxxxx
 */
export function getGov24DirectUrl(cappBizCD?: string): string {
  if (cappBizCD) {
    return `https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=${cappBizCD}`;
  }
  return 'https://www.gov.kr/portal/minwon/search';
}

/**
 * 정부24 검색 URL 생성
 */
export function getGov24SearchUrl(keyword: string): string {
  return `https://www.gov.kr/search?svcType=&srhWrd=${encodeURIComponent(keyword)}`;
}

/**
 * 국가법령정보센터 서식 검색 URL 생성
 */
export function getLawFormSearchUrl(lawName: string): string {
  return `https://www.law.go.kr/LSW/lsSc.do?menuId=8&query=${encodeURIComponent(lawName)}`;
}

// =============================================================================
// 서비스 레지스트리 데이터
// =============================================================================

export const SERVICE_REGISTRY: Record<string, ServiceDefinition> = {
  // =========================================================================
  // 사업자/영업 관련
  // =========================================================================

  MAIL_ORDER_SALES: {
    code: 'MAIL_ORDER_SALES',
    name: '통신판매업 신고',
    category: '전자상거래',
    gov24: {
      cappBizCD: '14800000001',
      directUrl: getGov24DirectUrl('14800000001'),
      searchKeyword: '통신판매업 신고',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'MAIL_ORDER_SALES.json',
      relatedLaw: '전자상거래법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('전자상거래법 시행규칙'),
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: ['사업자등록증 사본', '통신판매업 신고서'],
      tips: [
        '사업자등록증이 먼저 발급되어 있어야 합니다',
        '구매안전서비스 가입 후 신고하면 더 신뢰도가 높아집니다',
      ],
    },
    metadata: {
      keywords: ['온라인쇼핑몰', '인터넷판매', '스마트스토어', '쿠팡셀러'],
      aliases: ['통신판매업신고', '통판업신고'],
    },
  },

  RESTAURANT: {
    code: 'RESTAURANT',
    name: '일반음식점 영업신고',
    category: '식품위생',
    gov24: {
      cappBizCD: '12500000056',
      directUrl: getGov24DirectUrl('12500000056'),
      searchKeyword: '일반음식점 영업신고',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'RESTAURANT.json',
      relatedLaw: '식품위생법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('식품위생법 시행규칙'),
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: ['영업신고서', '위생교육이수증', '시설평면도'],
      tips: [
        '건축물대장상 용도가 "음식점"이어야 합니다',
        '소방시설완비증명원이 필요할 수 있습니다',
      ],
    },
    metadata: {
      keywords: ['식당', '레스토랑', '음식점개업', '요식업'],
      aliases: ['음식점영업신고', '식당영업신고'],
    },
  },

  BUSINESS_REGISTRATION: {
    code: 'BUSINESS_REGISTRATION',
    name: '사업자등록 신청',
    category: '세무',
    gov24: {
      cappBizCD: '13100000001',
      directUrl: getGov24DirectUrl('13100000001'),
      searchKeyword: '사업자등록 신청',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'BUSINESS_REGISTRATION.json',
      relatedLaw: '부가가치세법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('부가가치세법 시행규칙'),
    },
    info: {
      processingDays: '3일',
      fee: '무료',
      requiredDocs: ['사업자등록신청서', '임대차계약서', '신분증'],
      tips: [
        '홈택스에서도 신청 가능합니다',
        '업종에 따라 추가 서류가 필요할 수 있습니다',
      ],
    },
    metadata: {
      keywords: ['사업자등록', '개인사업자', '법인사업자', '사업개시'],
      aliases: ['사업자등록신청', '사업자신청'],
    },
  },

  BUILDING_REGISTER: {
    code: 'BUILDING_REGISTER',
    name: '건축물대장 발급',
    category: '부동산',
    gov24: {
      cappBizCD: '15000000098',
      directUrl: getGov24DirectUrl('15000000098'),
      searchKeyword: '건축물대장 발급',
    },
    document: {
      hasTemplate: false,
    },
    info: {
      processingDays: '즉시',
      fee: '무료 (온라인)',
      requiredDocs: [],
      tips: ['열람용과 발급용 중 선택하세요'],
    },
    metadata: {
      keywords: ['건축물대장', '건물대장', '건물정보'],
      aliases: ['건축물대장발급'],
    },
  },

  INSTANT_SALES_MANUFACTURING: {
    code: 'INSTANT_SALES_MANUFACTURING',
    name: '즉석판매제조가공업 신고',
    category: '식품위생',
    gov24: {
      cappBizCD: '12500000060',
      directUrl: getGov24DirectUrl('12500000060'),
      searchKeyword: '즉석판매제조가공업',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'INSTANT_SALES_MANUFACTURING.json',
      relatedLaw: '식품위생법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('식품위생법 시행규칙'),
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: ['영업신고서', '위생교육이수증', '시설평면도'],
      tips: [
        '제조시설과 판매시설이 같은 장소에 있어야 합니다',
        '위생교육을 먼저 이수해야 합니다',
      ],
    },
    metadata: {
      keywords: ['즉석식품', '반찬가게', '김밥천국', '분식점'],
      aliases: ['즉판업', '즉석판매업'],
    },
  },

  CAFE: {
    code: 'CAFE',
    name: '휴게음식점 영업신고',
    category: '식품위생',
    gov24: {
      cappBizCD: '14600000022',
      directUrl: getGov24DirectUrl('14600000022'),
      searchKeyword: '휴게음식점 영업신고',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'CAFE.json',
      relatedLaw: '식품위생법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('식품위생법 시행규칙'),
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: ['영업신고서', '위생교육이수증'],
      tips: ['카페, 제과점 등이 해당됩니다'],
    },
    metadata: {
      keywords: ['카페', '커피숍', '베이커리', '제과점'],
      aliases: ['휴게음식점신고', '카페영업신고'],
    },
  },

  LODGING: {
    code: 'LODGING',
    name: '숙박업 신고',
    category: '관광/숙박',
    gov24: {
      searchKeyword: '숙박업 신고',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'LODGING.json',
      relatedLaw: '공중위생관리법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('공중위생관리법 시행규칙'),
    },
    info: {
      processingDays: '7일',
      fee: '무료',
      requiredDocs: ['숙박업신고서', '소방시설완비증명원', '건축물대장'],
      tips: ['건축물용도가 숙박시설이어야 합니다'],
    },
    metadata: {
      keywords: ['모텔', '호텔', '펜션', '게스트하우스'],
      aliases: ['숙박업신고', '숙박시설신고'],
    },
  },

  BEAUTY_SALON: {
    code: 'BEAUTY_SALON',
    name: '미용업 신고',
    category: '위생업',
    gov24: {
      searchKeyword: '미용업 신고',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'BEAUTY_SALON.json',
      relatedLaw: '공중위생관리법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('공중위생관리법 시행규칙'),
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: ['영업신고서', '면허증 사본', '위생교육이수증'],
    },
    metadata: {
      keywords: ['미용실', '헤어샵', '네일샵', '피부관리실'],
      aliases: ['미용실신고', '미용업신고'],
    },
  },

  ACADEMY: {
    code: 'ACADEMY',
    name: '학원 설립·운영 등록',
    category: '교육',
    gov24: {
      searchKeyword: '학원 설립 운영 등록',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'ACADEMY.json',
      relatedLaw: '학원법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('학원법 시행규칙'),
    },
    info: {
      processingDays: '10일',
      fee: '등록면허세',
      requiredDocs: ['학원설립운영등록신청서', '시설평면도', '임대차계약서'],
    },
    metadata: {
      keywords: ['학원', '교습소', '공부방'],
      aliases: ['학원등록', '학원설립'],
    },
  },

  GYM: {
    code: 'GYM',
    name: '체육시설업 신고',
    category: '체육시설',
    gov24: {
      searchKeyword: '체육시설업 신고',
    },
    document: {
      hasTemplate: true,
      templateType: 'pdf',
      mappingFile: 'GYM.json',
      relatedLaw: '체육시설법 시행규칙',
      lawFormUrl: getLawFormSearchUrl('체육시설법 시행규칙'),
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: ['체육시설업신고서', '시설평면도'],
      tips: ['헬스장, 당구장, 골프연습장 등'],
    },
    metadata: {
      keywords: ['헬스장', '피트니스', '당구장', '골프연습장'],
      aliases: ['체육시설신고', '헬스장신고'],
    },
  },

  // =========================================================================
  // 증명서 발급
  // =========================================================================

  RESIDENT_REGISTRATION_COPY: {
    code: 'RESIDENT_REGISTRATION_COPY',
    name: '주민등록등본 발급',
    category: '가족관계',
    gov24: {
      cappBizCD: '13100000015',
      directUrl: getGov24DirectUrl('13100000015'),
      searchKeyword: '주민등록등본 발급',
    },
    document: {
      hasTemplate: false,
    },
    info: {
      processingDays: '즉시',
      fee: '무료 (온라인)',
      requiredDocs: [],
    },
    metadata: {
      keywords: ['주민등록', '등본', '초본'],
      aliases: ['등본발급', '주민등록등본'],
    },
  },

  FAMILY_RELATION_CERTIFICATE: {
    code: 'FAMILY_RELATION_CERTIFICATE',
    name: '가족관계증명서 발급',
    category: '가족관계',
    gov24: {
      cappBizCD: '97400000004',
      directUrl: getGov24DirectUrl('97400000004'),
      searchKeyword: '가족관계증명서 발급',
    },
    document: {
      hasTemplate: false,
    },
    info: {
      processingDays: '즉시',
      fee: '무료 (온라인)',
      requiredDocs: [],
    },
    metadata: {
      keywords: ['가족관계', '가족증명'],
      aliases: ['가족관계증명서발급'],
    },
  },

  TAX_PAYMENT_CERTIFICATE: {
    code: 'TAX_PAYMENT_CERTIFICATE',
    name: '납세증명서 발급',
    category: '세무',
    gov24: {
      cappBizCD: '12100000014',
      directUrl: getGov24DirectUrl('12100000014'),
      searchKeyword: '납세증명서 발급',
    },
    document: {
      hasTemplate: false,
    },
    info: {
      processingDays: '즉시',
      fee: '무료',
      requiredDocs: [],
    },
    metadata: {
      keywords: ['납세증명', '세금완납'],
      aliases: ['납세증명서발급'],
    },
  },

  LAND_REGISTER: {
    code: 'LAND_REGISTER',
    name: '토지대장 발급',
    category: '부동산',
    gov24: {
      cappBizCD: '13100000026',
      directUrl: getGov24DirectUrl('13100000026'),
      searchKeyword: '토지대장 발급',
    },
    document: {
      hasTemplate: false,
    },
    info: {
      processingDays: '즉시',
      fee: '무료 (온라인)',
      requiredDocs: [],
    },
    metadata: {
      keywords: ['토지대장', '토지정보'],
      aliases: ['토지대장발급'],
    },
  },

  LAND_USE_PLAN: {
    code: 'LAND_USE_PLAN',
    name: '토지이용계획확인서 발급',
    category: '부동산',
    gov24: {
      cappBizCD: '15000000013',
      directUrl: getGov24DirectUrl('15000000013'),
      searchKeyword: '토지이용계획확인서',
    },
    document: {
      hasTemplate: false,
    },
    info: {
      processingDays: '즉시',
      fee: '무료 (온라인)',
      requiredDocs: [],
    },
    metadata: {
      keywords: ['토지이용', '용도지역'],
      aliases: ['토지이용계획'],
    },
  },
};

// =============================================================================
// 유틸리티 함수들
// =============================================================================

/**
 * 서비스 코드로 서비스 조회
 */
export function getService(code: string): ServiceDefinition | null {
  return SERVICE_REGISTRY[code] || null;
}

/**
 * 서비스명 또는 키워드로 검색
 */
export function searchServices(keyword: string): ServiceDefinition[] {
  const lowerKeyword = keyword.toLowerCase().replace(/\s/g, '');

  return Object.values(SERVICE_REGISTRY).filter(service => {
    const searchTargets = [
      service.name.toLowerCase().replace(/\s/g, ''),
      service.code.toLowerCase(),
      service.category.toLowerCase(),
      ...(service.metadata?.keywords || []).map(k => k.toLowerCase()),
      ...(service.metadata?.aliases || []).map(a => a.toLowerCase()),
    ];

    return searchTargets.some(target => target.includes(lowerKeyword));
  });
}

/**
 * 카테고리별 서비스 조회
 */
export function getServicesByCategory(category: string): ServiceDefinition[] {
  return Object.values(SERVICE_REGISTRY).filter(
    service => service.category === category
  );
}

/**
 * 모든 카테고리 목록
 */
export function getAllCategories(): string[] {
  const categories = new Set(
    Object.values(SERVICE_REGISTRY).map(s => s.category)
  );
  return Array.from(categories).sort();
}

/**
 * PDF 템플릿이 있는 서비스 목록
 */
export function getServicesWithTemplate(): ServiceDefinition[] {
  return Object.values(SERVICE_REGISTRY).filter(
    service => service.document.hasTemplate
  );
}

/**
 * 서비스의 정부24 URL 조회
 */
export function getServiceGov24Url(code: string): string {
  const service = getService(code);
  if (!service) {
    return 'https://www.gov.kr/portal/minwon/search';
  }

  // 직접 URL이 있으면 사용
  if (service.gov24.directUrl) {
    return service.gov24.directUrl;
  }

  // CappBizCD가 있으면 직접 링크 생성
  if (service.gov24.cappBizCD) {
    return getGov24DirectUrl(service.gov24.cappBizCD);
  }

  // 검색 URL 폴백
  return getGov24SearchUrl(service.gov24.searchKeyword);
}

/**
 * 서비스 정보를 마크다운으로 포맷
 */
export function formatServiceInfo(service: ServiceDefinition): string {
  let result = `## ${service.name}\n\n`;

  result += `**카테고리**: ${service.category}\n`;
  result += `**처리기간**: ${service.info.processingDays}\n`;
  result += `**수수료**: ${service.info.fee}\n\n`;

  if (service.info.requiredDocs.length > 0) {
    result += `**필요서류**:\n`;
    service.info.requiredDocs.forEach(doc => {
      result += `- ${doc}\n`;
    });
    result += '\n';
  }

  if (service.info.tips && service.info.tips.length > 0) {
    result += `**신청 팁**:\n`;
    service.info.tips.forEach(tip => {
      result += `- ${tip}\n`;
    });
    result += '\n';
  }

  result += `**정부24 신청**: [바로가기](${getServiceGov24Url(service.code)})\n`;

  if (service.document.lawFormUrl) {
    result += `**관련 서식**: [${service.document.relatedLaw}](${service.document.lawFormUrl})\n`;
  }

  return result;
}

/**
 * 전체 서비스 수
 */
export function getServiceCount(): number {
  return Object.keys(SERVICE_REGISTRY).length;
}
