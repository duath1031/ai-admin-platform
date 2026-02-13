"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  AlertDescription,
} from "@/components/ui";
import InsuranceReportPdf from "@/components/labor/InsuranceReportPdf";
import type { CompanyInfo, ReportData } from "@/components/labor/InsuranceReportPdf";

// ─── Types ───

type ReportType = "acquisition" | "loss" | "salary_change";

interface Employee {
  id: string;
  name: string;
  birthDate?: string | null;
  department?: string | null;
  position?: string | null;
  hireDate: string;
  resignDate?: string | null;
  employmentType: string;
  monthlySalary: number;
  weeklyWorkHours: number;
  nationalPensionExempt: boolean;
  healthInsuranceExempt: boolean;
  employmentInsuranceExempt: boolean;
}

interface SavedReport {
  id: string;
  reportType: string;
  reportData: string;
  status: string;
  createdAt: string;
  employee: { id: string; name: string; department?: string | null; position?: string | null };
}

interface ClientCompanyItem {
  id: string;
  companyName: string;
  ownerName?: string | null;
  bizRegNo?: string | null;
  address?: string | null;
  phone?: string | null;
  npBizNo?: string | null;
  hiBizNo?: string | null;
  eiBizNo?: string | null;
}

// ─── Constants ───

const TABS: { key: ReportType; label: string; desc: string; formNo: string }[] = [
  { key: "acquisition", label: "취득신고", desc: "별지 제6호서식 - 신규 입사 시 4대보험 자격취득", formNo: "별지 제6호서식" },
  { key: "loss", label: "상실신고", desc: "별지 제8호서식 - 퇴사/이직 시 4대보험 자격상실", formNo: "별지 제8호서식" },
  { key: "salary_change", label: "보수월액변경", desc: "별지 제27호서식 - 보수월액(소득월액) 변경 신고", formNo: "별지 제27호서식" },
];

// 국민연금 취득부호
const NP_ACQ_CODES = [
  { value: "1", label: "1 - 18세 이상 당연취득" },
  { value: "5", label: "5 - 일용근로자" },
  { value: "6", label: "6 - 단시간 근로자" },
  { value: "7", label: "7 - 18세 미만" },
];

// 건강보험 취득부호
const HI_ACQ_CODES = [
  { value: "00", label: "00 - 최초취득" },
  { value: "13", label: "13 - 기타" },
];

// 국민연금 상실부호
const NP_LOSS_CODES = [
  { value: "1", label: "1 - 사업장 탈퇴 (퇴직)" },
  { value: "2", label: "2 - 60세 도달" },
  { value: "3", label: "3 - 사망" },
  { value: "4", label: "4 - 국적상실/국외이주" },
  { value: "5", label: "5 - 다른 공적연금 가입" },
  { value: "11", label: "11 - 기타" },
];

// 건강보험 상실부호
const HI_LOSS_CODES = [
  { value: "1", label: "1 - 사용관계 종료 (퇴직)" },
  { value: "2", label: "2 - 적용제외 사유 발생" },
  { value: "3", label: "3 - 사망" },
  { value: "4", label: "4 - 국적상실/국외이주" },
  { value: "9", label: "9 - 기타" },
];

// 고용보험 상실사유코드
const EI_LOSS_CODES = [
  { value: "11", label: "11 - 자진퇴사" },
  { value: "22", label: "22 - 폐업/도산" },
  { value: "23", label: "23 - 경영상 필요 (인원감축 등)" },
  { value: "26", label: "26 - 근로자 귀책사유 (해고)" },
  { value: "31", label: "31 - 정년퇴직" },
  { value: "32", label: "32 - 계약기간 만료" },
  { value: "41", label: "41 - 고용보험 비적용" },
  { value: "42", label: "42 - 이중고용" },
];

const CHANGE_REASONS = [
  { value: "연봉인상 (정기)", label: "연봉인상 (정기)" },
  { value: "승진/직급 변경", label: "승진/직급 변경" },
  { value: "직무 변경", label: "직무 변경" },
  { value: "성과급 반영", label: "성과급 반영" },
  { value: "최저임금 인상", label: "최저임금 인상" },
  { value: "근로조건 변경", label: "근로조건 변경" },
  { value: "기타", label: "기타" },
];

const DEADLINE_INFO: Record<ReportType, string> = {
  acquisition: "국민연금·고용·산재: 취득일 다음달 15일까지 / 건강보험: 취득일로부터 14일 이내",
  loss: "국민연금·고용·산재: 상실일 다음달 15일까지 / 건강보험: 상실일로부터 14일 이내",
  salary_change: "보수 변경 사유 발생 후 14일 이내",
};

// ─── Main Component ───

export default function InsuranceReportPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("acquisition");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // ── 사업장 정보 소스 ──
  const [companySource, setCompanySource] = useState<"profile" | "client" | "manual">("profile");
  const [profileCompany, setProfileCompany] = useState<CompanyInfo>({});
  const [manualCompany, setManualCompany] = useState<CompanyInfo>({});
  const [clientCompanies, setClientCompanies] = useState<ClientCompanyItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientCompany, setClientCompany] = useState<CompanyInfo>({});
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ companyName: "", ownerName: "", bizRegNo: "", address: "", phone: "", npBizNo: "", hiBizNo: "", eiBizNo: "" });
  const company = companySource === "profile" ? profileCompany : companySource === "client" ? clientCompany : manualCompany;

  // ── 근로자 추가 정보 (인쇄 전용, DB 미저장) ──
  const [residentNo, setResidentNo] = useState("");
  const [workerAddress, setWorkerAddress] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");

  // ── 취득신고 필드 ──
  const [acqDate, setAcqDate] = useState(new Date().toISOString().split("T")[0]);
  const [npAcqCode, setNpAcqCode] = useState("1");
  const [npFirstMonthPay, setNpFirstMonthPay] = useState("2");
  const [npIncome, setNpIncome] = useState(0);
  const [hiAcqCode, setHiAcqCode] = useState("00");
  const [hiSalary, setHiSalary] = useState(0);
  const [eiSalary, setEiSalary] = useState(0);
  const [weeklyWorkHours, setWeeklyWorkHours] = useState(40);
  const [isContract, setIsContract] = useState(false);
  const [contractEndDate, setContractEndDate] = useState("");
  const [iaSalary, setIaSalary] = useState(0);
  const [acqNP, setAcqNP] = useState(true);
  const [acqHI, setAcqHI] = useState(true);
  const [acqEI, setAcqEI] = useState(true);
  const [acqIA, setAcqIA] = useState(true);

  // ── 상실신고 필드 ──
  const [lossDate, setLossDate] = useState("");
  const [lossLastWorkDate, setLossLastWorkDate] = useState("");
  const [npLossCode, setNpLossCode] = useState("1");
  const [hiLossCode, setHiLossCode] = useState("1");
  const [hiCurrentYearSalary, setHiCurrentYearSalary] = useState(0);
  const [hiCurrentYearMonths, setHiCurrentYearMonths] = useState(0);
  const [hiPrevYearSalary, setHiPrevYearSalary] = useState(0);
  const [hiPrevYearMonths, setHiPrevYearMonths] = useState(0);
  const [eiLossCode, setEiLossCode] = useState("11");
  const [eiLossDetail, setEiLossDetail] = useState("");
  const [eiCurrentYearSalary, setEiCurrentYearSalary] = useState(0);
  const [eiCurrentYearMonths, setEiCurrentYearMonths] = useState(0);
  const [eiPrevYearSalary, setEiPrevYearSalary] = useState(0);
  const [eiPrevYearMonths, setEiPrevYearMonths] = useState(0);
  const [eiSubmitLeaveConfirm, setEiSubmitLeaveConfirm] = useState(false);

  // ── 보수월액변경 필드 ──
  const [changeDate, setChangeDate] = useState(new Date().toISOString().split("T")[0]);
  const [beforeSalary, setBeforeSalary] = useState(0);
  const [afterSalary, setAfterSalary] = useState(0);
  const [changeReason, setChangeReason] = useState("연봉인상 (정기)");

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // ── Load data ──
  useEffect(() => {
    Promise.all([
      fetch("/api/labor/employees").then(r => r.json()),
      fetch("/api/user/company-profile").then(r => r.json()),
      fetch("/api/labor/insurance-report").then(r => r.json()),
      fetch("/api/labor/client-companies").then(r => r.json()),
    ]).then(([empRes, profileRes, reportRes, clientRes]) => {
      if (empRes.success) setEmployees(empRes.data);
      if (profileRes.success && profileRes.data) {
        const p = profileRes.data;
        setProfileCompany({
          companyName: p.companyName || "",
          ownerName: p.ownerName || "",
          bizRegNo: p.bizRegNo || "",
          address: p.address || "",
          phone: "",
          npBizNo: "",
          hiBizNo: "",
          eiBizNo: "",
        });
      }
      if (reportRes.success) setSavedReports(reportRes.data);
      if (clientRes.success) setClientCompanies(clientRes.data);
    }).catch(console.error);
  }, []);

  // ── 거래처 선택 시 CompanyInfo 동기화 ──
  useEffect(() => {
    if (selectedClientId) {
      const c = clientCompanies.find(cc => cc.id === selectedClientId);
      if (c) {
        setClientCompany({
          companyName: c.companyName || "",
          ownerName: c.ownerName || "",
          bizRegNo: c.bizRegNo || "",
          address: c.address || "",
          phone: c.phone || "",
          npBizNo: c.npBizNo || "",
          hiBizNo: c.hiBizNo || "",
          eiBizNo: c.eiBizNo || "",
        });
      }
    }
  }, [selectedClientId, clientCompanies]);

  const handleAddClient = async () => {
    if (!newClient.companyName) return;
    try {
      const res = await fetch("/api/labor/client-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      const data = await res.json();
      if (data.success) {
        setClientCompanies(prev => [...prev, data.data]);
        setSelectedClientId(data.data.id);
        setShowAddClient(false);
        setNewClient({ companyName: "", ownerName: "", bizRegNo: "", address: "", phone: "", npBizNo: "", hiBizNo: "", eiBizNo: "" });
      }
    } catch { /* ignore */ }
  };

  // ── Update form when employee changes ──
  useEffect(() => {
    if (selectedEmployee) {
      const sal = selectedEmployee.monthlySalary;
      setNpIncome(sal);
      setHiSalary(sal);
      setEiSalary(sal);
      setIaSalary(sal);
      setWeeklyWorkHours(selectedEmployee.weeklyWorkHours || 40);
      setIsContract(selectedEmployee.employmentType === "contract");
      setAcqNP(!selectedEmployee.nationalPensionExempt);
      setAcqHI(!selectedEmployee.healthInsuranceExempt);
      setAcqEI(!selectedEmployee.employmentInsuranceExempt);
      setBeforeSalary(sal);
      setResidentNo("");
      setWorkerAddress("");
      setWorkerPhone("");
      if (selectedEmployee.hireDate) {
        setAcqDate(new Date(selectedEmployee.hireDate).toISOString().split("T")[0]);
      }
      if (selectedEmployee.resignDate) {
        const rd = new Date(selectedEmployee.resignDate);
        setLossLastWorkDate(rd.toISOString().split("T")[0]);
        rd.setDate(rd.getDate() + 1);
        setLossDate(rd.toISOString().split("T")[0]);
      } else {
        setLossDate("");
        setLossLastWorkDate("");
      }
    }
  }, [selectedEmployee]);

  // ── Build report data ──
  const buildReportData = useCallback((): ReportData => {
    const base: ReportData = {
      reportDate: new Date().toISOString().split("T")[0],
      residentNo,
      workerAddress,
      workerPhone,
    };

    if (activeTab === "acquisition") {
      return {
        ...base,
        acquisitionDate: acqDate,
        npAcqCode, npFirstMonthPay, npIncome,
        hiAcqCode, hiSalary,
        eiSalary, weeklyWorkHours, isContract, contractEndDate,
        iaSalary,
        nationalPension: acqNP,
        healthInsurance: acqHI,
        employmentInsurance: acqEI,
        industrialAccident: acqIA,
      };
    }
    if (activeTab === "loss") {
      return {
        ...base,
        lossDate, lastWorkDate: lossLastWorkDate,
        npLossCode, hiLossCode,
        hiCurrentYearSalary, hiCurrentYearMonths,
        hiPrevYearSalary, hiPrevYearMonths,
        eiLossCode, eiLossDetail,
        eiCurrentYearSalary, eiCurrentYearMonths,
        eiPrevYearSalary, eiPrevYearMonths,
        eiSubmitLeaveConfirm,
      };
    }
    return {
      ...base,
      changeDate, beforeSalary, afterSalary, changeReason,
    };
  }, [activeTab, residentNo, workerAddress, workerPhone,
    acqDate, npAcqCode, npFirstMonthPay, npIncome, hiAcqCode, hiSalary, eiSalary, weeklyWorkHours, isContract, contractEndDate, iaSalary, acqNP, acqHI, acqEI, acqIA,
    lossDate, lossLastWorkDate, npLossCode, hiLossCode, hiCurrentYearSalary, hiCurrentYearMonths, hiPrevYearSalary, hiPrevYearMonths, eiLossCode, eiLossDetail, eiCurrentYearSalary, eiCurrentYearMonths, eiPrevYearSalary, eiPrevYearMonths, eiSubmitLeaveConfirm,
    changeDate, beforeSalary, afterSalary, changeReason]);

  const validate = (): string | null => {
    if (!selectedEmployeeId) return "직원을 선택해주세요.";
    if (activeTab === "acquisition") {
      if (!acqDate) return "자격취득일을 입력해주세요.";
      if (!npIncome && !hiSalary) return "보수월액(소득월액)을 입력해주세요.";
    }
    if (activeTab === "loss") {
      if (!lossDate) return "자격상실일을 입력해주세요.";
      if (!lossLastWorkDate) return "최종근무일을 입력해주세요.";
    }
    if (activeTab === "salary_change") {
      if (!changeDate) return "변경일자를 입력해주세요.";
      if (!afterSalary || afterSalary <= 0) return "변경 후 보수월액을 입력해주세요.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setSuccess(""); setSaving(true);
    try {
      const res = await fetch("/api/labor/insurance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          reportType: activeTab,
          reportData: buildReportData(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "저장 실패"); return; }
      setSuccess("신고서가 저장되었습니다.");
      setSavedReports(prev => [data.data, ...prev]);
      setShowPreview(true);
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewOnly = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setShowPreview(true);
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("신고서를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/labor/insurance-report/${reportId}`, { method: "DELETE" });
      if (res.ok) setSavedReports(prev => prev.filter(r => r.id !== reportId));
    } catch { /* ignore */ }
  };

  const handleLoadReport = (report: SavedReport) => {
    const emp = employees.find(e => e.id === report.employee.id);
    if (!emp) return;
    setSelectedEmployeeId(emp.id);
    setActiveTab(report.reportType as ReportType);
    const rd = JSON.parse(report.reportData);
    if (report.reportType === "acquisition") {
      setAcqDate(rd.acquisitionDate || "");
      setNpAcqCode(rd.npAcqCode || "1");
      setNpFirstMonthPay(rd.npFirstMonthPay || "2");
      setNpIncome(rd.npIncome || emp.monthlySalary);
      setHiAcqCode(rd.hiAcqCode || "00");
      setHiSalary(rd.hiSalary || emp.monthlySalary);
      setEiSalary(rd.eiSalary || emp.monthlySalary);
      setWeeklyWorkHours(rd.weeklyWorkHours || 40);
      setIsContract(rd.isContract || false);
      setContractEndDate(rd.contractEndDate || "");
      setIaSalary(rd.iaSalary || emp.monthlySalary);
      setAcqNP(rd.nationalPension !== false);
      setAcqHI(rd.healthInsurance !== false);
      setAcqEI(rd.employmentInsurance !== false);
      setAcqIA(rd.industrialAccident !== false);
    } else if (report.reportType === "loss") {
      setLossDate(rd.lossDate || "");
      setLossLastWorkDate(rd.lastWorkDate || "");
      setNpLossCode(rd.npLossCode || "1");
      setHiLossCode(rd.hiLossCode || "1");
      setHiCurrentYearSalary(rd.hiCurrentYearSalary || 0);
      setHiCurrentYearMonths(rd.hiCurrentYearMonths || 0);
      setHiPrevYearSalary(rd.hiPrevYearSalary || 0);
      setHiPrevYearMonths(rd.hiPrevYearMonths || 0);
      setEiLossCode(rd.eiLossCode || "11");
      setEiLossDetail(rd.eiLossDetail || "");
      setEiCurrentYearSalary(rd.eiCurrentYearSalary || 0);
      setEiCurrentYearMonths(rd.eiCurrentYearMonths || 0);
      setEiPrevYearSalary(rd.eiPrevYearSalary || 0);
      setEiPrevYearMonths(rd.eiPrevYearMonths || 0);
      setEiSubmitLeaveConfirm(rd.eiSubmitLeaveConfirm || false);
    } else {
      setChangeDate(rd.changeDate || "");
      setBeforeSalary(rd.beforeSalary || emp.monthlySalary);
      setAfterSalary(rd.afterSalary || 0);
      setChangeReason(rd.changeReason || "연봉인상 (정기)");
    }
    if (rd.residentNo) setResidentNo(rd.residentNo);
    if (rd.workerAddress) setWorkerAddress(rd.workerAddress);
    if (rd.workerPhone) setWorkerPhone(rd.workerPhone);
    setShowPreview(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">4대보험 신고서</h1>
        <p className="text-gray-600 mt-1">국민건강보험법·국민연금법·고용보험법 시행규칙에 따른 법정양식 신고서를 자동 작성합니다.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setShowPreview(false); setError(""); setSuccess(""); }}
            className={`flex-1 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
            <span className="hidden sm:inline text-xs text-gray-400 ml-1">({tab.formNo})</span>
          </button>
        ))}
      </div>

      {/* Deadline */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <strong>신고기한:</strong> {DEADLINE_INFO[activeTab]}
        <div className="text-xs text-amber-600 mt-1">제출처: 4대 사회보험 정보연계센터(www.4insure.or.kr) 또는 관할 공단 지사</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: Form ─── */}
        <div className="lg:col-span-2 space-y-4">

          {/* 1. 사업장 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. 사업장 정보</CardTitle>
              <CardDescription>
                <span className="flex flex-wrap gap-3 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="companySource" checked={companySource === "profile"} onChange={() => setCompanySource("profile")} />
                    <span className="text-sm">내 기업프로필</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="companySource" checked={companySource === "client"} onChange={() => setCompanySource("client")} />
                    <span className="text-sm">거래처 프로필</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="companySource" checked={companySource === "manual"} onChange={() => setCompanySource("manual")} />
                    <span className="text-sm">직접 작성</span>
                  </label>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 내 기업프로필 */}
              {companySource === "profile" && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  {profileCompany.companyName ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <span>사업장명: <strong>{profileCompany.companyName}</strong></span>
                        <span>대표자: <strong>{profileCompany.ownerName}</strong></span>
                        <span>사업자번호: <strong>{profileCompany.bizRegNo}</strong></span>
                        <span>소재지: <strong>{profileCompany.address}</strong></span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">사업장관리번호·전화번호는 아래에서 직접 입력하세요.</p>
                    </>
                  ) : (
                    <p className="text-gray-500">기업프로필이 등록되어 있지 않습니다. <a href="/mypage/company" className="text-blue-600 underline">마이페이지</a>에서 등록하거나 다른 옵션을 선택하세요.</p>
                  )}
                </div>
              )}

              {/* 거래처 프로필 */}
              {companySource === "client" && (
                <div className="space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">거래처 선택</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="거래처를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientCompanies.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.companyName} {c.ownerName ? `(${c.ownerName})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowAddClient(!showAddClient)}>
                      {showAddClient ? "취소" : "+ 새 거래처"}
                    </Button>
                  </div>

                  {/* 선택된 거래처 정보 표시 */}
                  {selectedClientId && clientCompany.companyName && (
                    <div className="bg-blue-50 rounded-lg p-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span>사업장명: <strong>{clientCompany.companyName}</strong></span>
                        <span>대표자: <strong>{clientCompany.ownerName || "-"}</strong></span>
                        <span>사업자번호: <strong>{clientCompany.bizRegNo || "-"}</strong></span>
                        <span>소재지: <strong>{clientCompany.address || "-"}</strong></span>
                        {clientCompany.npBizNo && <span>국민연금: <strong>{clientCompany.npBizNo}</strong></span>}
                        {clientCompany.hiBizNo && <span>건강보험: <strong>{clientCompany.hiBizNo}</strong></span>}
                        {clientCompany.eiBizNo && <span>고용·산재: <strong>{clientCompany.eiBizNo}</strong></span>}
                        {clientCompany.phone && <span>전화: <strong>{clientCompany.phone}</strong></span>}
                      </div>
                    </div>
                  )}

                  {/* 새 거래처 등록 폼 */}
                  {showAddClient && (
                    <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50 space-y-3">
                      <p className="text-sm font-medium text-blue-800">새 거래처 등록</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">사업장명 *</Label>
                          <Input value={newClient.companyName} onChange={e => setNewClient(p => ({ ...p, companyName: e.target.value }))} placeholder="거래처 상호" />
                        </div>
                        <div>
                          <Label className="text-xs">대표자명</Label>
                          <Input value={newClient.ownerName} onChange={e => setNewClient(p => ({ ...p, ownerName: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">사업자등록번호</Label>
                          <Input value={newClient.bizRegNo} onChange={e => setNewClient(p => ({ ...p, bizRegNo: e.target.value }))} placeholder="000-00-00000" />
                        </div>
                        <div>
                          <Label className="text-xs">소재지</Label>
                          <Input value={newClient.address} onChange={e => setNewClient(p => ({ ...p, address: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">전화번호</Label>
                          <Input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="02-0000-0000" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">국민연금 관리번호</Label>
                          <Input value={newClient.npBizNo} onChange={e => setNewClient(p => ({ ...p, npBizNo: e.target.value }))} className="text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">건강보험 관리번호</Label>
                          <Input value={newClient.hiBizNo} onChange={e => setNewClient(p => ({ ...p, hiBizNo: e.target.value }))} className="text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">고용·산재 관리번호</Label>
                          <Input value={newClient.eiBizNo} onChange={e => setNewClient(p => ({ ...p, eiBizNo: e.target.value }))} className="text-xs" />
                        </div>
                      </div>
                      <Button size="sm" onClick={handleAddClient} disabled={!newClient.companyName}>등록</Button>
                    </div>
                  )}

                  {clientCompanies.length === 0 && !showAddClient && (
                    <p className="text-sm text-gray-500">등록된 거래처가 없습니다. &apos;+ 새 거래처&apos; 버튼으로 등록하세요.</p>
                  )}
                </div>
              )}

              {/* 직접 작성 */}
              {companySource === "manual" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">사업장 명칭 *</Label>
                    <Input value={manualCompany.companyName || ""} onChange={e => setManualCompany(p => ({ ...p, companyName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">대표자명 *</Label>
                    <Input value={manualCompany.ownerName || ""} onChange={e => setManualCompany(p => ({ ...p, ownerName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">사업자등록번호</Label>
                    <Input value={manualCompany.bizRegNo || ""} onChange={e => setManualCompany(p => ({ ...p, bizRegNo: e.target.value }))} placeholder="000-00-00000" />
                  </div>
                  <div>
                    <Label className="text-xs">소재지</Label>
                    <Input value={manualCompany.address || ""} onChange={e => setManualCompany(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* 사업장관리번호 + 전화번호 (프로필/수동 모드에서만 표시, 거래처는 이미 포함) */}
              {companySource !== "client" && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-medium text-gray-700 mb-2">사업장 관리번호 · 연락처</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">국민연금</Label>
                    <Input value={(companySource === "profile" ? profileCompany : manualCompany).npBizNo || ""}
                      onChange={e => {
                        const setter = companySource === "profile" ? setProfileCompany : setManualCompany;
                        setter(p => ({ ...p, npBizNo: e.target.value }));
                      }}
                      placeholder="관리번호" className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">건강보험</Label>
                    <Input value={(companySource === "profile" ? profileCompany : manualCompany).hiBizNo || ""}
                      onChange={e => {
                        const setter = companySource === "profile" ? setProfileCompany : setManualCompany;
                        setter(p => ({ ...p, hiBizNo: e.target.value }));
                      }}
                      placeholder="관리번호" className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">고용·산재보험</Label>
                    <Input value={(companySource === "profile" ? profileCompany : manualCompany).eiBizNo || ""}
                      onChange={e => {
                        const setter = companySource === "profile" ? setProfileCompany : setManualCompany;
                        setter(p => ({ ...p, eiBizNo: e.target.value }));
                      }}
                      placeholder="관리번호" className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">전화번호</Label>
                    <Input value={(companySource === "profile" ? profileCompany : manualCompany).phone || ""}
                      onChange={e => {
                        const setter = companySource === "profile" ? setProfileCompany : setManualCompany;
                        setter(p => ({ ...p, phone: e.target.value }));
                      }}
                      placeholder="02-0000-0000" className="text-xs" />
                  </div>
                </div>
              </div>
              )}
            </CardContent>
          </Card>

          {/* 2. 직원(가입자) 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. 가입자(피보험자) 선택</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="직원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} {emp.department ? `(${emp.department})` : ""} - {emp.monthlySalary.toLocaleString()}원
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedEmployee && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                    <span className="text-gray-500">성명: <strong className="text-gray-900">{selectedEmployee.name}</strong></span>
                    <span className="text-gray-500">부서: <strong className="text-gray-900">{selectedEmployee.department || "-"}</strong></span>
                    <span className="text-gray-500">직위: <strong className="text-gray-900">{selectedEmployee.position || "-"}</strong></span>
                    <span className="text-gray-500">입사일: <strong className="text-gray-900">{new Date(selectedEmployee.hireDate).toLocaleDateString("ko-KR")}</strong></span>
                    <span className="text-gray-500">월급여: <strong className="text-gray-900">{selectedEmployee.monthlySalary.toLocaleString()}원</strong></span>
                    <span className="text-gray-500">고용형태: <strong className="text-gray-900">{{ regular: "정규직", contract: "계약직", parttime: "파트타임", daily: "일용직" }[selectedEmployee.employmentType] || selectedEmployee.employmentType}</strong></span>
                  </div>
                </div>
              )}

              {/* 인쇄용 개인정보 */}
              {selectedEmployee && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">인쇄용 개인정보 (서버 미저장)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">주민등록번호</Label>
                      <Input value={residentNo} onChange={e => setResidentNo(e.target.value)} placeholder="000000-0000000" maxLength={14} className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">주소</Label>
                      <Input value={workerAddress} onChange={e => setWorkerAddress(e.target.value)} placeholder="근로자 주소" className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">전화번호</Label>
                      <Input value={workerPhone} onChange={e => setWorkerPhone(e.target.value)} placeholder="010-0000-0000" className="text-xs" />
                    </div>
                  </div>
                </div>
              )}

              {employees.length === 0 && (
                <p className="text-sm text-gray-500">
                  등록된 직원이 없습니다. <a href="/labor/payslip" className="text-blue-600 underline">급여명세서</a> 메뉴에서 직원을 먼저 등록해주세요.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 3. 신고 내용 (탭별) */}
          {selectedEmployee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. {TABS.find(t => t.key === activeTab)?.label} 내용</CardTitle>
                <CardDescription>{TABS.find(t => t.key === activeTab)?.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* ═══ 취득신고 ═══ */}
                {activeTab === "acquisition" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>자격취득일 (입사일) *</Label>
                        <Input type="date" value={acqDate} onChange={e => setAcqDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>가입 보험 선택</Label>
                        <div className="flex gap-3 mt-1">
                          {[
                            { label: "국민연금", checked: acqNP, set: setAcqNP },
                            { label: "건강보험", checked: acqHI, set: setAcqHI },
                            { label: "고용보험", checked: acqEI, set: setAcqEI },
                            { label: "산재보험", checked: acqIA, set: setAcqIA },
                          ].map(i => (
                            <label key={i.label} className="flex items-center gap-1 text-xs cursor-pointer">
                              <input type="checkbox" checked={i.checked} onChange={e => i.set(e.target.checked)} className="rounded border-gray-300" />
                              {i.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 국민연금 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-blue-800">국민연금</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">취득부호</Label>
                          <Select value={npAcqCode} onValueChange={setNpAcqCode}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{NP_ACQ_CODES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">취득월 납부여부</Label>
                          <Select value={npFirstMonthPay} onValueChange={setNpFirstMonthPay}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 - 희망 (입사월부터)</SelectItem>
                              <SelectItem value="2">2 - 미희망 (다음달부터)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">소득월액 (원)</Label>
                          <Input type="number" value={npIncome} onChange={e => setNpIncome(Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    {/* 건강보험 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-green-800">건강보험</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">취득부호</Label>
                          <Select value={hiAcqCode} onValueChange={setHiAcqCode}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{HI_ACQ_CODES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">보수월액 (원)</Label>
                          <Input type="number" value={hiSalary} onChange={e => setHiSalary(Number(e.target.value))} />
                        </div>
                      </div>
                    </div>

                    {/* 고용보험 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-orange-800">고용보험</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">보수월액 (원)</Label>
                          <Input type="number" value={eiSalary} onChange={e => setEiSalary(Number(e.target.value))} />
                        </div>
                        <div>
                          <Label className="text-xs">1주 소정근로시간</Label>
                          <Input type="number" value={weeklyWorkHours} onChange={e => setWeeklyWorkHours(Number(e.target.value))} />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="checkbox" checked={isContract} onChange={e => setIsContract(e.target.checked)} className="rounded border-gray-300" />
                            계약직 여부
                          </label>
                        </div>
                        {isContract && (
                          <div>
                            <Label className="text-xs">계약종료 예정일</Label>
                            <Input type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 산재보험 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-red-800">산재보험</h4>
                      <div>
                        <Label className="text-xs">보수월액 (원)</Label>
                        <Input type="number" value={iaSalary} onChange={e => setIaSalary(Number(e.target.value))} />
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">* 보수월액(소득월액): 비과세 소득(식대 등)을 제외한 월 급여 총액을 기재하세요.</p>
                  </>
                )}

                {/* ═══ 상실신고 ═══ */}
                {activeTab === "loss" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>최종근무일 *</Label>
                        <Input type="date" value={lossLastWorkDate} onChange={e => {
                          setLossLastWorkDate(e.target.value);
                          if (e.target.value) {
                            const next = new Date(e.target.value);
                            next.setDate(next.getDate() + 1);
                            setLossDate(next.toISOString().split("T")[0]);
                          }
                        }} />
                      </div>
                      <div>
                        <Label>자격상실일 * <span className="text-xs text-gray-400">(퇴사일 다음날)</span></Label>
                        <Input type="date" value={lossDate} onChange={e => setLossDate(e.target.value)} />
                      </div>
                    </div>

                    {/* 국민연금 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-blue-800">국민연금</h4>
                      <div>
                        <Label className="text-xs">상실부호</Label>
                        <Select value={npLossCode} onValueChange={setNpLossCode}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{NP_LOSS_CODES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* 건강보험 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-green-800">건강보험</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">상실부호</Label>
                          <Select value={hiLossCode} onValueChange={setHiLossCode}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{HI_LOSS_CODES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">당해연도 보수총액</Label>
                          <Input type="number" value={hiCurrentYearSalary || ""} onChange={e => setHiCurrentYearSalary(Number(e.target.value))} placeholder="원" />
                        </div>
                        <div>
                          <Label className="text-xs">근무개월수</Label>
                          <Input type="number" value={hiCurrentYearMonths || ""} onChange={e => setHiCurrentYearMonths(Number(e.target.value))} placeholder="개월" />
                        </div>
                        <div>
                          <Label className="text-xs">전년도 보수총액</Label>
                          <Input type="number" value={hiPrevYearSalary || ""} onChange={e => setHiPrevYearSalary(Number(e.target.value))} placeholder="원" />
                        </div>
                        <div>
                          <Label className="text-xs">근무개월수</Label>
                          <Input type="number" value={hiPrevYearMonths || ""} onChange={e => setHiPrevYearMonths(Number(e.target.value))} placeholder="개월" />
                        </div>
                      </div>
                    </div>

                    {/* 고용보험 */}
                    <div className="border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-orange-800">고용보험</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">상실사유코드</Label>
                          <Select value={eiLossCode} onValueChange={setEiLossCode}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{EI_LOSS_CODES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">구체적 상실사유 (상세)</Label>
                          <Input value={eiLossDetail} onChange={e => setEiLossDetail(e.target.value)} placeholder="상세 사유" className="text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">당해연도 보수총액</Label>
                          <Input type="number" value={eiCurrentYearSalary || ""} onChange={e => setEiCurrentYearSalary(Number(e.target.value))} placeholder="원" />
                        </div>
                        <div>
                          <Label className="text-xs">근무개월수</Label>
                          <Input type="number" value={eiCurrentYearMonths || ""} onChange={e => setEiCurrentYearMonths(Number(e.target.value))} placeholder="개월" />
                        </div>
                        <div>
                          <Label className="text-xs">전년도 보수총액</Label>
                          <Input type="number" value={eiPrevYearSalary || ""} onChange={e => setEiPrevYearSalary(Number(e.target.value))} placeholder="원" />
                        </div>
                        <div>
                          <Label className="text-xs">근무개월수</Label>
                          <Input type="number" value={eiPrevYearMonths || ""} onChange={e => setEiPrevYearMonths(Number(e.target.value))} placeholder="개월" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={eiSubmitLeaveConfirm} onChange={e => setEiSubmitLeaveConfirm(e.target.checked)} className="rounded border-gray-300" />
                        이직확인서 동시제출
                      </label>
                    </div>

                    <p className="text-xs text-gray-500">* 보수총액: 비과세 소득 제외, 세전 기준 (퇴직금 제외)</p>
                  </>
                )}

                {/* ═══ 보수월액변경 ═══ */}
                {activeTab === "salary_change" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>변경일자 *</Label>
                        <Input type="date" value={changeDate} onChange={e => setChangeDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>변경사유</Label>
                        <Select value={changeReason} onValueChange={setChangeReason}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{CHANGE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>변경 전 보수월액 (원)</Label>
                        <Input type="number" value={beforeSalary} onChange={e => setBeforeSalary(Number(e.target.value))} />
                      </div>
                      <div>
                        <Label>변경 후 보수월액 (원) *</Label>
                        <Input type="number" value={afterSalary} onChange={e => setAfterSalary(Number(e.target.value))} />
                      </div>
                    </div>
                    {beforeSalary > 0 && afterSalary > 0 && afterSalary !== beforeSalary && (
                      <div className={`text-sm font-medium p-3 rounded-lg ${afterSalary > beforeSalary ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {afterSalary > beforeSalary ? "인상" : "인하"}: {Math.abs(afterSalary - beforeSalary).toLocaleString()}원
                        ({((afterSalary - beforeSalary) / beforeSalary * 100).toFixed(1)}%)
                      </div>
                    )}
                  </>
                )}

                {/* Error / Success */}
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                {success && <Alert><AlertDescription className="text-green-700">{success}</AlertDescription></Alert>}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handlePreviewOnly}>미리보기</Button>
                  <Button onClick={handleSave} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
                  {showPreview && selectedEmployee && (
                    <InsuranceReportPdf
                      reportType={activeTab}
                      employee={{
                        name: selectedEmployee.name,
                        birthDate: selectedEmployee.birthDate,
                        department: selectedEmployee.department,
                        position: selectedEmployee.position,
                        hireDate: selectedEmployee.hireDate,
                        resignDate: selectedEmployee.resignDate,
                        employmentType: selectedEmployee.employmentType,
                        monthlySalary: selectedEmployee.monthlySalary,
                      }}
                      company={company}
                      reportData={buildReportData()}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Right: Sidebar ─── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">저장된 신고서</CardTitle>
            </CardHeader>
            <CardContent>
              {savedReports.length === 0 ? (
                <p className="text-sm text-gray-500">아직 작성한 신고서가 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {savedReports.map(report => (
                    <div key={report.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium truncate">
                        {report.employee.name} - {TABS.find(t => t.key === report.reportType)?.label}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(report.createdAt).toLocaleDateString("ko-KR")}</p>
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => handleLoadReport(report)}
                          className="flex-1 text-xs py-1.5 px-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">불러오기</button>
                        <button onClick={() => handleDelete(report.id)}
                          className="text-xs py-1.5 px-2 bg-red-50 text-red-600 rounded hover:bg-red-100">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">신고 안내</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-3">
              <div>
                <p className="font-medium text-gray-800 mb-1">온라인 신고</p>
                <p>4대 사회보험 정보연계센터<br/><a href="https://www.4insure.or.kr" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">www.4insure.or.kr</a></p>
              </div>
              <div>
                <p className="font-medium text-gray-800 mb-1">EDI 신고</p>
                <p>국민건강보험공단 EDI<br/><a href="https://edi.nhis.or.kr" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">edi.nhis.or.kr</a></p>
              </div>
              <div className="border-t pt-3">
                <p className="font-medium text-gray-800 mb-1">법적 근거</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>국민연금법 제21조, 제22조</li>
                  <li>국민건강보험법 제11조, 제71조</li>
                  <li>고용보험법 제15조, 제16조</li>
                  <li>산업재해보상보험법 제5조</li>
                </ul>
              </div>
              <div className="border-t pt-3">
                <p className="font-medium text-gray-800 mb-1">주의사항</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>취득일 = <strong>입사일</strong> (근로 시작일)</li>
                  <li>상실일 = <strong>퇴사일 다음 날</strong></li>
                  <li>보수월액 = 비과세 소득 제외 금액</li>
                  <li>미신고/지연신고 시 <strong>과태료 부과</strong> 가능</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
