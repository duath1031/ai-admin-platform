/**
 * 건축물대장 API 연동 모듈
 * 공공데이터포털 "건축물대장정보 서비스" 활용
 * https://www.data.go.kr/data/15044713/openapi.do
 */

interface BuildingInfo {
  // 기본 정보
  mgmBldrgstPk: string; // 관리건축물대장PK
  bldNm: string; // 건물명
  mainPurpsCdNm: string; // 주용도코드명
  etcPurps: string; // 기타용도
  platPlc: string; // 대지위치
  newPlatPlc: string; // 도로명대지위치

  // 건축물 현황
  totArea: number; // 연면적
  vlRat: number; // 용적률
  bcRat: number; // 건폐율
  archArea: number; // 건축면적
  grndFlrCnt: number; // 지상층수
  ugrndFlrCnt: number; // 지하층수

  // 용도 상세
  mainPurpsCd: string; // 주용도코드
  strctCdNm: string; // 구조코드명

  // 허용 업종 분석 결과
  allowedBusinesses?: string[];
  restrictedBusinesses?: string[];
}

// 건축물 용도 코드별 허용 업종 매핑
const BUILDING_USE_BUSINESS_MATRIX: Record<string, {
  allowed: string[];
  restricted: string[];
  description: string;
}> = {
  // 제1종 근린생활시설
  "01000": {
    allowed: ["retail", "cafe", "beauty", "pharmacy"],
    restricted: ["manufacturing", "lodging", "warehouse"],
    description: "제1종 근린생활시설 - 소매점, 휴게음식점, 미용실, 약국 등",
  },
  // 제2종 근린생활시설
  "02000": {
    allowed: ["restaurant", "cafe", "retail", "office", "sports", "education", "beauty", "petshop"],
    restricted: ["manufacturing", "lodging", "warehouse"],
    description: "제2종 근린생활시설 - 일반음식점, 사무소, 학원, 체육시설 등",
  },
  // 업무시설
  "04000": {
    allowed: ["office", "construction", "realestate", "transport", "passenger"],
    restricted: ["restaurant", "manufacturing", "lodging"],
    description: "업무시설 - 사무실, 오피스텔 등",
  },
  // 판매시설
  "05000": {
    allowed: ["retail", "restaurant", "cafe"],
    restricted: ["manufacturing", "lodging", "warehouse"],
    description: "판매시설 - 도매시장, 소매시장, 상점 등",
  },
  // 의료시설
  "07000": {
    allowed: ["medical", "pharmacy"],
    restricted: ["restaurant", "manufacturing", "lodging"],
    description: "의료시설 - 병원, 의원, 한의원 등",
  },
  // 교육연구시설
  "08000": {
    allowed: ["education", "daycare"],
    restricted: ["restaurant", "manufacturing", "lodging"],
    description: "교육연구시설 - 학교, 교육원, 연구소 등",
  },
  // 노유자시설
  "09000": {
    allowed: ["daycare", "elderly"],
    restricted: ["restaurant", "manufacturing", "lodging"],
    description: "노유자시설 - 어린이집, 노인복지시설 등",
  },
  // 숙박시설
  "11000": {
    allowed: ["lodging"],
    restricted: ["manufacturing", "education"],
    description: "숙박시설 - 호텔, 여관, 모텔 등",
  },
  // 위락시설
  "12000": {
    allowed: ["sports"],
    restricted: ["manufacturing", "education", "medical"],
    description: "위락시설 - 유흥업소, 단란주점 등",
  },
  // 공장
  "15000": {
    allowed: ["manufacturing", "warehouse"],
    restricted: ["restaurant", "lodging", "education", "medical"],
    description: "공장 - 제조업, 가공업 시설",
  },
  // 창고시설
  "16000": {
    allowed: ["warehouse", "transport"],
    restricted: ["restaurant", "lodging", "education", "medical"],
    description: "창고시설 - 일반창고, 물류창고 등",
  },
  // 동물관련시설
  "19000": {
    allowed: ["petshop"],
    restricted: ["restaurant", "lodging", "education"],
    description: "동물관련시설 - 동물병원, 펫샵 등",
  },
  // 자원순환시설
  "22000": {
    allowed: ["recycling"],
    restricted: ["restaurant", "lodging", "education", "medical"],
    description: "자원순환시설 - 폐기물처리시설 등",
  },
};

// 건축물 용도 코드 분류
const BUILDING_USE_CODES: Record<string, string> = {
  "01": "단독주택",
  "02": "공동주택",
  "03": "제1종 근린생활시설",
  "04": "제2종 근린생활시설",
  "05": "문화 및 집회시설",
  "06": "종교시설",
  "07": "판매시설",
  "08": "운수시설",
  "09": "의료시설",
  "10": "교육연구시설",
  "11": "노유자시설",
  "12": "수련시설",
  "13": "운동시설",
  "14": "업무시설",
  "15": "숙박시설",
  "16": "위락시설",
  "17": "공장",
  "18": "창고시설",
  "19": "위험물저장 및 처리시설",
  "20": "자동차관련시설",
  "21": "동물 및 식물관련시설",
  "22": "자원순환관련시설",
  "23": "교정 및 군사시설",
  "24": "방송통신시설",
  "25": "발전시설",
  "26": "묘지관련시설",
  "27": "관광휴게시설",
  "28": "야영장시설",
};

/**
 * 공공데이터포털 건축물대장 API 호출
 * @param address 조회할 주소
 */
export async function fetchBuildingInfo(address: string): Promise<BuildingInfo | null> {
  const API_KEY = process.env.DATA_GO_KR_API_KEY;

  if (!API_KEY) {
    console.error("DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.");
    return null;
  }

  try {
    // 주소를 지번 주소와 도로명 주소로 분리하여 검색
    const encodedAddress = encodeURIComponent(address);

    // 건축물대장 표제부 조회 API
    const url = `http://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo?serviceKey=${API_KEY}&sigunguCd=&bjdongCd=&platGbCd=0&bun=&ji=&startDate=&endDate=&numOfRows=10&pageNo=1&format=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.response?.body?.items?.item) {
      const item = Array.isArray(data.response.body.items.item)
        ? data.response.body.items.item[0]
        : data.response.body.items.item;

      const mainPurpsCd = item.mainPurpsCd?.substring(0, 5) || "";
      const useInfo = BUILDING_USE_BUSINESS_MATRIX[mainPurpsCd] || null;

      return {
        mgmBldrgstPk: item.mgmBldrgstPk || "",
        bldNm: item.bldNm || "",
        mainPurpsCdNm: item.mainPurpsCdNm || "",
        etcPurps: item.etcPurps || "",
        platPlc: item.platPlc || "",
        newPlatPlc: item.newPlatPlc || "",
        totArea: parseFloat(item.totArea) || 0,
        vlRat: parseFloat(item.vlRat) || 0,
        bcRat: parseFloat(item.bcRat) || 0,
        archArea: parseFloat(item.archArea) || 0,
        grndFlrCnt: parseInt(item.grndFlrCnt) || 0,
        ugrndFlrCnt: parseInt(item.ugrndFlrCnt) || 0,
        mainPurpsCd: item.mainPurpsCd || "",
        strctCdNm: item.strctCdNm || "",
        allowedBusinesses: useInfo?.allowed || [],
        restrictedBusinesses: useInfo?.restricted || [],
      };
    }

    return null;
  } catch (error) {
    console.error("건축물대장 조회 오류:", error);
    return null;
  }
}

/**
 * 건축물 용도와 희망 업종의 적합성 판단
 */
export function checkBusinessCompatibility(
  buildingUseCode: string,
  businessType: string
): {
  compatible: boolean;
  status: "allowed" | "conditional" | "restricted" | "unknown";
  message: string;
  requiresChange: boolean;
} {
  const useCode = buildingUseCode.substring(0, 5);
  const useInfo = BUILDING_USE_BUSINESS_MATRIX[useCode];

  if (!useInfo) {
    return {
      compatible: false,
      status: "unknown",
      message: "해당 건축물 용도에 대한 정보가 부족합니다. 관할 행정청에 문의하세요.",
      requiresChange: false,
    };
  }

  if (useInfo.allowed.includes(businessType)) {
    return {
      compatible: true,
      status: "allowed",
      message: `${useInfo.description} 용도의 건물에서 해당 업종 영업이 가능합니다.`,
      requiresChange: false,
    };
  }

  if (useInfo.restricted.includes(businessType)) {
    return {
      compatible: false,
      status: "restricted",
      message: `현재 건축물 용도(${useInfo.description})에서는 해당 업종 영업이 불가합니다. 용도변경이 필요합니다.`,
      requiresChange: true,
    };
  }

  // allowed도 restricted도 아닌 경우 - 조건부 허용 가능성
  return {
    compatible: true,
    status: "conditional",
    message: `현재 건축물 용도에서 해당 업종 영업 가능 여부는 관할 행정청 확인이 필요합니다.`,
    requiresChange: false,
  };
}

/**
 * 세움터 건축물대장 조회 URL 생성
 */
export function getSeumterUrl(address: string): string {
  return `https://cloud.eais.go.kr/moct/awp/abb01/AWPABB01F01`;
}

/**
 * 정부24 건축물대장 열람 URL 생성
 */
export function getGov24BuildingUrl(): string {
  return "https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=13100000015";
}
