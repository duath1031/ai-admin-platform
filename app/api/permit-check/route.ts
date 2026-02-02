export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchLandUse } from "@/lib/landUseApi";

// 용도지역별 허용 업종 매핑
const ZONE_BUSINESS_MATRIX: Record<string, Record<string, { allowed: boolean; conditions?: string }>> = {
  "제1종전용주거지역": {
    restaurant: { allowed: false },
    cafe: { allowed: false },
    retail: { allowed: false },
    office: { allowed: false },
    manufacturing: { allowed: false },
    warehouse: { allowed: false },
    medical: { allowed: true, conditions: "의원급 이하" },
    education: { allowed: true, conditions: "유치원, 초등학교" },
    lodging: { allowed: false },
    sports: { allowed: false },
  },
  "제2종전용주거지역": {
    restaurant: { allowed: false },
    cafe: { allowed: false },
    retail: { allowed: true, conditions: "근린생활시설 내 소규모" },
    office: { allowed: true, conditions: "바닥면적 500㎡ 미만" },
    manufacturing: { allowed: false },
    warehouse: { allowed: false },
    medical: { allowed: true, conditions: "의원급" },
    education: { allowed: true },
    lodging: { allowed: false },
    sports: { allowed: true, conditions: "실내체육시설" },
  },
  "제1종일반주거지역": {
    restaurant: { allowed: true, conditions: "바닥면적 300㎡ 미만" },
    cafe: { allowed: true, conditions: "바닥면적 300㎡ 미만" },
    retail: { allowed: true, conditions: "바닥면적 1000㎡ 미만" },
    office: { allowed: true, conditions: "바닥면적 1000㎡ 미만" },
    manufacturing: { allowed: false },
    warehouse: { allowed: false },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: false },
    sports: { allowed: true },
  },
  "제2종일반주거지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: false },
    warehouse: { allowed: true, conditions: "바닥면적 300㎡ 미만" },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true, conditions: "다중생활시설" },
    sports: { allowed: true },
  },
  "제3종일반주거지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: false },
    warehouse: { allowed: true, conditions: "바닥면적 500㎡ 미만" },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true },
    sports: { allowed: true },
  },
  "준주거지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: true, conditions: "도시형공장, 첨단업종" },
    warehouse: { allowed: true },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true },
    sports: { allowed: true },
  },
  "일반상업지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: true, conditions: "도시형공장" },
    warehouse: { allowed: true },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true },
    sports: { allowed: true },
  },
  "근린상업지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: true, conditions: "도시형공장" },
    warehouse: { allowed: true },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true },
    sports: { allowed: true },
  },
  "중심상업지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: false },
    warehouse: { allowed: true, conditions: "지하층" },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true },
    sports: { allowed: true },
  },
  "준공업지역": {
    restaurant: { allowed: true },
    cafe: { allowed: true },
    retail: { allowed: true },
    office: { allowed: true },
    manufacturing: { allowed: true },
    warehouse: { allowed: true },
    medical: { allowed: true },
    education: { allowed: true },
    lodging: { allowed: true, conditions: "숙박시설 제한적" },
    sports: { allowed: true },
  },
  "일반공업지역": {
    restaurant: { allowed: true, conditions: "근린생활시설 내" },
    cafe: { allowed: true, conditions: "근린생활시설 내" },
    retail: { allowed: true, conditions: "근린생활시설 내" },
    office: { allowed: true },
    manufacturing: { allowed: true },
    warehouse: { allowed: true },
    medical: { allowed: true, conditions: "의원급" },
    education: { allowed: true, conditions: "직업훈련시설" },
    lodging: { allowed: false },
    sports: { allowed: true },
  },
  "전용공업지역": {
    restaurant: { allowed: true, conditions: "기숙사 부대시설" },
    cafe: { allowed: false },
    retail: { allowed: false },
    office: { allowed: true, conditions: "공장 부속시설" },
    manufacturing: { allowed: true },
    warehouse: { allowed: true },
    medical: { allowed: false },
    education: { allowed: false },
    lodging: { allowed: false },
    sports: { allowed: false },
  },
  "녹지지역": {
    restaurant: { allowed: true, conditions: "휴게음식점, 바닥면적 제한" },
    cafe: { allowed: true, conditions: "바닥면적 제한" },
    retail: { allowed: true, conditions: "바닥면적 제한" },
    office: { allowed: false },
    manufacturing: { allowed: false },
    warehouse: { allowed: false },
    medical: { allowed: true, conditions: "의원급" },
    education: { allowed: true },
    lodging: { allowed: true, conditions: "농어촌민박" },
    sports: { allowed: true, conditions: "야외체육시설" },
  },
};

// 용도지역별 건폐율/용적률
const ZONE_LIMITS: Record<string, { buildingCoverage: number; floorAreaRatio: number }> = {
  "제1종전용주거지역": { buildingCoverage: 50, floorAreaRatio: 100 },
  "제2종전용주거지역": { buildingCoverage: 50, floorAreaRatio: 150 },
  "제1종일반주거지역": { buildingCoverage: 60, floorAreaRatio: 200 },
  "제2종일반주거지역": { buildingCoverage: 60, floorAreaRatio: 250 },
  "제3종일반주거지역": { buildingCoverage: 50, floorAreaRatio: 300 },
  "준주거지역": { buildingCoverage: 70, floorAreaRatio: 500 },
  "일반상업지역": { buildingCoverage: 80, floorAreaRatio: 1300 },
  "근린상업지역": { buildingCoverage: 70, floorAreaRatio: 900 },
  "중심상업지역": { buildingCoverage: 90, floorAreaRatio: 1500 },
  "준공업지역": { buildingCoverage: 70, floorAreaRatio: 400 },
  "일반공업지역": { buildingCoverage: 70, floorAreaRatio: 350 },
  "전용공업지역": { buildingCoverage: 70, floorAreaRatio: 300 },
  "녹지지역": { buildingCoverage: 20, floorAreaRatio: 100 },
};

// 업종별 한국어 이름
const BUSINESS_NAMES: Record<string, string> = {
  restaurant: "일반음식점",
  cafe: "카페/휴게음식점",
  retail: "소매점/판매시설",
  office: "사무실/업무시설",
  manufacturing: "제조업/공장",
  warehouse: "창고시설",
  medical: "의료시설",
  education: "교육시설/학원",
  lodging: "숙박시설",
  sports: "체육시설",
  construction: "건설업",
  realestate: "부동산중개업",
  transport: "화물운송업",
  passenger: "여객운송업",
  beauty: "미용업/이용업",
  pharmacy: "약국",
  petshop: "동물병원/펫샵",
  daycare: "어린이집",
  elderly: "노인요양시설",
  recycling: "폐기물처리업",
};

// 업종별 관계 법령 정보
const BUSINESS_LAWS: Record<string, { law: string; article: string; summary: string; hasDiscretion: boolean }[]> = {
  restaurant: [
    {
      law: "식품위생법",
      article: "제36조, 제37조 (영업의 허가 등)",
      summary: "일반음식점 영업은 시·군·구청장에게 신고하여야 함. 시설기준은 식품위생법 시행규칙 별표14 참조",
      hasDiscretion: false,
    },
    {
      law: "국토의 계획 및 이용에 관한 법률",
      article: "제76조 (용도지역에서의 건축물의 건축 제한)",
      summary: "용도지역별로 건축할 수 있는 건축물의 종류가 제한됨",
      hasDiscretion: true,
    },
  ],
  cafe: [
    {
      law: "식품위생법",
      article: "제36조, 제37조 (영업의 허가 등)",
      summary: "휴게음식점 영업은 시·군·구청장에게 신고하여야 함",
      hasDiscretion: false,
    },
    {
      law: "건축법 시행령",
      article: "별표1 (용도별 건축물의 종류)",
      summary: "휴게음식점은 제2종 근린생활시설에 해당 (바닥면적 300㎡ 미만)",
      hasDiscretion: false,
    },
  ],
  retail: [
    {
      law: "유통산업발전법",
      article: "제8조 (대규모점포등의 개설등록)",
      summary: "매장면적 3,000㎡ 이상인 경우 대규모점포 개설등록 필요",
      hasDiscretion: true,
    },
    {
      law: "국토의 계획 및 이용에 관한 법률",
      article: "제76조 (용도지역에서의 건축물의 건축 제한)",
      summary: "용도지역별 판매시설 규모 제한 적용",
      hasDiscretion: true,
    },
  ],
  office: [
    {
      law: "건축법",
      article: "제11조 (건축허가), 제14조 (건축신고)",
      summary: "업무시설 신축·증축 시 건축허가 또는 신고 필요",
      hasDiscretion: false,
    },
    {
      law: "주차장법",
      article: "제19조 (부설주차장의 설치)",
      summary: "연면적 기준 부설주차장 확보 의무",
      hasDiscretion: false,
    },
  ],
  manufacturing: [
    {
      law: "산업집적활성화 및 공장설립에 관한 법률",
      article: "제13조 (공장설립등의 승인)",
      summary: "공장 건축면적 500㎡ 이상 시 공장설립승인 필요. 도시형공장 특례 적용 가능",
      hasDiscretion: true,
    },
    {
      law: "환경영향평가법",
      article: "제22조, 제43조",
      summary: "일정 규모 이상 공장 설립 시 환경영향평가 또는 소규모환경영향평가 필요",
      hasDiscretion: true,
    },
    {
      law: "대기환경보전법, 물환경보전법",
      article: "배출시설 설치 허가·신고",
      summary: "오염물질 배출시설 설치 시 환경부 허가 또는 신고 필요",
      hasDiscretion: false,
    },
  ],
  warehouse: [
    {
      law: "건축법",
      article: "제11조, 별표1",
      summary: "창고시설은 건축법상 창고시설(위험물 저장 및 처리 시설 제외)에 해당",
      hasDiscretion: false,
    },
    {
      law: "물류시설의 개발 및 운영에 관한 법률",
      article: "제21조의2 (물류창고업의 등록)",
      summary: "타인의 물건 보관 영업 시 물류창고업 등록 필요",
      hasDiscretion: false,
    },
  ],
  medical: [
    {
      law: "의료법",
      article: "제33조 (개설 등)",
      summary: "의료기관 개설은 시·도지사 허가(병원급) 또는 신고(의원급) 필요",
      hasDiscretion: true,
    },
    {
      law: "의료법 시행규칙",
      article: "별표3, 별표4 (시설기준)",
      summary: "의료기관 종류별 시설·장비 기준 충족 필요",
      hasDiscretion: false,
    },
  ],
  education: [
    {
      law: "학원의 설립·운영 및 과외교습에 관한 법률",
      article: "제6조 (학원의 설립·운영의 등록)",
      summary: "학원 설립 시 교육감에게 등록. 시설기준 및 강사자격 충족 필요",
      hasDiscretion: false,
    },
    {
      law: "교육환경 보호에 관한 법률",
      article: "제8조, 제9조",
      summary: "학교환경위생정화구역 내 유해업소 금지",
      hasDiscretion: true,
    },
  ],
  lodging: [
    {
      law: "공중위생관리법",
      article: "제3조, 제4조 (영업신고)",
      summary: "숙박업 영업 시 시·군·구청장에게 신고. 시설기준 충족 필요",
      hasDiscretion: false,
    },
    {
      law: "관광진흥법",
      article: "제3조, 제4조 (관광숙박업 등록)",
      summary: "호텔업, 휴양콘도업 등은 문화체육관광부장관 또는 시·도지사 등록",
      hasDiscretion: true,
    },
    {
      law: "건축법 시행령",
      article: "별표1 제15호",
      summary: "숙박시설 건축물 용도 분류 및 제한사항",
      hasDiscretion: false,
    },
  ],
  sports: [
    {
      law: "체육시설의 설치·이용에 관한 법률",
      article: "제10조, 제19조, 제20조",
      summary: "체육시설업 종류에 따라 신고 또는 등록 필요. 시설기준 충족 의무",
      hasDiscretion: false,
    },
    {
      law: "학교보건법",
      article: "제6조 (학교환경위생정화구역)",
      summary: "당구장, 무도학원 등은 학교정화구역 내 설치 제한",
      hasDiscretion: true,
    },
  ],
  construction: [
    {
      law: "건설산업기본법",
      article: "제9조 (건설업의 등록 등)",
      summary: "건설업을 영위하려면 업종별로 국토교통부장관에게 등록해야 함. 기술인력, 자본금, 시설·장비 요건 충족 필요",
      hasDiscretion: false,
    },
    {
      law: "건설산업기본법 시행령",
      article: "별표2 (건설업의 업종과 업종별 업무내용)",
      summary: "종합건설업(토건, 토목, 건축, 산업환경설비, 조경) 및 전문건설업 29개 업종으로 구분",
      hasDiscretion: false,
    },
    {
      law: "건설기술 진흥법",
      article: "제26조 (건설기술인의 배치)",
      summary: "건설공사에 적정한 기술인력 배치 의무",
      hasDiscretion: false,
    },
    {
      law: "국가를 당사자로 하는 계약에 관한 법률",
      article: "제7조 (계약의 방법)",
      summary: "국가·지방자치단체 발주공사 참여 시 적용. 입찰참가자격, 실적 요건 등",
      hasDiscretion: true,
    },
  ],
  realestate: [
    {
      law: "공인중개사법",
      article: "제9조 (중개사무소의 개설등록)",
      summary: "중개업을 하려면 시·군·구청장에게 중개사무소 개설등록 필요. 공인중개사 자격 및 실무교육 이수 요건",
      hasDiscretion: false,
    },
    {
      law: "공인중개사법",
      article: "제13조 (겸업제한)",
      summary: "중개업 외 다른 업무 겸업 시 제한사항 있음",
      hasDiscretion: false,
    },
    {
      law: "공인중개사법 시행규칙",
      article: "제7조 (사무소의 설치기준)",
      summary: "중개사무소 시설기준: 건물 내 구획된 공간, 상업용 건물 등",
      hasDiscretion: true,
    },
  ],
  transport: [
    {
      law: "화물자동차 운수사업법",
      article: "제3조 (화물자동차 운송사업의 허가 등)",
      summary: "화물자동차 운송사업 영위 시 국토교통부장관 허가 필요. 차고지, 자본금, 차량 요건",
      hasDiscretion: true,
    },
    {
      law: "화물자동차 운수사업법",
      article: "제24조 (화물자동차 운송주선사업의 허가)",
      summary: "주선사업(용달, 포장이사 등) 허가 요건. 자본금 5천만원 이상, 사무실 등",
      hasDiscretion: true,
    },
    {
      law: "물류정책기본법",
      article: "제38조 (국제물류주선업의 등록)",
      summary: "국제물류주선업 영위 시 등록 필요. 자본금 3억원 이상",
      hasDiscretion: false,
    },
  ],
  passenger: [
    {
      law: "여객자동차 운수사업법",
      article: "제4조 (면허 등)",
      summary: "여객자동차 운송사업 영위 시 국토교통부장관 또는 시·도지사 면허 필요",
      hasDiscretion: true,
    },
    {
      law: "여객자동차 운수사업법",
      article: "제28조 (자동차대여사업의 등록)",
      summary: "렌터카 사업은 시·도지사 등록. 자본금 1억원 이상, 차량 10대 이상 등",
      hasDiscretion: false,
    },
  ],
  beauty: [
    {
      law: "공중위생관리법",
      article: "제3조, 제4조 (영업신고)",
      summary: "미용업·이용업 영위 시 시·군·구청장에게 신고. 면허 소지자 배치 의무",
      hasDiscretion: false,
    },
    {
      law: "공중위생관리법 시행규칙",
      article: "별표1 (시설 및 설비기준)",
      summary: "영업장 면적, 조명, 환기, 소독장비 등 시설기준 충족 필요",
      hasDiscretion: false,
    },
  ],
  pharmacy: [
    {
      law: "약사법",
      article: "제20조 (약국개설등록)",
      summary: "약국 개설 시 시·도지사에게 등록. 약사 또는 한약사 자격 필요",
      hasDiscretion: false,
    },
    {
      law: "약사법",
      article: "제21조 (약국 등의 시설기준)",
      summary: "약국 시설기준: 조제실, 의약품 보관시설 등",
      hasDiscretion: false,
    },
    {
      law: "의료기기법",
      article: "제17조 (의료기기 판매업 신고)",
      summary: "의료기기 판매 시 별도 신고 필요",
      hasDiscretion: false,
    },
  ],
  petshop: [
    {
      law: "수의사법",
      article: "제17조 (동물병원의 개설)",
      summary: "동물병원 개설 시 시·도지사에게 신고. 수의사 자격 및 시설기준 충족",
      hasDiscretion: false,
    },
    {
      law: "동물보호법",
      article: "제33조 (영업의 등록)",
      summary: "동물판매업, 동물미용업, 동물위탁관리업 등은 시·군·구청장 등록",
      hasDiscretion: false,
    },
    {
      law: "동물보호법 시행규칙",
      article: "별표10 (등록대상 동물관련영업의 시설 및 인력 기준)",
      summary: "시설면적, 위생관리, 인력배치 기준 충족 필요",
      hasDiscretion: true,
    },
  ],
  daycare: [
    {
      law: "영유아보육법",
      article: "제13조 (어린이집의 설치)",
      summary: "어린이집 설치 시 시·군·구청장 인가 필요. 정원별 시설기준 충족",
      hasDiscretion: true,
    },
    {
      law: "영유아보육법 시행규칙",
      article: "별표1 (어린이집의 설치기준)",
      summary: "보육실, 조리실, 놀이터 등 시설기준 및 보육교직원 배치기준",
      hasDiscretion: false,
    },
    {
      law: "건축법 시행령",
      article: "별표1 제10호 (교육연구시설)",
      summary: "어린이집은 제1종 근린생활시설 또는 노유자시설에 해당",
      hasDiscretion: false,
    },
  ],
  elderly: [
    {
      law: "노인복지법",
      article: "제35조 (노인의료복지시설의 설치)",
      summary: "노인요양시설, 노인요양공동생활가정 설치 시 시·군·구청장 허가 필요",
      hasDiscretion: true,
    },
    {
      law: "노인장기요양보험법",
      article: "제31조 (장기요양기관의 지정)",
      summary: "장기요양기관 지정 시 별도 요건 충족. 인력기준, 시설기준 등",
      hasDiscretion: true,
    },
    {
      law: "노인복지법 시행규칙",
      article: "별표4 (시설의 기준)",
      summary: "침실, 요양보호사실, 사무실, 프로그램실 등 시설기준",
      hasDiscretion: false,
    },
  ],
  recycling: [
    {
      law: "폐기물관리법",
      article: "제25조 (폐기물처리업의 허가 등)",
      summary: "폐기물 수집·운반업, 중간처리업, 최종처리업은 시·도지사 허가 필요",
      hasDiscretion: true,
    },
    {
      law: "폐기물관리법 시행규칙",
      article: "별표9 (폐기물처리업의 시설·장비 및 기술능력의 기준)",
      summary: "업종별 차량, 장비, 시설, 기술인력 기준 충족",
      hasDiscretion: false,
    },
    {
      law: "자원의 절약과 재활용촉진에 관한 법률",
      article: "제46조 (재활용가능자원의 수집·운반·보관업 등록)",
      summary: "재활용가능자원 수집 등 영업은 시·군·구청장 등록",
      hasDiscretion: false,
    },
    {
      law: "환경영향평가법",
      article: "제43조 (소규모 환경영향평가)",
      summary: "폐기물처리시설 설치 시 환경영향평가 대상 여부 검토 필요",
      hasDiscretion: true,
    },
  ],
};

// 용도지역 제한이 적용되지 않는 업종 (사무실 기반)
const OFFICE_BASED_BUSINESSES = ['construction', 'realestate', 'transport', 'passenger', 'recycling'];

// 근린생활시설 업종
const NEIGHBORHOOD_BUSINESSES = ['beauty', 'pharmacy', 'petshop'];

// 사회복지시설 업종
const WELFARE_BUSINESSES = ['daycare', 'elderly'];

// 진단 점수 계산
function calculateScore(zone: string, businessType: string): {
  score: number;
  grade: string;
  analysis: { category: string; status: "pass" | "warning" | "fail"; description: string; relatedLaw?: string }[];
  recommendations: string[];
  legalBasis: { law: string; article: string; summary: string }[];
  hasDiscretion: boolean;
} {
  const zoneMatrix = ZONE_BUSINESS_MATRIX[zone];
  let businessInfo = zoneMatrix?.[businessType];
  const analysis: { category: string; status: "pass" | "warning" | "fail"; description: string; relatedLaw?: string }[] = [];
  const recommendations: string[] = [];
  let score = 0;

  // 관계 법령 정보 조회
  const businessLaws = BUSINESS_LAWS[businessType] || [];
  const legalBasis = businessLaws.map(({ law, article, summary }) => ({ law, article, summary }));

  // 사무실 기반 업종은 사무실 허용 여부로 판단
  if (OFFICE_BASED_BUSINESSES.includes(businessType)) {
    businessInfo = zoneMatrix?.['office'];
  }

  // 근린생활시설 업종은 retail 허용 여부로 판단
  if (NEIGHBORHOOD_BUSINESSES.includes(businessType)) {
    businessInfo = zoneMatrix?.['retail'];
  }

  // 사회복지시설은 education 허용 여부와 유사하게 판단
  if (WELFARE_BUSINESSES.includes(businessType)) {
    businessInfo = zoneMatrix?.['education'];
  }

  // 재량 여부 판단 - 조건부 허용이거나 법령에 재량 규정이 있는 경우
  let hasDiscretion = businessInfo?.conditions ? true : false;
  if (businessLaws.some(law => law.hasDiscretion)) {
    hasDiscretion = true;
  }

  // 1. 용도지역 적합성 (40점)
  // 사무실 기반 업종은 별도 설명
  const isOfficeBased = OFFICE_BASED_BUSINESSES.includes(businessType);
  const isNeighborhood = NEIGHBORHOOD_BUSINESSES.includes(businessType);
  const isWelfare = WELFARE_BUSINESSES.includes(businessType);

  if (businessInfo?.allowed) {
    if (businessInfo.conditions) {
      score += 30;
      let description = `조건부 허용: ${businessInfo.conditions}`;
      if (isOfficeBased) {
        description = `${BUSINESS_NAMES[businessType]}은 사무실 설치가 가능한 지역입니다. 조건: ${businessInfo.conditions}`;
      } else if (isNeighborhood) {
        description = `${BUSINESS_NAMES[businessType]}은 근린생활시설로 조건부 허용됩니다. 조건: ${businessInfo.conditions}`;
      } else if (isWelfare) {
        description = `${BUSINESS_NAMES[businessType]}은 노유자시설/교육시설로 조건부 허용됩니다. 조건: ${businessInfo.conditions}`;
      }
      analysis.push({
        category: "용도지역 적합성",
        status: "warning",
        description,
        relatedLaw: "국토의 계획 및 이용에 관한 법률 제76조",
      });
      recommendations.push(`${businessInfo.conditions} 조건을 충족하는지 확인하세요.`);
    } else {
      score += 40;
      let description = `${zone}에서 ${BUSINESS_NAMES[businessType]} 영업이 허용됩니다.`;
      if (isOfficeBased) {
        description = `${zone}에서 사무실 설치가 가능하므로 ${BUSINESS_NAMES[businessType]} 등록이 가능합니다. 단, 별도 등록/허가 요건 충족 필요`;
      } else if (isNeighborhood) {
        description = `${zone}에서 ${BUSINESS_NAMES[businessType]}은 근린생활시설로 허용됩니다.`;
      } else if (isWelfare) {
        description = `${zone}에서 ${BUSINESS_NAMES[businessType]} 설치가 허용됩니다. 관할 행정청 인가/허가 필요`;
      }
      analysis.push({
        category: "용도지역 적합성",
        status: "pass",
        description,
        relatedLaw: "국토의 계획 및 이용에 관한 법률 제76조",
      });
    }
  } else {
    score += 0;
    let description = `${zone}에서는 ${BUSINESS_NAMES[businessType]} 영업이 원칙적으로 불가합니다.`;
    if (isOfficeBased) {
      description = `${zone}에서는 사무실 설치가 제한되어 ${BUSINESS_NAMES[businessType]} 사무소 개설이 어렵습니다.`;
    }
    analysis.push({
      category: "용도지역 적합성",
      status: "fail",
      description,
      relatedLaw: "국토의 계획 및 이용에 관한 법률 제76조",
    });
    recommendations.push("다른 위치를 검토하거나 용도변경 가능성을 확인하세요.");
    hasDiscretion = true; // 불허 시 용도변경 등 재량적 판단 필요
  }

  // 2. 건축물 요건 (20점) - 용도지역 기반 결정적 점수
  // 상업/준공업 지역은 건축물 용도 유연성이 높음
  const flexibleZones = ['일반상업지역', '근린상업지역', '중심상업지역', '준공업지역', '준주거지역'];
  const moderateZones = ['제2종일반주거지역', '제3종일반주거지역'];
  let buildingScore = 15;
  if (flexibleZones.some(z => zone.includes(z))) {
    buildingScore = 20;
  } else if (moderateZones.some(z => zone.includes(z))) {
    buildingScore = 17;
  }
  score += buildingScore;
  if (buildingScore >= 18) {
    analysis.push({
      category: "건축물 용도",
      status: "pass",
      description: "해당 용도로 사용 가능한 건축물 유형입니다.",
      relatedLaw: "건축법 시행령 별표1 (용도별 건축물의 종류)",
    });
  } else {
    analysis.push({
      category: "건축물 용도",
      status: "warning",
      description: "건축물 용도변경이 필요할 수 있습니다.",
      relatedLaw: "건축법 제19조 (용도변경)",
    });
    recommendations.push("건축물대장을 확인하여 현재 용도를 파악하세요.");
    hasDiscretion = true;
  }

  // 3. 인허가 요건 (20점) - 업종별 맞춤 분석
  // 업종별 인허가 유형 설명
  const permitTypeDescriptions: Record<string, { type: string; authority: string; difficulty: string }> = {
    restaurant: { type: "영업신고", authority: "시·군·구청", difficulty: "보통" },
    cafe: { type: "영업신고", authority: "시·군·구청", difficulty: "보통" },
    retail: { type: "영업신고/등록", authority: "시·군·구청", difficulty: "보통" },
    office: { type: "사업자등록", authority: "세무서", difficulty: "쉬움" },
    manufacturing: { type: "공장설립승인", authority: "시·군·구청", difficulty: "어려움" },
    warehouse: { type: "등록", authority: "시·군·구청", difficulty: "보통" },
    medical: { type: "개설신고/허가", authority: "시·도", difficulty: "어려움" },
    education: { type: "등록", authority: "교육청", difficulty: "보통" },
    lodging: { type: "영업신고/등록", authority: "시·군·구청", difficulty: "보통" },
    sports: { type: "신고/등록", authority: "시·군·구청", difficulty: "보통" },
    construction: { type: "건설업 등록", authority: "국토교통부/시·도", difficulty: "어려움" },
    realestate: { type: "중개사무소 개설등록", authority: "시·군·구청", difficulty: "보통" },
    transport: { type: "운송사업 허가", authority: "국토교통부/시·도", difficulty: "어려움" },
    passenger: { type: "면허/등록", authority: "국토교통부/시·도", difficulty: "어려움" },
    beauty: { type: "영업신고", authority: "시·군·구청", difficulty: "쉬움" },
    pharmacy: { type: "개설등록", authority: "시·도", difficulty: "보통" },
    petshop: { type: "등록/신고", authority: "시·군·구청", difficulty: "보통" },
    daycare: { type: "설치 인가", authority: "시·군·구청", difficulty: "어려움" },
    elderly: { type: "설치 허가", authority: "시·군·구청", difficulty: "어려움" },
    recycling: { type: "허가", authority: "시·도", difficulty: "어려움" },
  };

  const permitInfo = permitTypeDescriptions[businessType] || { type: "인허가", authority: "관할 행정청", difficulty: "보통" };

  // 인허가 난이도에 따라 확정적으로 점수 결정
  const permitDifficultyScores: Record<string, number> = {
    "쉬움": 19,
    "보통": 15,
    "어려움": 12
  };
  const permitScore = permitDifficultyScores[permitInfo.difficulty] || 15;
  score += permitScore;

  if (permitScore >= 17 || permitInfo.difficulty === "쉬움") {
    analysis.push({
      category: "인허가 절차",
      status: "pass",
      description: `${BUSINESS_NAMES[businessType]}은 ${permitInfo.authority}에 ${permitInfo.type}가 필요합니다. 일반적인 절차로 진행 가능합니다.`,
      relatedLaw: businessLaws[0]?.law || "관계 법령",
    });
  } else if (permitScore >= 13 || permitInfo.difficulty === "보통") {
    analysis.push({
      category: "인허가 절차",
      status: "warning",
      description: `${BUSINESS_NAMES[businessType]}은 ${permitInfo.authority}에 ${permitInfo.type}가 필요합니다. 시설기준, 인력요건 등 사전 확인 필요`,
      relatedLaw: businessLaws[0]?.law || "관계 법령",
    });
    recommendations.push(`${permitInfo.authority} 담당부서에 사전 상담하세요.`);
    hasDiscretion = true;
  } else {
    analysis.push({
      category: "인허가 절차",
      status: "fail",
      description: `${BUSINESS_NAMES[businessType]}은 ${permitInfo.authority}에 ${permitInfo.type}가 필요하며, 복잡한 요건 검토가 필요합니다.`,
      relatedLaw: businessLaws[0]?.law || "관계 법령",
    });
    recommendations.push("전문 행정사를 통한 인허가 대행을 권장합니다.");
    hasDiscretion = true;
  }

  // 4. 주변 환경 (20점) - 업종별 환경 민감도에 따라 확정적으로 점수 결정
  // 학교보건법, 청소년보호법 등 이격거리 규정이 엄격한 업종
  const highEnvRestrictionTypes = ['lodging', 'sports', 'manufacturing', 'recycling'];
  // 환경 규제가 보통인 업종
  const mediumEnvRestrictionTypes = ['restaurant', 'cafe', 'medical', 'petshop'];
  // 환경 규제가 적은 업종
  const lowEnvRestrictionTypes = ['office', 'retail', 'education', 'realestate', 'beauty'];

  let envScore = 16; // 기본 점수
  if (lowEnvRestrictionTypes.includes(businessType)) {
    envScore = 19;
  } else if (mediumEnvRestrictionTypes.includes(businessType)) {
    envScore = 16;
  } else if (highEnvRestrictionTypes.includes(businessType)) {
    envScore = 13;
  }
  score += envScore;
  if (envScore >= 18) {
    analysis.push({
      category: "주변 환경",
      status: "pass",
      description: "주변 환경이 해당 업종에 적합합니다.",
      relatedLaw: "학교보건법, 청소년보호법",
    });
  } else if (envScore >= 14) {
    analysis.push({
      category: "주변 환경",
      status: "warning",
      description: "학교, 주거지 인접 여부 확인이 필요합니다.",
      relatedLaw: "학교보건법 제6조, 청소년보호법 제32조",
    });
    recommendations.push("학교보건법, 청소년보호법 등 이격거리 규정을 확인하세요.");
    hasDiscretion = true;
  } else {
    analysis.push({
      category: "주변 환경",
      status: "fail",
      description: "주변 환경으로 인한 제한이 있을 수 있습니다.",
      relatedLaw: "학교보건법, 청소년보호법, 교육환경 보호에 관한 법률",
    });
    hasDiscretion = true;
  }

  // 등급 산정
  let grade: string;
  if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  // 공통 권장사항
  if (recommendations.length === 0) {
    recommendations.push("사업자등록 전 관할 세무서에 업종 확인을 권장합니다.");
  }
  recommendations.push("실제 인허가 진행 시 최신 법령과 조례를 확인하세요.");

  // 재량적 판단 사항이 있는 경우 전문가 상담 권유 추가
  if (hasDiscretion) {
    recommendations.push("본 진단에는 행정청의 재량이 개입되는 사항이 포함되어 있어, 전문 행정사 상담을 권장드립니다.");
  }

  return { score, grade, analysis, recommendations, legalBasis, hasDiscretion };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { address, businessType } = body;

    if (!address || !businessType) {
      return NextResponse.json(
        { error: "주소와 업종을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    // V-World API로 실제 용도지역 조회
    const landUseResult = await searchLandUse(address);
    let zone: string | null = null;
    let zoneSource = "조회실패";

    if (landUseResult.success && landUseResult.zoneInfo && landUseResult.zoneInfo.length > 0) {
      zone = landUseResult.zoneInfo[0].name;
      zoneSource = "V-World API";
      console.log(`[Permit-Check] 용도지역 조회 성공: ${zone}`);
    } else {
      console.warn(`[Permit-Check] 용도지역 조회 실패: ${landUseResult.error || "알 수 없는 오류"}`);
    }

    // 용도지역 조회 실패 시: 잘못된 기본값 대신 정직한 오류 반환
    if (!zone) {
      return NextResponse.json({
        score: 0,
        grade: "조회불가",
        zoneInfo: {
          zone: "조회실패",
          zoneSource: "조회실패",
          buildingCoverage: 0,
          floorAreaRatio: 0,
          allZones: [],
          error: landUseResult.error || "토지이용계획 정보를 조회할 수 없습니다.",
          suggestion: "정확한 전체 주소(시/도/구/동 포함)를 입력하거나, 토지이음(eum.go.kr)에서 직접 확인해주세요.",
        },
        analysis: [{
          category: "용도지역 확인",
          status: "fail" as const,
          description: "V-World API에서 해당 주소의 용도지역 정보를 조회하지 못했습니다. 정확한 전체 주소(시/도 포함)를 입력해주세요.",
        }],
        recommendations: [
          "정확한 도로명 주소(시/도 포함)를 다시 입력해주세요.",
          "토지이음(eum.go.kr)에서 해당 주소의 용도지역을 직접 확인해주세요.",
        ],
        legalBasis: [],
        hasDiscretion: false,
      });
    }

    const limits = ZONE_LIMITS[zone] || { buildingCoverage: 60, floorAreaRatio: 200 };

    // 진단 수행
    const { score, grade, analysis, recommendations, legalBasis, hasDiscretion } = calculateScore(zone, businessType);

    const result = {
      score,
      grade,
      zoneInfo: {
        zone,
        zoneSource,
        buildingCoverage: limits.buildingCoverage,
        floorAreaRatio: limits.floorAreaRatio,
        allZones: landUseResult.zoneInfo || [],
      },
      analysis,
      recommendations,
      legalBasis,
      hasDiscretion,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Permit check error:", error);
    return NextResponse.json(
      { error: "진단 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
