/**
 * =============================================================================
 * 공식 양식 생성기 라우터
 * =============================================================================
 * 템플릿 키에 따라 해당 공식 양식 생성기 호출
 */

import { createMailOrderSalesReport } from "./mailOrderSalesReport";
import { createRestaurantBusinessReport } from "./restaurantBusinessReport";
import { createBusinessRegistration } from "./businessRegistration";
import { FormData } from "../generator";

// 공식 양식이 지원되는 템플릿 키 목록
export const OFFICIAL_TEMPLATES = [
  "통신판매업신고서",
  "일반음식점영업신고서",
  "사업자등록신청서",
  // 추가 예정
  // "휴게음식점영업신고서",
  // "건축물대장발급신청서",
  // "주류판매업면허신청서",
];

/**
 * 공식 양식으로 문서 생성
 * @returns Buffer if official template exists, null if not
 */
export async function generateOfficialDocx(
  templateKey: string,
  data: FormData
): Promise<Buffer | null> {
  switch (templateKey) {
    case "통신판매업신고서":
      return await createMailOrderSalesReport({
        companyName: String(data.businessName || ""),
        corporateNumber: String(data.corporateNumber || ""),
        companyAddress: String(data.businessAddress || ""),
        companyPhone: String(data.phone || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        representativeAddress: String(data.representativeAddress || data.businessAddress || ""),
        email: String(data.email || ""),
        businessNumber: String(data.businessNumber || ""),
        domainName: String(data.websiteUrl || data.domainName || ""),
        hostServer: String(data.hostingProvider || data.hostServer || "국내"),
        // 판매 방식
        salesMethodInternet: data.salesMethod === "인터넷 쇼핑몰" || data.salesMethodInternet === "true",
        salesMethodTV: data.salesMethodTV === "true",
        salesMethodCatalog: data.salesMethodCatalog === "true",
        salesMethodNewspaper: data.salesMethodNewspaper === "true",
        salesMethodOther: data.salesMethod === "기타" || data.salesMethodOther === "true",
        salesMethodOtherText: String(data.salesMethodOtherText || ""),
        // 취급 품목
        productGeneral: data.productGeneral === "true",
        productEducation: data.productEducation === "true",
        productElectronics: data.productElectronics === "true",
        productComputer: data.productComputer === "true",
        productFurniture: data.productFurniture === "true",
        productHealth: data.productHealth === "true",
        productFashion: data.productFashion === "true" || String(data.mainProducts || "").includes("의류"),
        productLeisure: data.productLeisure === "true",
        productAdult: data.productAdult === "true",
        productAuto: data.productAuto === "true",
        productGiftCard: data.productGiftCard === "true",
        productOther: data.productOther === "true",
        productOtherText: String(data.mainProducts || data.productOtherText || ""),
      });

    case "일반음식점영업신고서":
      return await createRestaurantBusinessReport({
        businessName: String(data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        businessAddress: String(data.businessAddress || ""),
        phone: String(data.phone || ""),
        businessType: String(data.businessType || "일반음식점"),
        floorArea: String(data.floorArea || ""),
        menuItems: String(data.menuItems || ""),
        hygieneEducationDate: String(data.hygieneEducationDate || ""),
        hygieneEducationOrg: String(data.hygieneEducationOrg || "한국식품산업협회"),
      });

    case "사업자등록신청서":
      return await createBusinessRegistration({
        businessName: String(data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        businessAddress: String(data.businessAddress || ""),
        homeAddress: String(data.homeAddress || ""),
        phone: String(data.phone || ""),
        email: String(data.email || ""),
        businessType: String(data.businessType || ""),
        businessItem: String(data.businessItem || ""),
        startDate: String(data.startDate || ""),
      });

    default:
      return null;
  }
}

/**
 * 템플릿이 공식 양식을 지원하는지 확인
 */
export function hasOfficialTemplate(templateKey: string): boolean {
  return OFFICIAL_TEMPLATES.includes(templateKey);
}
