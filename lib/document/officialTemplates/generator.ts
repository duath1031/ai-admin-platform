/**
 * =============================================================================
 * 공식 양식 생성기 라우터
 * =============================================================================
 * 템플릿 키에 따라 해당 공식 양식 생성기 호출
 */

import { createMailOrderSalesReport } from "./mailOrderSalesReport";
import { createRestaurantBusinessReport } from "./restaurantBusinessReport";
import { createBusinessRegistration } from "./businessRegistration";
import { createBuildingLedger } from "./buildingLedger";
import { createAccommodationBusiness } from "./accommodationBusiness";
import { createAcademyRegistration } from "./academyRegistration";
import { createBeautyShopRegistration } from "./beautyShopRegistration";
import { createOutdoorAdvertising } from "./outdoorAdvertising";
import { FormData } from "../generator";

// 공식 양식이 지원되는 템플릿 키 목록
export const OFFICIAL_TEMPLATES = [
  "통신판매업신고서",
  "일반음식점영업신고서",
  "휴게음식점영업신고서",
  "사업자등록신청서",
  "건축물대장발급신청서",
  "숙박업영업허가신청서",
  "학원설립운영등록신청서",
  "미용업신고서",
  "옥외광고물표시허가신청서",
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
        salesMethodInternet: data.salesMethod === "인터넷 쇼핑몰" || data.salesMethodInternet === "true",
        salesMethodTV: data.salesMethodTV === "true",
        salesMethodCatalog: data.salesMethodCatalog === "true",
        salesMethodNewspaper: data.salesMethodNewspaper === "true",
        salesMethodOther: data.salesMethod === "기타" || data.salesMethodOther === "true",
        salesMethodOtherText: String(data.salesMethodOtherText || ""),
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
    case "휴게음식점영업신고서":
      return await createRestaurantBusinessReport({
        businessName: String(data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        businessAddress: String(data.businessAddress || ""),
        phone: String(data.phone || ""),
        businessType: String(data.businessType || (templateKey === "휴게음식점영업신고서" ? "휴게음식점" : "일반음식점")),
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

    case "건축물대장발급신청서":
      return await createBuildingLedger({
        applicantName: String(data.applicantName || ""),
        applicantPhone: String(data.applicantPhone || data.phone || ""),
        applicantAddress: String(data.applicantAddress || ""),
        buildingAddress: String(data.buildingAddress || ""),
        documentType: String(data.documentType || "전체"),
        purpose: String(data.purpose || ""),
        copies: String(data.copies || "1"),
      });

    case "숙박업영업허가신청서":
      return await createAccommodationBusiness({
        businessName: String(data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        businessAddress: String(data.businessAddress || ""),
        phone: String(data.phone || ""),
        businessType: String(data.businessType || data.accommodationType || "일반숙박업"),
        floorArea: String(data.floorArea || ""),
        roomCount: String(data.roomCount || ""),
        facilities: String(data.facilities || ""),
        hygieneEducationDate: String(data.hygieneEducationDate || ""),
      });

    case "학원설립운영등록신청서":
      return await createAcademyRegistration({
        academyName: String(data.academyName || data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        representativeAddress: String(data.representativeAddress || ""),
        academyAddress: String(data.academyAddress || data.businessAddress || ""),
        phone: String(data.phone || ""),
        academyType: String(data.academyType || ""),
        subjects: String(data.subjects || ""),
        floorArea: String(data.floorArea || ""),
        capacity: String(data.capacity || ""),
        teacherCount: String(data.teacherCount || ""),
      });

    case "미용업신고서":
      return await createBeautyShopRegistration({
        businessName: String(data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        businessAddress: String(data.businessAddress || ""),
        phone: String(data.phone || ""),
        beautyType: String(data.beautyType || "일반미용"),
        floorArea: String(data.floorArea || ""),
        workerCount: String(data.workerCount || "1"),
        hygieneEducationDate: String(data.hygieneEducationDate || ""),
        licenseNumber: String(data.licenseNumber || ""),
      });

    case "옥외광고물표시허가신청서":
      return await createOutdoorAdvertising({
        applicantName: String(data.applicantName || data.businessName || ""),
        representativeName: String(data.representativeName || ""),
        residentNumber: String(data.residentNumber || ""),
        applicantAddress: String(data.applicantAddress || data.businessAddress || ""),
        phone: String(data.phone || ""),
        adType: String(data.adType || ""),
        adLocation: String(data.adLocation || ""),
        adSize: String(data.adSize || ""),
        adContent: String(data.adContent || ""),
        displayPeriod: String(data.displayPeriod || ""),
        quantity: String(data.quantity || "1"),
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
