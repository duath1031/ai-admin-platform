/**
 * 기존 하드코딩 템플릿 → DB 마이그레이션 스크립트
 *
 * 실행: npx tsx scripts/migrate-templates-to-db.ts
 *
 * FORM_TEMPLATES (11개)를 FormTemplate DB에 등록
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// lib/document/templates.ts에서 직접 정의 (import 대신 - tsx 호환성)
const FORM_TEMPLATES: Record<string, {
  id: string;
  name: string;
  category: string;
  description: string;
  gov24ServiceKey?: string;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
  }>;
  outputFileName: string;
}> = {
  "통신판매업신고서": {
    id: "form_001",
    name: "통신판매업 신고서",
    category: "사업자/영업",
    description: "온라인 쇼핑몰, 스마트스토어 등 운영 시 필요한 신고서",
    gov24ServiceKey: "통신판매업신고",
    fields: [
      { id: "businessName", label: "상호(법인명)", type: "text", required: true, placeholder: "예: 주식회사 어드미니" },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true, placeholder: "예: 홍길동" },
      { id: "businessNumber", label: "사업자등록번호", type: "text", required: true, placeholder: "000-00-00000" },
      { id: "businessAddress", label: "사업장 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "email", label: "이메일", type: "text", required: true },
      { id: "websiteUrl", label: "인터넷 도메인 주소", type: "text", required: true, placeholder: "예: www.example.com" },
      { id: "hostingProvider", label: "호스팅 서비스 제공자", type: "text", required: false, placeholder: "예: 카페24, 가비아" },
      { id: "mainProducts", label: "취급 품목", type: "textarea", required: true, placeholder: "예: 의류, 잡화, 화장품" },
      { id: "salesMethod", label: "판매방식", type: "select", required: true, options: ["인터넷 쇼핑몰", "SNS 판매", "오픈마켓", "기타"] },
    ],
    outputFileName: "통신판매업신고서_{representativeName}님.pdf",
  },
  "일반음식점영업신고서": {
    id: "form_002",
    name: "일반음식점 영업신고서",
    category: "사업자/영업",
    description: "음식점, 카페 등 개업 시 필요한 영업신고서",
    gov24ServiceKey: "일반음식점영업신고",
    fields: [
      { id: "businessName", label: "업소명", type: "text", required: true },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true },
      { id: "residentNumber", label: "주민등록번호 (앞 6자리)", type: "text", required: true, placeholder: "000000" },
      { id: "businessAddress", label: "영업소 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "businessType", label: "영업의 종류", type: "select", required: true, options: ["일반음식점", "휴게음식점", "제과점"] },
      { id: "floorArea", label: "영업장 면적(㎡)", type: "number", required: true },
      { id: "menuItems", label: "주요 취급 음식", type: "textarea", required: true },
      { id: "hygieneEducationDate", label: "위생교육 이수일", type: "date", required: true },
      { id: "hygieneEducationOrg", label: "위생교육 기관", type: "text", required: true, defaultValue: "한국식품산업협회" },
    ],
    outputFileName: "일반음식점영업신고서_{representativeName}님.pdf",
  },
  "식품제조업영업신고서": {
    id: "form_003",
    name: "식품제조·가공업 영업신고서",
    category: "사업자/영업",
    description: "식품 제조 및 가공업 시작 시 필요한 신고서",
    gov24ServiceKey: "식품제조업영업신고",
    fields: [
      { id: "businessName", label: "업소명", type: "text", required: true },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true },
      { id: "businessNumber", label: "사업자등록번호", type: "text", required: true },
      { id: "businessAddress", label: "제조소 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "productTypes", label: "제조 품목", type: "textarea", required: true },
      { id: "floorArea", label: "제조시설 면적(㎡)", type: "number", required: true },
      { id: "facilities", label: "주요 시설 현황", type: "textarea", required: true },
      { id: "hygieneEducationDate", label: "위생교육 이수일", type: "date", required: true },
    ],
    outputFileName: "식품제조업영업신고서_{representativeName}님.pdf",
  },
  "건축물대장발급신청서": {
    id: "form_010",
    name: "건축물대장 발급 신청서",
    category: "부동산",
    description: "건축물대장 등본/초본 발급 신청",
    gov24ServiceKey: "건축물대장발급",
    fields: [
      { id: "applicantName", label: "신청인 성명", type: "text", required: true },
      { id: "applicantPhone", label: "연락처", type: "phone", required: true },
      { id: "buildingAddress", label: "건축물 소재지", type: "address", required: true },
      { id: "documentType", label: "발급 종류", type: "select", required: true, options: ["표제부", "전체", "일반건축물", "집합건축물(전유부)", "집합건축물(전체)"] },
      { id: "purpose", label: "사용 목적", type: "text", required: true },
      { id: "copies", label: "발급 부수", type: "number", required: true, defaultValue: "1" },
    ],
    outputFileName: "건축물대장발급신청서_{applicantName}님.pdf",
  },
  "사업자등록신청서": {
    id: "form_020",
    name: "사업자등록 신청서",
    category: "세무",
    description: "개인/법인 사업자등록 신청",
    fields: [
      { id: "businessName", label: "상호", type: "text", required: true },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true },
      { id: "residentNumber", label: "주민등록번호", type: "text", required: true },
      { id: "businessAddress", label: "사업장 소재지", type: "address", required: true },
      { id: "homeAddress", label: "자택 주소", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "email", label: "이메일", type: "text", required: true },
      { id: "businessType", label: "업태", type: "text", required: true },
      { id: "businessItem", label: "종목", type: "text", required: true },
      { id: "startDate", label: "개업일", type: "date", required: true },
    ],
    outputFileName: "사업자등록신청서_{representativeName}님.pdf",
  },
  "휴게음식점영업신고서": {
    id: "form_004",
    name: "휴게음식점 영업신고서",
    category: "사업자/영업",
    description: "카페, 제과점, 빵집 등 개업 시 필요한 영업신고서",
    gov24ServiceKey: "휴게음식점영업신고",
    fields: [
      { id: "businessName", label: "업소명", type: "text", required: true },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true },
      { id: "residentNumber", label: "주민등록번호 (앞 6자리)", type: "text", required: true },
      { id: "businessAddress", label: "영업소 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "businessType", label: "영업의 종류", type: "select", required: true, options: ["휴게음식점", "제과점"], defaultValue: "휴게음식점" },
      { id: "floorArea", label: "영업장 면적(㎡)", type: "number", required: true },
      { id: "menuItems", label: "주요 취급 음식", type: "textarea", required: true },
      { id: "hygieneEducationDate", label: "위생교육 이수일", type: "date", required: true },
      { id: "hygieneEducationOrg", label: "위생교육 기관", type: "text", required: true, defaultValue: "한국식품산업협회" },
    ],
    outputFileName: "휴게음식점영업신고서_{representativeName}님.pdf",
  },
  "숙박업영업허가신청서": {
    id: "form_030",
    name: "숙박업 영업허가 신청서",
    category: "사업자/영업",
    description: "호텔, 모텔, 펜션 등 숙박업 영업허가 신청",
    gov24ServiceKey: "숙박업영업허가",
    fields: [
      { id: "businessName", label: "업소명", type: "text", required: true },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true },
      { id: "residentNumber", label: "주민등록번호 (앞 6자리)", type: "text", required: true },
      { id: "businessAddress", label: "영업소 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "businessType", label: "영업 종류", type: "select", required: true, options: ["호텔업", "휴양콘도미니엄업", "일반숙박업", "생활숙박업"] },
      { id: "floorArea", label: "영업장 면적(㎡)", type: "number", required: true },
      { id: "roomCount", label: "객실 수", type: "number", required: true },
      { id: "facilities", label: "주요 시설", type: "textarea", required: true },
      { id: "hygieneEducationDate", label: "위생교육 이수일", type: "date", required: true },
    ],
    outputFileName: "숙박업영업허가신청서_{representativeName}님.pdf",
  },
  "학원설립운영등록신청서": {
    id: "form_040",
    name: "학원 설립·운영 등록 신청서",
    category: "교육/학원",
    description: "학원 설립 및 운영을 위한 등록 신청",
    gov24ServiceKey: "학원설립운영등록",
    fields: [
      { id: "academyName", label: "학원명", type: "text", required: true },
      { id: "representativeName", label: "설립·운영자 성명", type: "text", required: true },
      { id: "residentNumber", label: "주민등록번호 (앞 6자리)", type: "text", required: true },
      { id: "representativeAddress", label: "설립·운영자 주소", type: "address", required: true },
      { id: "academyAddress", label: "학원 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "academyType", label: "학원 종류", type: "select", required: true, options: ["입시·검정·보습", "국제화", "예능(음악·미술)", "직업기술", "독서실", "기타"] },
      { id: "subjects", label: "교습 과목", type: "textarea", required: true },
      { id: "floorArea", label: "시설 면적(㎡)", type: "number", required: true },
      { id: "capacity", label: "정원", type: "number", required: true },
      { id: "teacherCount", label: "강사 수", type: "number", required: true },
    ],
    outputFileName: "학원설립운영등록신청서_{representativeName}님.pdf",
  },
  "미용업신고서": {
    id: "form_050",
    name: "미용업 신고서",
    category: "사업자/영업",
    description: "헤어샵, 네일샵, 피부관리샵 등 미용업 신고",
    gov24ServiceKey: "미용업신고",
    fields: [
      { id: "businessName", label: "업소명", type: "text", required: true },
      { id: "representativeName", label: "대표자 성명", type: "text", required: true },
      { id: "residentNumber", label: "주민등록번호 (앞 6자리)", type: "text", required: true },
      { id: "businessAddress", label: "영업소 소재지", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "beautyType", label: "미용 종류", type: "select", required: true, options: ["일반미용", "피부미용", "네일미용", "화장미용", "종합미용"] },
      { id: "floorArea", label: "영업장 면적(㎡)", type: "number", required: true },
      { id: "workerCount", label: "종사자 수", type: "number", required: true, defaultValue: "1" },
      { id: "licenseNumber", label: "미용사 면허번호", type: "text", required: true },
      { id: "hygieneEducationDate", label: "위생교육 이수일", type: "date", required: true },
    ],
    outputFileName: "미용업신고서_{representativeName}님.pdf",
  },
  "옥외광고물표시허가신청서": {
    id: "form_060",
    name: "옥외광고물 표시 허가 신청서",
    category: "광고/간판",
    description: "간판, 현수막, 옥상광고 등 옥외광고물 설치 허가",
    gov24ServiceKey: "옥외광고물표시허가",
    fields: [
      { id: "applicantName", label: "신청인 성명(상호)", type: "text", required: true },
      { id: "representativeName", label: "대표자 (법인인 경우)", type: "text", required: false },
      { id: "applicantAddress", label: "신청인 주소", type: "address", required: true },
      { id: "phone", label: "전화번호", type: "phone", required: true },
      { id: "adType", label: "광고물 종류", type: "select", required: true, options: ["가로형 간판", "세로형 간판", "돌출 간판", "옥상 간판", "지주 이용 간판", "현수막", "애드벌룬", "벽보", "기타"] },
      { id: "adLocation", label: "설치 장소", type: "address", required: true },
      { id: "adSize", label: "규격 (가로x세로)", type: "text", required: true },
      { id: "adContent", label: "광고 내용", type: "textarea", required: true },
      { id: "displayPeriod", label: "표시 기간", type: "text", required: true },
      { id: "quantity", label: "수량", type: "number", required: true, defaultValue: "1" },
    ],
    outputFileName: "옥외광고물표시허가신청서_{applicantName}님.pdf",
  },
};

async function main() {
  console.log("=== 기존 템플릿 → DB 마이그레이션 시작 ===\n");

  let created = 0;
  let skipped = 0;

  for (const [code, template] of Object.entries(FORM_TEMPLATES)) {
    // 이미 존재하는지 확인
    const existing = await prisma.formTemplate.findUnique({ where: { code } });
    if (existing) {
      console.log(`[SKIP] ${code} - 이미 존재 (id: ${existing.id})`);
      skipped++;
      continue;
    }

    await prisma.formTemplate.create({
      data: {
        code,
        name: template.name,
        category: template.category,
        description: template.description,
        fields: JSON.stringify(template.fields),
        gov24ServiceKey: template.gov24ServiceKey || null,
        outputFileName: template.outputFileName,
        status: "active",
        // docxStoragePath는 null - 레거시 officialTemplates가 처리
      },
    });

    console.log(`[OK] ${code} → ${template.name}`);
    created++;
  }

  console.log(`\n=== 마이그레이션 완료: ${created}건 생성, ${skipped}건 스킵 ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
