"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useClientStore, ClientCompanyData } from "@/lib/store";

// ─── Types ───

interface ClientCompany {
  id: string;
  clientType: string; // "company" | "individual"
  companyName: string;
  ownerName: string | null;
  bizRegNo: string | null;
  address: string | null;
  phone: string | null;
  npBizNo: string | null;
  hiBizNo: string | null;
  eiBizNo: string | null;
  memo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // 개인 의뢰인 정보
  birthDate: string | null;
  nationality: string | null;
  isForeigner: boolean;
  visaType: string | null;
  visaExpiry: string | null;
  visaStatus: string | null;
  alienRegNo: string | null;
  alienRegExpiry: string | null;
  email: string | null;
  // 식별 상세
  ceoGender: string | null;
  corpRegNo: string | null;
  bizType: string | null;
  foundedDate: string | null;
  // 업종 상세
  businessSector: string | null;
  industryCode: string | null;
  industryName: string | null;
  businessSubType: string | null;
  // 재무 정보
  revenueYear1: number | null;
  revenueYear2: number | null;
  revenueYear3: number | null;
  revenueLabel1: string | null;
  revenueLabel2: string | null;
  revenueLabel3: string | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  capital: number | null;
  // 고용 정보
  employeeCount: number;
  permanentEmployees: number | null;
  contractEmployees: number | null;
  researcherCount: number | null;
  foreignEmployees: number | null;
  // 연구소/전담부서
  hasResearchInstitute: boolean;
  hasRndDepartment: boolean;
  // 제조업 정보
  isManufacturer: boolean;
  manufacturingItems: string | null;
  factoryAddress: string | null;
  factoryArea: string | null;
  manufacturingCerts: string | null;
  mainRawMaterials: string | null;
  // 조달/입찰
  isG2bRegistered: boolean;
  g2bRegistrationNumber: string | null;
  mainProducts: string | null;
  hasDirectProductionCert: boolean;
  hasMasContract: boolean;
  // 수출/외국인
  isExporter: boolean;
  exportCountries: string | null;
  hasForeignWorkers: boolean;
  foreignWorkerVisaTypes: string | null;
  // 기업인증
  isVentureCertified: boolean;
  ventureExpiry: string | null;
  isInnobiz: boolean;
  isMainbiz: boolean;
  isISO9001: boolean;
  isISO14001: boolean;
  isISO45001: boolean;
  isWomenBiz: boolean;
  isSocialEnterprise: boolean;
  isRootCompany: boolean;
  otherCertifications: string | null;
  // 특허/지식재산권
  patentCount: number;
  utilityModelCount: number;
  designPatentCount: number;
  trademarkCount: number;
  swCopyrightCount: number;
  patentDetails: string | null;
  // 메타
  profileCompleteness: number;
}

interface ClientForm {
  // 유형
  clientType: string; // "company" | "individual"
  // Tab 1: 기본 정보
  companyName: string;
  ownerName: string;
  ceoGender: string;
  bizRegNo: string;
  corpRegNo: string;
  address: string;
  phone: string;
  email: string;
  bizType: string;
  foundedDate: string;
  // Tab 2: 업종/산업
  businessSector: string;
  industryCode: string;
  industryName: string;
  businessSubType: string;
  // Tab 3: 재무 정보
  revenueYear1: string;
  revenueYear2: string;
  revenueYear3: string;
  revenueLabel1: string;
  revenueLabel2: string;
  revenueLabel3: string;
  capital: string;
  totalAssets: string;
  totalLiabilities: string;
  // Tab 4: 고용 정보
  employeeCount: string;
  permanentEmployees: string;
  contractEmployees: string;
  researcherCount: string;
  foreignEmployees: string;
  npBizNo: string;
  hiBizNo: string;
  eiBizNo: string;
  // Tab 5: 사업장 상세
  hasResearchInstitute: boolean;
  hasRndDepartment: boolean;
  isManufacturer: boolean;
  manufacturingItems: string;
  factoryAddress: string;
  factoryArea: string;
  manufacturingCerts: string;
  mainRawMaterials: string;
  isG2bRegistered: boolean;
  g2bRegistrationNumber: string;
  mainProducts: string;
  hasDirectProductionCert: boolean;
  hasMasContract: boolean;
  isExporter: boolean;
  exportCountries: string;
  hasForeignWorkers: boolean;
  foreignWorkerVisaTypes: string;
  // 개인 의뢰인 정보
  birthDate: string;
  nationality: string;
  isForeigner: boolean;
  visaType: string;
  visaExpiry: string;
  visaStatus: string;
  alienRegNo: string;
  alienRegExpiry: string;
  // Tab 6: 메모
  memo: string;
  // Tab 7: 인증 현황
  isVentureCertified: boolean;
  ventureExpiry: string;
  isInnobiz: boolean;
  isMainbiz: boolean;
  isISO9001: boolean;
  isISO14001: boolean;
  isISO45001: boolean;
  isWomenBiz: boolean;
  isSocialEnterprise: boolean;
  isRootCompany: boolean;
  otherCertifications: string;
  // Tab 8: 특허/지식재산권
  patentCount: string;
  utilityModelCount: string;
  designPatentCount: string;
  trademarkCount: string;
  swCopyrightCount: string;
  patentDetails: string;
}

const EMPTY_FORM: ClientForm = {
  clientType: "company",
  companyName: "",
  ownerName: "",
  ceoGender: "",
  bizRegNo: "",
  corpRegNo: "",
  address: "",
  phone: "",
  email: "",
  bizType: "",
  foundedDate: "",
  businessSector: "",
  industryCode: "",
  industryName: "",
  businessSubType: "",
  revenueYear1: "",
  revenueYear2: "",
  revenueYear3: "",
  revenueLabel1: "",
  revenueLabel2: "",
  revenueLabel3: "",
  capital: "",
  totalAssets: "",
  totalLiabilities: "",
  employeeCount: "",
  permanentEmployees: "",
  contractEmployees: "",
  researcherCount: "",
  foreignEmployees: "",
  npBizNo: "",
  hiBizNo: "",
  eiBizNo: "",
  hasResearchInstitute: false,
  hasRndDepartment: false,
  isManufacturer: false,
  manufacturingItems: "",
  factoryAddress: "",
  factoryArea: "",
  manufacturingCerts: "",
  mainRawMaterials: "",
  isG2bRegistered: false,
  g2bRegistrationNumber: "",
  mainProducts: "",
  hasDirectProductionCert: false,
  hasMasContract: false,
  isExporter: false,
  exportCountries: "",
  hasForeignWorkers: false,
  foreignWorkerVisaTypes: "",
  // 개인 의뢰인 정보
  birthDate: "",
  nationality: "",
  isForeigner: false,
  visaType: "",
  visaExpiry: "",
  visaStatus: "",
  alienRegNo: "",
  alienRegExpiry: "",
  memo: "",
  // 인증 현황
  isVentureCertified: false,
  ventureExpiry: "",
  isInnobiz: false,
  isMainbiz: false,
  isISO9001: false,
  isISO14001: false,
  isISO45001: false,
  isWomenBiz: false,
  isSocialEnterprise: false,
  isRootCompany: false,
  otherCertifications: "",
  // 특허/지식재산권
  patentCount: "",
  utilityModelCount: "",
  designPatentCount: "",
  trademarkCount: "",
  swCopyrightCount: "",
  patentDetails: "",
};

const COMPANY_TAB_LABELS = [
  "기본 정보",
  "업종/산업",
  "재무 정보",
  "고용 정보",
  "사업장 상세",
  "메모",
  "인증 현황",
  "특허/IP",
] as const;

const INDIVIDUAL_TAB_LABELS = [
  "기본 정보",
  "비자/체류 정보",
  "메모",
] as const;

const NATIONALITY_OPTIONS = [
  "대한민국", "중국", "베트남", "태국", "필리핀", "인도네시아", "미얀마",
  "캄보디아", "네팔", "스리랑카", "방글라데시", "파키스탄", "우즈베키스탄",
  "몽골", "일본", "미국", "러시아", "인도", "기타",
] as const;

const VISA_TYPE_OPTIONS = [
  { value: "", label: "선택안함" },
  { value: "F-2", label: "F-2 (거주)" },
  { value: "F-4", label: "F-4 (재외동포)" },
  { value: "F-5", label: "F-5 (영주)" },
  { value: "F-6", label: "F-6 (결혼이민)" },
  { value: "E-7", label: "E-7 (특정활동)" },
  { value: "E-9", label: "E-9 (비전문취업)" },
  { value: "H-2", label: "H-2 (방문취업)" },
  { value: "D-2", label: "D-2 (유학)" },
  { value: "D-4", label: "D-4 (일반연수)" },
  { value: "D-10", label: "D-10 (구직)" },
  { value: "C-3", label: "C-3 (단기방문)" },
  { value: "C-4", label: "C-4 (단기취업)" },
  { value: "G-1", label: "G-1 (기타)" },
  { value: "other", label: "기타 (직접입력)" },
] as const;

const BUSINESS_SECTOR_OPTIONS = [
  "",
  "제조업",
  "서비스업",
  "건설업",
  "IT",
  "유통업",
  "농림어업",
  "기타",
] as const;

// ─── Helpers ───

/** 사업자등록번호 포맷팅: 000-00-00000 */
function formatBizRegNo(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** 법인등록번호 포맷팅: 000000-0000000 */
function formatCorpRegNo(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/** 전화번호 포맷팅 */
function formatPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 숫자만 허용 (금액용) */
function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** 금액 포맷팅 (한국 원) */
function formatCurrency(value: number | string | null | undefined): string {
  if (value == null || value === "" || value === 0) return "-";
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("ko-KR") + "원";
}

/** ISO date → YYYY-MM-DD */
function toDateInput(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/** 프로필 완성도 계산 (클라이언트 기준) */
function calcCompleteness(form: ClientForm): number {
  if (form.clientType === "individual") {
    const checks: boolean[] = [
      !!form.companyName.trim(), // 이름
      !!form.phone.trim(),
      !!form.address.trim(),
      !!form.nationality,
      !!form.birthDate,
      !!form.email?.trim(),
      !!form.memo.trim(),
    ];
    // 외국인이면 추가 항목
    if (form.isForeigner) {
      checks.push(!!form.visaType, !!form.visaExpiry, !!form.alienRegNo?.trim());
    }
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }
  const checks: boolean[] = [
    !!form.companyName.trim(),
    !!form.ownerName.trim(),
    !!form.bizRegNo.trim(),
    !!form.address.trim(),
    !!form.phone.trim(),
    !!form.ceoGender,
    !!form.bizType.trim(),
    !!form.foundedDate,
    !!form.businessSector,
    !!form.industryCode.trim() || !!form.industryName.trim(),
    !!form.revenueYear1 || !!form.revenueYear2 || !!form.revenueYear3,
    !!form.capital,
    !!form.employeeCount,
    !!form.npBizNo.trim() || !!form.hiBizNo.trim() || !!form.eiBizNo.trim(),
    !!form.memo.trim(),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/** ClientCompany -> ClientForm */
function clientToForm(client: ClientCompany): ClientForm {
  return {
    clientType: client.clientType || "company",
    companyName: client.companyName,
    ownerName: client.ownerName || "",
    ceoGender: client.ceoGender || "",
    bizRegNo: client.bizRegNo || "",
    corpRegNo: client.corpRegNo || "",
    address: client.address || "",
    phone: client.phone || "",
    email: client.email || "",
    bizType: client.bizType || "",
    foundedDate: toDateInput(client.foundedDate),
    businessSector: client.businessSector || "",
    industryCode: client.industryCode || "",
    industryName: client.industryName || "",
    businessSubType: client.businessSubType || "",
    revenueYear1: client.revenueYear1 != null ? String(client.revenueYear1) : "",
    revenueYear2: client.revenueYear2 != null ? String(client.revenueYear2) : "",
    revenueYear3: client.revenueYear3 != null ? String(client.revenueYear3) : "",
    revenueLabel1: client.revenueLabel1 || "",
    revenueLabel2: client.revenueLabel2 || "",
    revenueLabel3: client.revenueLabel3 || "",
    capital: client.capital != null ? String(client.capital) : "",
    totalAssets: client.totalAssets != null ? String(client.totalAssets) : "",
    totalLiabilities: client.totalLiabilities != null ? String(client.totalLiabilities) : "",
    employeeCount: client.employeeCount ? String(client.employeeCount) : "",
    permanentEmployees: client.permanentEmployees != null ? String(client.permanentEmployees) : "",
    contractEmployees: client.contractEmployees != null ? String(client.contractEmployees) : "",
    researcherCount: client.researcherCount != null ? String(client.researcherCount) : "",
    foreignEmployees: client.foreignEmployees != null ? String(client.foreignEmployees) : "",
    npBizNo: client.npBizNo || "",
    hiBizNo: client.hiBizNo || "",
    eiBizNo: client.eiBizNo || "",
    hasResearchInstitute: client.hasResearchInstitute || false,
    hasRndDepartment: client.hasRndDepartment || false,
    isManufacturer: client.isManufacturer || false,
    manufacturingItems: client.manufacturingItems || "",
    factoryAddress: client.factoryAddress || "",
    factoryArea: client.factoryArea || "",
    manufacturingCerts: client.manufacturingCerts || "",
    mainRawMaterials: client.mainRawMaterials || "",
    isG2bRegistered: client.isG2bRegistered || false,
    g2bRegistrationNumber: client.g2bRegistrationNumber || "",
    mainProducts: client.mainProducts || "",
    hasDirectProductionCert: client.hasDirectProductionCert || false,
    hasMasContract: client.hasMasContract || false,
    isExporter: client.isExporter || false,
    exportCountries: client.exportCountries || "",
    hasForeignWorkers: client.hasForeignWorkers || false,
    foreignWorkerVisaTypes: client.foreignWorkerVisaTypes || "",
    // 개인 의뢰인 정보
    birthDate: toDateInput(client.birthDate),
    nationality: client.nationality || "",
    isForeigner: client.isForeigner || false,
    visaType: client.visaType || "",
    visaExpiry: toDateInput(client.visaExpiry),
    visaStatus: client.visaStatus || "",
    alienRegNo: client.alienRegNo || "",
    alienRegExpiry: toDateInput(client.alienRegExpiry),
    memo: client.memo || "",
    // 인증 현황
    isVentureCertified: client.isVentureCertified || false,
    ventureExpiry: toDateInput(client.ventureExpiry),
    isInnobiz: client.isInnobiz || false,
    isMainbiz: client.isMainbiz || false,
    isISO9001: client.isISO9001 || false,
    isISO14001: client.isISO14001 || false,
    isISO45001: client.isISO45001 || false,
    isWomenBiz: client.isWomenBiz || false,
    isSocialEnterprise: client.isSocialEnterprise || false,
    isRootCompany: client.isRootCompany || false,
    otherCertifications: client.otherCertifications || "",
    // 특허/지식재산권
    patentCount: client.patentCount ? String(client.patentCount) : "",
    utilityModelCount: client.utilityModelCount ? String(client.utilityModelCount) : "",
    designPatentCount: client.designPatentCount ? String(client.designPatentCount) : "",
    trademarkCount: client.trademarkCount ? String(client.trademarkCount) : "",
    swCopyrightCount: client.swCopyrightCount ? String(client.swCopyrightCount) : "",
    patentDetails: client.patentDetails || "",
  };
}

/** ClientCompany -> ClientCompanyData (store) */
function clientToStoreData(client: ClientCompany): ClientCompanyData {
  return {
    id: client.id,
    companyName: client.companyName,
    ownerName: client.ownerName,
    bizRegNo: client.bizRegNo,
    address: client.address,
    phone: client.phone,
    npBizNo: client.npBizNo,
    hiBizNo: client.hiBizNo,
    eiBizNo: client.eiBizNo,
    memo: client.memo,
    ceoGender: client.ceoGender,
    corpRegNo: client.corpRegNo,
    bizType: client.bizType,
    foundedDate: client.foundedDate,
    businessSector: client.businessSector,
    industryCode: client.industryCode,
    industryName: client.industryName,
    businessSubType: client.businessSubType,
    revenueYear1: client.revenueYear1,
    revenueYear2: client.revenueYear2,
    revenueYear3: client.revenueYear3,
    revenueLabel1: client.revenueLabel1,
    revenueLabel2: client.revenueLabel2,
    revenueLabel3: client.revenueLabel3,
    totalAssets: client.totalAssets,
    totalLiabilities: client.totalLiabilities,
    capital: client.capital,
    employeeCount: client.employeeCount,
    permanentEmployees: client.permanentEmployees,
    contractEmployees: client.contractEmployees,
    researcherCount: client.researcherCount,
    foreignEmployees: client.foreignEmployees,
    hasResearchInstitute: client.hasResearchInstitute,
    hasRndDepartment: client.hasRndDepartment,
    isManufacturer: client.isManufacturer,
    manufacturingItems: client.manufacturingItems,
    factoryAddress: client.factoryAddress,
    mainProducts: client.mainProducts,
    isG2bRegistered: client.isG2bRegistered,
    g2bRegistrationNumber: client.g2bRegistrationNumber,
    hasForeignWorkers: client.hasForeignWorkers,
    foreignWorkerVisaTypes: client.foreignWorkerVisaTypes,
    // 인증
    isVentureCertified: client.isVentureCertified,
    ventureExpiry: client.ventureExpiry,
    isInnobiz: client.isInnobiz,
    isMainbiz: client.isMainbiz,
    isISO9001: client.isISO9001,
    isISO14001: client.isISO14001,
    isISO45001: client.isISO45001,
    isWomenBiz: client.isWomenBiz,
    isSocialEnterprise: client.isSocialEnterprise,
    isRootCompany: client.isRootCompany,
    otherCertifications: client.otherCertifications,
    // 특허/지식재산권
    patentCount: client.patentCount,
    utilityModelCount: client.utilityModelCount,
    designPatentCount: client.designPatentCount,
    trademarkCount: client.trademarkCount,
    swCopyrightCount: client.swCopyrightCount,
    patentDetails: client.patentDetails,
    profileCompleteness: client.profileCompleteness,
  };
}

/** Form -> API payload */
function formToPayload(form: ClientForm) {
  const completeness = calcCompleteness(form);
  return {
    clientType: form.clientType || "company",
    companyName: form.companyName.trim(),
    ownerName: form.ownerName.trim() || null,
    ceoGender: form.ceoGender || null,
    bizRegNo: form.bizRegNo.trim() || null,
    corpRegNo: form.corpRegNo.trim() || null,
    address: form.address.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email?.trim() || null,
    bizType: form.bizType.trim() || null,
    foundedDate: form.foundedDate || null,
    businessSector: form.businessSector || null,
    industryCode: form.industryCode.trim() || null,
    industryName: form.industryName.trim() || null,
    businessSubType: form.businessSubType.trim() || null,
    revenueYear1: form.revenueYear1 ? Number(form.revenueYear1) : null,
    revenueYear2: form.revenueYear2 ? Number(form.revenueYear2) : null,
    revenueYear3: form.revenueYear3 ? Number(form.revenueYear3) : null,
    revenueLabel1: form.revenueLabel1.trim() || null,
    revenueLabel2: form.revenueLabel2.trim() || null,
    revenueLabel3: form.revenueLabel3.trim() || null,
    capital: form.capital ? Number(form.capital) : null,
    totalAssets: form.totalAssets ? Number(form.totalAssets) : null,
    totalLiabilities: form.totalLiabilities ? Number(form.totalLiabilities) : null,
    employeeCount: form.employeeCount ? Number(form.employeeCount) : 0,
    permanentEmployees: form.permanentEmployees ? Number(form.permanentEmployees) : null,
    contractEmployees: form.contractEmployees ? Number(form.contractEmployees) : null,
    researcherCount: form.researcherCount ? Number(form.researcherCount) : null,
    foreignEmployees: form.foreignEmployees ? Number(form.foreignEmployees) : null,
    npBizNo: form.npBizNo.trim() || null,
    hiBizNo: form.hiBizNo.trim() || null,
    eiBizNo: form.eiBizNo.trim() || null,
    hasResearchInstitute: form.hasResearchInstitute,
    hasRndDepartment: form.hasRndDepartment,
    isManufacturer: form.isManufacturer,
    manufacturingItems: form.manufacturingItems.trim() || null,
    factoryAddress: form.factoryAddress.trim() || null,
    factoryArea: form.factoryArea.trim() || null,
    manufacturingCerts: form.manufacturingCerts.trim() || null,
    mainRawMaterials: form.mainRawMaterials.trim() || null,
    isG2bRegistered: form.isG2bRegistered,
    g2bRegistrationNumber: form.g2bRegistrationNumber.trim() || null,
    mainProducts: form.mainProducts.trim() || null,
    hasDirectProductionCert: form.hasDirectProductionCert,
    hasMasContract: form.hasMasContract,
    isExporter: form.isExporter,
    exportCountries: form.exportCountries.trim() || null,
    hasForeignWorkers: form.hasForeignWorkers,
    foreignWorkerVisaTypes: form.foreignWorkerVisaTypes.trim() || null,
    // 개인 의뢰인 정보
    birthDate: form.birthDate || null,
    nationality: form.nationality || null,
    isForeigner: form.isForeigner,
    visaType: form.visaType || null,
    visaExpiry: form.visaExpiry || null,
    visaStatus: form.visaStatus || null,
    alienRegNo: form.alienRegNo?.trim() || null,
    alienRegExpiry: form.alienRegExpiry || null,
    memo: form.memo.trim() || null,
    // 인증 현황
    isVentureCertified: form.isVentureCertified,
    ventureExpiry: form.isVentureCertified && form.ventureExpiry ? form.ventureExpiry : null,
    isInnobiz: form.isInnobiz,
    isMainbiz: form.isMainbiz,
    isISO9001: form.isISO9001,
    isISO14001: form.isISO14001,
    isISO45001: form.isISO45001,
    isWomenBiz: form.isWomenBiz,
    isSocialEnterprise: form.isSocialEnterprise,
    isRootCompany: form.isRootCompany,
    otherCertifications: form.otherCertifications.trim() || null,
    // 특허/지식재산권
    patentCount: form.patentCount ? Number(form.patentCount) : 0,
    utilityModelCount: form.utilityModelCount ? Number(form.utilityModelCount) : 0,
    designPatentCount: form.designPatentCount ? Number(form.designPatentCount) : 0,
    trademarkCount: form.trademarkCount ? Number(form.trademarkCount) : 0,
    swCopyrightCount: form.swCopyrightCount ? Number(form.swCopyrightCount) : 0,
    patentDetails: form.patentDetails.trim() || null,
    profileCompleteness: completeness,
  };
}

// ─── Main Page ───

export default function ClientManagementPage() {
  const { selectedClient, setSelectedClient, clearSelectedClient } = useClientStore();

  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientCompany | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ClientCompany | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Profile completeness (live calculation)
  const profilePercent = useMemo(() => calcCompleteness(form), [form]);

  // ── 거래처 목록 로드 ──
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/labor/client-companies");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "거래처 목록 조회 실패");
      setClients(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "거래처 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── 검색 필터링 ──
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        (c.ownerName && c.ownerName.toLowerCase().includes(q)) ||
        (c.bizRegNo && c.bizRegNo.includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.businessSector && c.businessSector.toLowerCase().includes(q)) ||
        (c.nationality && c.nationality.toLowerCase().includes(q)) ||
        (c.visaType && c.visaType.toLowerCase().includes(q)) ||
        (c.memo && c.memo.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  // ── 모달 열기 ──
  const handleOpenModal = (client?: ClientCompany) => {
    setFormError("");
    setActiveTab(0);
    if (client) {
      setEditingClient(client);
      setForm(clientToForm(client));
    } else {
      setEditingClient(null);
      setForm(EMPTY_FORM);
    }
    setShowModal(true);
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!form.companyName.trim()) {
      setFormError(form.clientType === "individual" ? "이름은 필수입니다." : "거래처 상호는 필수입니다.");
      setActiveTab(0);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = formToPayload(form);

      let res: Response;
      if (editingClient) {
        res = await fetch(`/api/labor/client-companies/${editingClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/labor/client-companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "저장 실패");

      // 수정된 거래처가 현재 선택된 거래처이면 스토어도 업데이트
      if (editingClient && selectedClient?.id === editingClient.id) {
        setSelectedClient(clientToStoreData(data.data));
      }

      setShowModal(false);
      fetchClients();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 (soft delete) ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/labor/client-companies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "삭제 실패");

      if (selectedClient?.id === deleteTarget.id) {
        clearSelectedClient();
      }

      setDeleteTarget(null);
      fetchClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── 거래처 선택 (모든 필드 전달) ──
  const handleSelectClient = (client: ClientCompany) => {
    setSelectedClient(clientToStoreData(client));
  };

  // ── form field updater ──
  const setField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── 헤더 ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">거래처/의뢰인 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          거래처(기업) 또는 개인 의뢰인을 등록하고 관리합니다 (Pro Plus)
        </p>
      </div>

      {/* ── 현재 선택된 거래처 배지 ── */}
      {selectedClient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
              {selectedClient.companyName.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                  현재 선택
                </span>
                <span className="font-semibold text-blue-900 truncate">
                  {selectedClient.companyName}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-0.5 truncate">
                {[
                  selectedClient.ownerName && `대표: ${selectedClient.ownerName}`,
                  selectedClient.bizRegNo && `사업자번호: ${selectedClient.bizRegNo}`,
                  selectedClient.businessSector,
                  selectedClient.employeeCount && `직원 ${selectedClient.employeeCount}명`,
                ]
                  .filter(Boolean)
                  .join(" | ") || "상세 정보 없음"}
              </p>
            </div>
          </div>
          <button
            onClick={clearSelectedClient}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* ── 액션 바 (검색 + 추가 버튼) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-72">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="거래처명/이름, 대표자, 사업자번호, 국적, 비자 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 hidden sm:block">
            총 <span className="font-semibold text-gray-900">{filteredClients.length}</span>개
            {searchQuery && ` (전체 ${clients.length}개)`}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          거래처/의뢰인 추가
        </button>
      </div>

      {/* ── 에러 ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 text-xs underline ml-2">
            닫기
          </button>
        </div>
      )}

      {/* ── 거래처 목록 ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          {clients.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">등록된 거래처/의뢰인이 없습니다</p>
              <p className="text-gray-400 text-sm mt-1">
                거래처(기업) 또는 개인 의뢰인을 추가하여 업무를 관리하세요. 외국인 의뢰인의 비자 만료 알림도 지원합니다.
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                첫 거래처/의뢰인 추가하기
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">
                &quot;{searchQuery}&quot;에 해당하는 거래처가 없습니다.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                검색 초기화
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-10">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">유형</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상호/이름</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">대표자/국적</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">사업자번호/비자</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">업종/비자만료</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">완성도</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 w-44">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClients.map((client, idx) => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                      <tr
                        key={client.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50 hover:bg-blue-100"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          {client.clientType === "individual" ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                              개인
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                              기업
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{client.companyName}</span>
                            {isSelected && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                                선택됨
                              </span>
                            )}
                            {client.clientType === "individual" && client.isForeigner && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                                외국인
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {client.clientType === "individual"
                            ? (client.nationality || "-")
                            : (client.ownerName || "-")}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                          {client.clientType === "individual"
                            ? (client.visaType || "-")
                            : (client.bizRegNo || "-")}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {client.clientType === "individual"
                            ? (client.visaExpiry ? new Date(client.visaExpiry).toLocaleDateString("ko-KR") : "-")
                            : (client.businessSector || "-")}
                        </td>
                        <td className="px-4 py-3">
                          <ProfileBar percent={client.profileCompleteness || 0} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isSelected ? (
                              <button
                                onClick={clearSelectedClient}
                                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                              >
                                선택 해제
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectClient(client)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                              >
                                선택
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenModal(client)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => setDeleteTarget(client)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 / 태블릿 카드 리스트 */}
          <div className="lg:hidden space-y-3">
            {filteredClients.map((client, idx) => {
              const isSelected = selectedClient?.id === client.id;
              const isExpanded = expandedId === client.id;
              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-colors ${
                    isSelected ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"
                  }`}
                >
                  {/* 카드 헤더 */}
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  >
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {client.companyName}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                            선택됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {client.clientType === "individual"
                          ? [
                              client.nationality,
                              client.isForeigner ? `비자: ${client.visaType || "미입력"}` : "내국인",
                              client.visaExpiry ? `만료: ${new Date(client.visaExpiry).toLocaleDateString("ko-KR")}` : null,
                            ].filter(Boolean).join(" / ") || "상세 정보 없음"
                          : [
                              client.ownerName,
                              client.bizRegNo,
                              client.businessSector,
                              client.employeeCount ? `${client.employeeCount}명` : null,
                            ].filter(Boolean).join(" / ") || "상세 정보 없음"
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProfileBar percent={client.profileCompleteness || 0} compact />
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 카드 확장 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <div className="px-4 py-3 space-y-2 text-sm">
                        {client.clientType === "individual" ? (
                          <>
                            <InfoRow label="유형" value="개인 의뢰인" />
                            <InfoRow label="국적" value={client.nationality} />
                            <InfoRow label="생년월일" value={client.birthDate ? new Date(client.birthDate).toLocaleDateString("ko-KR") : null} />
                            <InfoRow label="전화번호" value={client.phone} mono />
                            <InfoRow label="이메일" value={client.email} />
                            <InfoRow label="주소" value={client.address} />
                            {client.isForeigner && (
                              <>
                                <InfoRow label="비자 유형" value={client.visaType} />
                                <InfoRow label="비자 만료일" value={client.visaExpiry ? new Date(client.visaExpiry).toLocaleDateString("ko-KR") : null} />
                                <InfoRow label="외국인등록번호" value={client.alienRegNo} mono />
                                <InfoRow label="등록증 만료" value={client.alienRegExpiry ? new Date(client.alienRegExpiry).toLocaleDateString("ko-KR") : null} />
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <InfoRow label="대표자" value={client.ownerName} />
                            <InfoRow label="성별" value={client.ceoGender === "male" ? "남" : client.ceoGender === "female" ? "여" : null} />
                            <InfoRow label="사업자번호" value={client.bizRegNo} mono />
                            <InfoRow label="주소" value={client.address} />
                            <InfoRow label="전화번호" value={client.phone} mono />
                            <InfoRow label="업종" value={client.businessSector} />
                            <InfoRow label="업태/종목" value={client.bizType} />
                            <InfoRow label="직원수" value={client.employeeCount ? `${client.employeeCount}명 (정규직 ${client.permanentEmployees ?? "-"}명, 계약직 ${client.contractEmployees ?? "-"}명)` : null} />
                          </>
                        )}
                        {client.capital != null && client.capital > 0 && (
                          <InfoRow label="자본금" value={formatCurrency(client.capital)} />
                        )}
                        {(client.npBizNo || client.hiBizNo || client.eiBizNo) && (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1.5">보험 관리번호</p>
                            <div className="flex flex-wrap gap-1.5">
                              {client.npBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                  국민연금 {client.npBizNo}
                                </span>
                              )}
                              {client.hiBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                  건강보험 {client.hiBizNo}
                                </span>
                              )}
                              {client.eiBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  고용산재 {client.eiBizNo}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {client.memo && (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1">메모</p>
                            <p className="text-gray-700 text-xs bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                              {client.memo}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 카드 액션 버튼 */}
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                        {isSelected ? (
                          <button
                            onClick={clearSelectedClient}
                            className="flex-1 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            선택 해제
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectClient(client)}
                            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            이 거래처로 작업하기
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenModal(client)}
                          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => setDeleteTarget(client)}
                          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 안내 문구 ── */}
      {!loading && clients.length > 0 && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>
            * 거래처를 선택하면 급여명세서, 4대보험 신고, 근로계약서 등 모든 노동행정 업무에 해당 거래처 정보가 자동 적용됩니다.
          </p>
          <p>
            * 외국인 의뢰인의 비자 만료일을 입력하면 만료 30일/7일/3일/1일 전 알림을 자동으로 받을 수 있습니다.
          </p>
          <p>
            * 삭제된 거래처/의뢰인은 비활성화 처리되며, 기존 데이터는 유지됩니다.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 추가/수정 모달 (탭 구조)                                */}
      {/* ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingClient ? "거래처/의뢰인 수정" : "거래처/의뢰인 추가"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingClient ? "정보를 수정합니다." : "기업 거래처 또는 개인 의뢰인을 등록합니다."}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
                >
                  &times;
                </button>
              </div>

              {/* 프로필 완성도 바 */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">프로필 완성도</span>
                  <span className={`font-semibold ${profilePercent >= 80 ? "text-green-600" : profilePercent >= 50 ? "text-amber-600" : "text-gray-500"}`}>
                    {profilePercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      profilePercent >= 80
                        ? "bg-green-500"
                        : profilePercent >= 50
                        ? "bg-amber-500"
                        : "bg-gray-400"
                    }`}
                    style={{ width: `${profilePercent}%` }}
                  />
                </div>
              </div>

              {/* 유형 선택 토글 */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setField("clientType", "company"); setActiveTab(0); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    form.clientType === "company"
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  기업 (거래처)
                </button>
                <button
                  type="button"
                  onClick={() => { setField("clientType", "individual"); setActiveTab(0); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    form.clientType === "individual"
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  개인 (의뢰인)
                </button>
              </div>

              {/* 탭 네비게이션 */}
              <div className="mt-3 flex gap-1 overflow-x-auto pb-1 -mb-4">
                {(form.clientType === "individual" ? INDIVIDUAL_TAB_LABELS : COMPANY_TAB_LABELS).map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                      activeTab === i
                        ? "border-blue-600 text-blue-600 bg-blue-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 모달 본문 (스크롤 영역) */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* ═══════════════════════════════════════════ */}
              {/* 개인 의뢰인 전용 탭 */}
              {/* ═══════════════════════════════════════════ */}
              {form.clientType === "individual" && activeTab === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setField("companyName", e.target.value)}
                      placeholder="홍길동"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">생년월일</label>
                      <input
                        type="date"
                        value={form.birthDate}
                        onChange={(e) => setField("birthDate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">성별</label>
                      <select
                        value={form.ceoGender}
                        onChange={(e) => setField("ceoGender", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="">선택안함</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">국적</label>
                      <select
                        value={NATIONALITY_OPTIONS.includes(form.nationality as typeof NATIONALITY_OPTIONS[number]) ? form.nationality : form.nationality ? "기타" : ""}
                        onChange={(e) => {
                          if (e.target.value === "기타") {
                            setField("nationality", "");
                          } else {
                            setField("nationality", e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="">선택안함</option>
                        {NATIONALITY_OPTIONS.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      {form.nationality && !NATIONALITY_OPTIONS.includes(form.nationality as typeof NATIONALITY_OPTIONS[number]) && (
                        <input
                          type="text"
                          value={form.nationality}
                          onChange={(e) => setField("nationality", e.target.value)}
                          placeholder="국적 직접 입력"
                          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">외국인 여부</label>
                      <div className="flex items-center gap-3 mt-1.5">
                        <CheckboxField
                          label="외국인입니다"
                          checked={form.isForeigner}
                          onChange={(v) => setField("isForeigner", v)}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setField("phone", formatPhone(e.target.value))}
                        placeholder="010-1234-5678"
                        maxLength={13}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">이메일</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        placeholder="example@email.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── 개인 Tab 1: 비자/체류 정보 ─── */}
              {form.clientType === "individual" && activeTab === 1 && (
                <div className="space-y-4">
                  {!form.isForeigner ? (
                    <div className="bg-gray-50 rounded-lg p-6 text-center">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm0 0c0 1.657 1.343 3 3 3s3-1.343 3-3-1.343-3-3-3-3 1.343-3 3zm-9 8a9 9 0 1118 0H3z" /></svg>
                      </div>
                      <p className="text-gray-600 font-medium">내국인 의뢰인</p>
                      <p className="text-gray-400 text-sm mt-1">비자/체류 정보는 외국인 의뢰인에게만 해당됩니다.</p>
                      <p className="text-xs text-gray-400 mt-2">외국인으로 변경하려면 &quot;기본 정보&quot; 탭에서 &quot;외국인입니다&quot;를 체크하세요.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                        비자 만료일과 외국인등록증 만료일을 입력하면 만료 전 자동 알림을 받을 수 있습니다.
                      </p>

                      <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">비자 정보</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">비자 유형</label>
                            <select
                              value={VISA_TYPE_OPTIONS.some(v => v.value === form.visaType) ? form.visaType : form.visaType ? "other" : ""}
                              onChange={(e) => {
                                if (e.target.value === "other") {
                                  setField("visaType", "");
                                } else {
                                  setField("visaType", e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            >
                              {VISA_TYPE_OPTIONS.map((v) => (
                                <option key={v.value} value={v.value}>{v.label}</option>
                              ))}
                            </select>
                            {form.visaType && !VISA_TYPE_OPTIONS.some(v => v.value === form.visaType) && (
                              <input
                                type="text"
                                value={form.visaType}
                                onChange={(e) => setField("visaType", e.target.value)}
                                placeholder="비자 유형 직접 입력"
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">비자 만료일</label>
                            <input
                              type="date"
                              value={form.visaExpiry}
                              onChange={(e) => setField("visaExpiry", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {form.visaExpiry && (() => {
                              const daysLeft = Math.ceil((new Date(form.visaExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              if (daysLeft < 0) return <p className="text-xs text-red-600 mt-1 font-semibold">만료됨 ({Math.abs(daysLeft)}일 초과)</p>;
                              if (daysLeft <= 30) return <p className="text-xs text-orange-600 mt-1 font-semibold">D-{daysLeft} (만료 임박)</p>;
                              return <p className="text-xs text-green-600 mt-1">D-{daysLeft}</p>;
                            })()}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">비자 상태</label>
                          <select
                            value={form.visaStatus}
                            onChange={(e) => setField("visaStatus", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                          >
                            <option value="">선택안함</option>
                            <option value="active">유효</option>
                            <option value="expiring_soon">만료 임박</option>
                            <option value="expired">만료됨</option>
                            <option value="renewal_pending">갱신 진행 중</option>
                            <option value="change_pending">변경 진행 중</option>
                          </select>
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">외국인등록증</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">외국인등록번호</label>
                            <input
                              type="text"
                              value={form.alienRegNo}
                              onChange={(e) => setField("alienRegNo", e.target.value)}
                              placeholder="000000-0000000"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">등록증 만료일</label>
                            <input
                              type="date"
                              value={form.alienRegExpiry}
                              onChange={(e) => setField("alienRegExpiry", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                            {form.alienRegExpiry && (() => {
                              const daysLeft = Math.ceil((new Date(form.alienRegExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              if (daysLeft < 0) return <p className="text-xs text-red-600 mt-1 font-semibold">만료됨</p>;
                              if (daysLeft <= 30) return <p className="text-xs text-orange-600 mt-1 font-semibold">D-{daysLeft} (만료 임박)</p>;
                              return <p className="text-xs text-green-600 mt-1">D-{daysLeft}</p>;
                            })()}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── 개인 Tab 2: 메모 ─── */}
              {form.clientType === "individual" && activeTab === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                    <textarea
                      value={form.memo}
                      onChange={(e) => setField("memo", e.target.value)}
                      placeholder="의뢰인에 대한 메모를 입력하세요. 의뢰 내용, 진행 상황, 특이사항 등을 자유롭게 기록합니다."
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{form.memo.length}자</p>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════ */}
              {/* 기업 거래처 전용 탭 (기존) */}
              {/* ═══════════════════════════════════════════ */}

              {/* ─── Tab 0: 기본 정보 ─── */}
              {form.clientType === "company" && activeTab === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      상호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setField("companyName", e.target.value)}
                      placeholder="주식회사 어드미니"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">대표자</label>
                      <input
                        type="text"
                        value={form.ownerName}
                        onChange={(e) => setField("ownerName", e.target.value)}
                        placeholder="홍길동"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">대표자 성별</label>
                      <select
                        value={form.ceoGender}
                        onChange={(e) => setField("ceoGender", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="">선택안함</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">설립일/개업일</label>
                      <input
                        type="date"
                        value={form.foundedDate}
                        onChange={(e) => setField("foundedDate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">사업자등록번호</label>
                      <input
                        type="text"
                        value={form.bizRegNo}
                        onChange={(e) => setField("bizRegNo", formatBizRegNo(e.target.value))}
                        placeholder="000-00-00000"
                        maxLength={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">법인등록번호</label>
                      <input
                        type="text"
                        value={form.corpRegNo}
                        onChange={(e) => setField("corpRegNo", formatCorpRegNo(e.target.value))}
                        placeholder="000000-0000000"
                        maxLength={14}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setField("phone", formatPhone(e.target.value))}
                        placeholder="02-1234-5678"
                        maxLength={13}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">업태/종목</label>
                      <input
                        type="text"
                        value={form.bizType}
                        onChange={(e) => setField("bizType", e.target.value)}
                        placeholder="예: 서비스업 / 소프트웨어개발"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 1: 업종/산업 ─── */}
              {form.clientType === "company" && activeTab === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">업종 대분류</label>
                    <select
                      value={form.businessSector}
                      onChange={(e) => setField("businessSector", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">선택안함</option>
                      {BUSINESS_SECTOR_OPTIONS.filter(Boolean).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">한국표준산업분류 코드</label>
                      <input
                        type="text"
                        value={form.industryCode}
                        onChange={(e) => setField("industryCode", e.target.value)}
                        placeholder="예: C26110"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">산업분류명</label>
                      <input
                        type="text"
                        value={form.industryName}
                        onChange={(e) => setField("industryName", e.target.value)}
                        placeholder="예: 반도체 제조업"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">세부업종</label>
                    <input
                      type="text"
                      value={form.businessSubType}
                      onChange={(e) => setField("businessSubType", e.target.value)}
                      placeholder="예: 시스템 소프트웨어 개발 및 공급"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
                    <p className="font-medium text-gray-600 mb-1">한국표준산업분류 코드란?</p>
                    <p>통계청에서 부여하는 산업 분류 코드입니다. 사업자등록증이나 국세청 홈택스에서 확인할 수 있습니다.</p>
                  </div>
                </div>
              )}

              {/* ─── Tab 2: 재무 정보 ─── */}
              {form.clientType === "company" && activeTab === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    최근 3개년 매출액을 입력합니다. 보조금 매칭, 입찰 시뮬레이션 등에 활용됩니다.
                  </p>

                  {/* 매출액 1차년도 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">1차년도 라벨</label>
                      <input
                        type="text"
                        value={form.revenueLabel1}
                        onChange={(e) => setField("revenueLabel1", e.target.value)}
                        placeholder="예: 2025년"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.revenueYear1 ? Number(form.revenueYear1).toLocaleString("ko-KR") : ""}
                          onChange={(e) => setField("revenueYear1", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>

                  {/* 매출액 2차년도 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">2차년도 라벨</label>
                      <input
                        type="text"
                        value={form.revenueLabel2}
                        onChange={(e) => setField("revenueLabel2", e.target.value)}
                        placeholder="예: 2024년"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.revenueYear2 ? Number(form.revenueYear2).toLocaleString("ko-KR") : ""}
                          onChange={(e) => setField("revenueYear2", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>

                  {/* 매출액 3차년도 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">3차년도 라벨</label>
                      <input
                        type="text"
                        value={form.revenueLabel3}
                        onChange={(e) => setField("revenueLabel3", e.target.value)}
                        placeholder="예: 2023년"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.revenueYear3 ? Number(form.revenueYear3).toLocaleString("ko-KR") : ""}
                          onChange={(e) => setField("revenueYear3", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">재무상태</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">자본금 (원)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={form.capital ? Number(form.capital).toLocaleString("ko-KR") : ""}
                            onChange={(e) => setField("capital", onlyDigits(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">총자산 (원)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={form.totalAssets ? Number(form.totalAssets).toLocaleString("ko-KR") : ""}
                            onChange={(e) => setField("totalAssets", onlyDigits(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">총부채 (원)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={form.totalLiabilities ? Number(form.totalLiabilities).toLocaleString("ko-KR") : ""}
                            onChange={(e) => setField("totalLiabilities", onlyDigits(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 3: 고용 정보 ─── */}
              {form.clientType === "company" && activeTab === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    고용 현황과 4대보험 사업장 관리번호를 입력합니다.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">상시근로자 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.employeeCount}
                          onChange={(e) => setField("employeeCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">정규직 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.permanentEmployees}
                          onChange={(e) => setField("permanentEmployees", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">계약직 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.contractEmployees}
                          onChange={(e) => setField("contractEmployees", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">연구원 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.researcherCount}
                          onChange={(e) => setField("researcherCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">외국인 근로자 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.foreignEmployees}
                          onChange={(e) => setField("foreignEmployees", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                  </div>

                  {/* 4대보험 관리번호 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      4대보험 사업장 관리번호
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">국민연금 관리번호</label>
                        <input
                          type="text"
                          value={form.npBizNo}
                          onChange={(e) => setField("npBizNo", e.target.value)}
                          placeholder="NP-000000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">건강보험 관리번호</label>
                        <input
                          type="text"
                          value={form.hiBizNo}
                          onChange={(e) => setField("hiBizNo", e.target.value)}
                          placeholder="HI-000000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">고용/산재보험 관리번호</label>
                      <input
                        type="text"
                        value={form.eiBizNo}
                        onChange={(e) => setField("eiBizNo", e.target.value)}
                        placeholder="EI-000000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">고용보험과 산재보험은 동일 관리번호를 사용합니다.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 4: 사업장 상세 ─── */}
              {form.clientType === "company" && activeTab === 4 && (
                <div className="space-y-5">
                  {/* 연구소 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">연구소 / 전담부서</p>
                    <div className="flex flex-wrap gap-4">
                      <CheckboxField
                        label="기업부설연구소 보유"
                        checked={form.hasResearchInstitute}
                        onChange={(v) => setField("hasResearchInstitute", v)}
                      />
                      <CheckboxField
                        label="연구개발전담부서 보유"
                        checked={form.hasRndDepartment}
                        onChange={(v) => setField("hasRndDepartment", v)}
                      />
                    </div>
                  </div>

                  {/* 제조업 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">제조업 정보</p>
                    <CheckboxField
                      label="제조업체 여부"
                      checked={form.isManufacturer}
                      onChange={(v) => setField("isManufacturer", v)}
                    />
                    {form.isManufacturer && (
                      <div className="mt-3 space-y-3 pl-0 sm:pl-6">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">제조물품 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.manufacturingItems}
                            onChange={(e) => setField("manufacturingItems", e.target.value)}
                            placeholder="예: 전자부품, PCB, 커넥터"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">공장 소재지</label>
                            <input
                              type="text"
                              value={form.factoryAddress}
                              onChange={(e) => setField("factoryAddress", e.target.value)}
                              placeholder="공장 주소 입력"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">공장 면적</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={form.factoryArea}
                                onChange={(e) => setField("factoryArea", e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">m2</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">제조 인증 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.manufacturingCerts}
                            onChange={(e) => setField("manufacturingCerts", e.target.value)}
                            placeholder="예: HACCP, GMP, KS, ISO9001"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">주요 원자재 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.mainRawMaterials}
                            onChange={(e) => setField("mainRawMaterials", e.target.value)}
                            placeholder="예: 구리, 알루미늄, 실리콘"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 조달/입찰 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">조달 / 입찰 정보</p>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-4">
                        <CheckboxField
                          label="나라장터(G2B) 등록"
                          checked={form.isG2bRegistered}
                          onChange={(v) => setField("isG2bRegistered", v)}
                        />
                        <CheckboxField
                          label="직접생산확인증명 보유"
                          checked={form.hasDirectProductionCert}
                          onChange={(v) => setField("hasDirectProductionCert", v)}
                        />
                        <CheckboxField
                          label="다수공급자계약(MAS)"
                          checked={form.hasMasContract}
                          onChange={(v) => setField("hasMasContract", v)}
                        />
                      </div>
                      {form.isG2bRegistered && (
                        <div className="pl-0 sm:pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">나라장터 업체등록번호</label>
                          <input
                            type="text"
                            value={form.g2bRegistrationNumber}
                            onChange={(e) => setField("g2bRegistrationNumber", e.target.value)}
                            placeholder="업체등록번호 입력"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">주요 생산품목 (쉼표 구분)</label>
                        <input
                          type="text"
                          value={form.mainProducts}
                          onChange={(e) => setField("mainProducts", e.target.value)}
                          placeholder="예: 사무용 가구, 철재 캐비닛"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 수출/외국인 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">수출 / 외국인 근로자</p>
                    <div className="space-y-3">
                      <CheckboxField
                        label="수출 기업"
                        checked={form.isExporter}
                        onChange={(v) => setField("isExporter", v)}
                      />
                      {form.isExporter && (
                        <div className="pl-0 sm:pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">수출 대상국 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.exportCountries}
                            onChange={(e) => setField("exportCountries", e.target.value)}
                            placeholder="예: 미국, 일본, 중국"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                      <CheckboxField
                        label="외국인 근로자 고용"
                        checked={form.hasForeignWorkers}
                        onChange={(v) => setField("hasForeignWorkers", v)}
                      />
                      {form.hasForeignWorkers && (
                        <div className="pl-0 sm:pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">비자 유형 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.foreignWorkerVisaTypes}
                            onChange={(e) => setField("foreignWorkerVisaTypes", e.target.value)}
                            placeholder="예: E-9, H-2, D-10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 5: 메모 ─── */}
              {form.clientType === "company" && activeTab === 5 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                    <textarea
                      value={form.memo}
                      onChange={(e) => setField("memo", e.target.value)}
                      placeholder="거래처에 대한 메모를 입력하세요. 특이사항, 계약 조건, 연락처 등 자유롭게 기록합니다."
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{form.memo.length}자</p>
                  </div>
                </div>
              )}

              {/* ─── Tab 6: 인증 현황 ─── */}
              {form.clientType === "company" && activeTab === 6 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    보유 중인 기업 인증을 관리합니다. 보조금 매칭, 입찰 가점 산정 등에 활용됩니다.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 벤처기업 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isVentureCertified ? "border-blue-300 bg-blue-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </span>
                          <span className="text-sm font-medium text-gray-800">벤처기업</span>
                        </div>
                        <ToggleSwitch checked={form.isVentureCertified} onChange={(v) => setField("isVentureCertified", v)} />
                      </div>
                      {form.isVentureCertified && (
                        <div className="mt-3 pl-10">
                          <label className="block text-xs font-medium text-gray-600 mb-1">인증 만료일</label>
                          <input
                            type="date"
                            value={form.ventureExpiry}
                            onChange={(e) => setField("ventureExpiry", e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* 이노비즈 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isInnobiz ? "border-green-300 bg-green-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                          </span>
                          <span className="text-sm font-medium text-gray-800">이노비즈</span>
                        </div>
                        <ToggleSwitch checked={form.isInnobiz} onChange={(v) => setField("isInnobiz", v)} />
                      </div>
                    </div>

                    {/* 메인비즈 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isMainbiz ? "border-purple-300 bg-purple-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                          </span>
                          <span className="text-sm font-medium text-gray-800">메인비즈</span>
                        </div>
                        <ToggleSwitch checked={form.isMainbiz} onChange={(v) => setField("isMainbiz", v)} />
                      </div>
                    </div>

                    {/* ISO 9001 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isISO9001 ? "border-amber-300 bg-amber-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          </span>
                          <div>
                            <span className="text-sm font-medium text-gray-800">ISO 9001</span>
                            <p className="text-[10px] text-gray-400">품질경영시스템</p>
                          </div>
                        </div>
                        <ToggleSwitch checked={form.isISO9001} onChange={(v) => setField("isISO9001", v)} />
                      </div>
                    </div>

                    {/* ISO 14001 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isISO14001 ? "border-emerald-300 bg-emerald-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </span>
                          <div>
                            <span className="text-sm font-medium text-gray-800">ISO 14001</span>
                            <p className="text-[10px] text-gray-400">환경경영시스템</p>
                          </div>
                        </div>
                        <ToggleSwitch checked={form.isISO14001} onChange={(v) => setField("isISO14001", v)} />
                      </div>
                    </div>

                    {/* ISO 45001 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isISO45001 ? "border-orange-300 bg-orange-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                          </span>
                          <div>
                            <span className="text-sm font-medium text-gray-800">ISO 45001</span>
                            <p className="text-[10px] text-gray-400">안전보건경영시스템</p>
                          </div>
                        </div>
                        <ToggleSwitch checked={form.isISO45001} onChange={(v) => setField("isISO45001", v)} />
                      </div>
                    </div>

                    {/* 여성기업 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isWomenBiz ? "border-pink-300 bg-pink-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </span>
                          <span className="text-sm font-medium text-gray-800">여성기업</span>
                        </div>
                        <ToggleSwitch checked={form.isWomenBiz} onChange={(v) => setField("isWomenBiz", v)} />
                      </div>
                    </div>

                    {/* 사회적기업 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isSocialEnterprise ? "border-teal-300 bg-teal-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          </span>
                          <span className="text-sm font-medium text-gray-800">사회적기업</span>
                        </div>
                        <ToggleSwitch checked={form.isSocialEnterprise} onChange={(v) => setField("isSocialEnterprise", v)} />
                      </div>
                    </div>

                    {/* 뿌리기업 */}
                    <div className={`border rounded-xl p-4 transition-colors ${form.isRootCompany ? "border-lime-300 bg-lime-50/30" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-8 h-8 bg-lime-100 text-lime-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                          </span>
                          <span className="text-sm font-medium text-gray-800">뿌리기업</span>
                        </div>
                        <ToggleSwitch checked={form.isRootCompany} onChange={(v) => setField("isRootCompany", v)} />
                      </div>
                    </div>
                  </div>

                  {/* 기타 인증 */}
                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">기타 인증</label>
                    <textarea
                      value={form.otherCertifications}
                      onChange={(e) => setField("otherCertifications", e.target.value)}
                      placeholder="기타 보유 인증을 자유롭게 기록하세요. (예: HACCP, GMP, 녹색기술인증 등)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ─── Tab 7: 특허/지식재산권 ─── */}
              {form.clientType === "company" && activeTab === 7 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    보유한 특허 및 지식재산권을 관리합니다. 기술력 평가, 보조금 심사 가점 등에 활용됩니다.
                  </p>

                  {/* IP 요약 카드 */}
                  {(() => {
                    const total =
                      (Number(form.patentCount) || 0) +
                      (Number(form.utilityModelCount) || 0) +
                      (Number(form.designPatentCount) || 0) +
                      (Number(form.trademarkCount) || 0) +
                      (Number(form.swCopyrightCount) || 0);
                    return (
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </span>
                          <div>
                            <p className="text-xs text-indigo-600 font-medium">총 보유 지식재산권</p>
                            <p className="text-2xl font-bold text-indigo-900">{total}<span className="text-sm font-normal text-indigo-500 ml-1">건</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 개별 입력 카드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </span>
                        <span className="text-sm font-medium text-gray-800">등록 특허</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.patentCount}
                          onChange={(e) => setField("patentCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">건</span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </span>
                        <span className="text-sm font-medium text-gray-800">실용신안</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.utilityModelCount}
                          onChange={(e) => setField("utilityModelCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">건</span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        </span>
                        <span className="text-sm font-medium text-gray-800">디자인등록</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.designPatentCount}
                          onChange={(e) => setField("designPatentCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">건</span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                        </span>
                        <span className="text-sm font-medium text-gray-800">상표등록</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.trademarkCount}
                          onChange={(e) => setField("trademarkCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">건</span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4 sm:col-span-2">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        </span>
                        <span className="text-sm font-medium text-gray-800">SW 저작권</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.swCopyrightCount}
                          onChange={(e) => setField("swCopyrightCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">건</span>
                      </div>
                    </div>
                  </div>

                  {/* 상세 내용 */}
                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">주요 특허/IP 상세</label>
                    <textarea
                      value={form.patentDetails}
                      onChange={(e) => setField("patentDetails", e.target.value)}
                      placeholder="주요 특허명, 출원/등록번호, 기술분야 등을 기록하세요."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* 폼 에러 */}
              {formError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex items-center justify-between">
              {/* 탭 네비게이션 (이전/다음) */}
              <div className="flex items-center gap-2">
                {activeTab > 0 && (
                  <button
                    onClick={() => setActiveTab((t) => t - 1)}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    이전
                  </button>
                )}
                {activeTab < (form.clientType === "individual" ? INDIVIDUAL_TAB_LABELS : COMPANY_TAB_LABELS).length - 1 && (
                  <button
                    onClick={() => setActiveTab((t) => t + 1)}
                    className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    다음
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      저장 중...
                    </span>
                  ) : editingClient ? (
                    "수정"
                  ) : (
                    "등록"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 삭제 확인 모달                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">거래처 삭제</h3>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{deleteTarget.companyName}</span>
                {deleteTarget.ownerName && (
                  <span className="text-gray-500"> ({deleteTarget.ownerName})</span>
                )}
                을(를) 삭제하시겠습니까?
              </p>
              <p className="text-xs text-gray-400 mt-2">
                삭제된 거래처는 비활성화 처리되며, 기존 데이터는 보존됩니다.
              </p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    삭제 중...
                  </span>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

/** 프로필 완성도 바 */
function ProfileBar({ percent, compact }: { percent: number; compact?: boolean }) {
  const color =
    percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-amber-500" : "bg-gray-400";
  const textColor =
    percent >= 80 ? "text-green-600" : percent >= 50 ? "text-amber-600" : "text-gray-500";

  if (compact) {
    return (
      <span className={`text-[10px] font-semibold ${textColor}`}>{percent}%</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold ${textColor}`}>{percent}%</span>
    </div>
  );
}

/** 토글 스위치 */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/** 체크박스 필드 */
function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

/** 정보 행 컴포넌트 (모바일 카드 상세) */
function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 text-xs text-gray-500 w-20">{label}</span>
      <span className={`text-xs text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
