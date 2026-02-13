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

interface CompanyInfo {
  companyName?: string;
  ownerName?: string;
  bizRegNo?: string;
  address?: string;
}

interface SavedReport {
  id: string;
  reportType: string;
  reportData: string;
  status: string;
  createdAt: string;
  employee: {
    id: string;
    name: string;
    department?: string | null;
    position?: string | null;
  };
}

// ─── Constants ───

const TABS: { key: ReportType; label: string; desc: string; icon: string }[] = [
  { key: "acquisition", label: "취득신고", desc: "신규 입사 시 4대보험 자격취득 신고", icon: "+" },
  { key: "loss", label: "상실신고", desc: "퇴사/이직 시 4대보험 자격상실 신고", icon: "-" },
  { key: "salary_change", label: "보수월액변경", desc: "급여 변경 시 보수월액 변경 신고", icon: "↕" },
];

const ACQUISITION_REASONS = [
  { value: "신규입사", label: "신규입사" },
  { value: "전근", label: "전근 (사업장 이동)" },
  { value: "법인전환", label: "법인전환" },
  { value: "적용확대", label: "적용확대 (소정근로시간 변경 등)" },
  { value: "기타", label: "기타" },
];

const LOSS_REASONS = [
  { value: "resign", label: "자진퇴사 (자발적 이직)" },
  { value: "dismiss", label: "해고 (비자발적 이직)" },
  { value: "contract_end", label: "계약만료" },
  { value: "retirement", label: "정년퇴직" },
  { value: "transfer", label: "전근 (사업장 이동)" },
  { value: "death", label: "사망" },
  { value: "other", label: "기타" },
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

const DEADLINE_INFO: Record<ReportType, { deadline: string; where: string }> = {
  acquisition: {
    deadline: "자격취득일(입사일)로부터 14일 이내",
    where: "4대 사회보험 정보연계센터(www.4insure.or.kr) 또는 관할 국민연금공단/건강보험공단 지사",
  },
  loss: {
    deadline: "자격상실일(퇴사일 다음날)로부터 14일 이내",
    where: "4대 사회보험 정보연계센터(www.4insure.or.kr) 또는 관할 지사",
  },
  salary_change: {
    deadline: "보수 변경 사유 발생 후 14일 이내",
    where: "4대 사회보험 정보연계센터(www.4insure.or.kr) 또는 관할 지사",
  },
};

// ─── Main Component ───

export default function InsuranceReportPage() {
  const [activeTab, setActiveTab] = useState<ReportType>("acquisition");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [company, setCompany] = useState<CompanyInfo>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // 인쇄 전용 (DB 미저장, 개인정보 보호)
  const [residentNo, setResidentNo] = useState("");

  // Form states - acquisition
  const [acqDate, setAcqDate] = useState(new Date().toISOString().split("T")[0]);
  const [acqReason, setAcqReason] = useState("신규입사");
  const [acqWeeklyHours, setAcqWeeklyHours] = useState(40);
  const [acqMonthlyIncome, setAcqMonthlyIncome] = useState(0);
  const [acqNP, setAcqNP] = useState(true);
  const [acqHI, setAcqHI] = useState(true);
  const [acqEI, setAcqEI] = useState(true);
  const [acqIA, setAcqIA] = useState(true);

  // Form states - loss
  const [lossDate, setLossDate] = useState("");
  const [lossLastWorkDate, setLossLastWorkDate] = useState("");
  const [lossReason, setLossReason] = useState("resign");
  const [lossReasonDetail, setLossReasonDetail] = useState("");
  const [lossAvgSalary, setLossAvgSalary] = useState(0);

  // Form states - salary change
  const [changeDate, setChangeDate] = useState(new Date().toISOString().split("T")[0]);
  const [beforeSalary, setBeforeSalary] = useState(0);
  const [afterSalary, setAfterSalary] = useState(0);
  const [changeReason, setChangeReason] = useState("연봉인상 (정기)");

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Load data
  useEffect(() => {
    Promise.all([
      fetch("/api/labor/employees").then(r => r.json()),
      fetch("/api/user/company-profile").then(r => r.json()),
      fetch("/api/labor/insurance-report").then(r => r.json()),
    ]).then(([empRes, profileRes, reportRes]) => {
      if (empRes.success) setEmployees(empRes.data);
      if (profileRes?.companyName || profileRes?.ownerName) {
        setCompany({
          companyName: profileRes.companyName,
          ownerName: profileRes.ownerName,
          bizRegNo: profileRes.bizRegNo,
          address: profileRes.address,
        });
      }
      if (reportRes.success) setSavedReports(reportRes.data);
    }).catch(console.error);
  }, []);

  // Update form when employee changes
  useEffect(() => {
    if (selectedEmployee) {
      setAcqWeeklyHours(selectedEmployee.weeklyWorkHours || 40);
      setAcqMonthlyIncome(selectedEmployee.monthlySalary);
      setAcqNP(!selectedEmployee.nationalPensionExempt);
      setAcqHI(!selectedEmployee.healthInsuranceExempt);
      setAcqEI(!selectedEmployee.employmentInsuranceExempt);
      setLossAvgSalary(selectedEmployee.monthlySalary);
      setBeforeSalary(selectedEmployee.monthlySalary);
      setResidentNo("");
      if (selectedEmployee.hireDate) {
        setAcqDate(new Date(selectedEmployee.hireDate).toISOString().split("T")[0]);
      }
      if (selectedEmployee.resignDate) {
        // 상실일 = 퇴사일 다음날
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

  const buildReportData = useCallback(() => {
    const base = { reportDate: new Date().toISOString().split("T")[0] };

    if (activeTab === "acquisition") {
      return {
        ...base,
        acquisitionDate: acqDate,
        acquisitionReason: acqReason,
        weeklyWorkHours: acqWeeklyHours,
        monthlyIncome: acqMonthlyIncome,
        nationalPension: acqNP,
        healthInsurance: acqHI,
        employmentInsurance: acqEI,
        industrialAccident: acqIA,
      };
    }
    if (activeTab === "loss") {
      return {
        ...base,
        lossDate,
        lastWorkDate: lossLastWorkDate,
        lossReason,
        lossReasonDetail,
        avgSalary3Months: lossAvgSalary,
      };
    }
    return {
      ...base,
      changeDate,
      beforeSalary,
      afterSalary,
      changeReason,
    };
  }, [activeTab, acqDate, acqReason, acqWeeklyHours, acqMonthlyIncome, acqNP, acqHI, acqEI, acqIA, lossDate, lossLastWorkDate, lossReason, lossReasonDetail, lossAvgSalary, changeDate, beforeSalary, afterSalary, changeReason]);

  const validate = (): string | null => {
    if (!selectedEmployeeId) return "직원을 선택해주세요.";
    if (activeTab === "acquisition") {
      if (!acqDate) return "자격취득일을 입력해주세요.";
      if (!acqMonthlyIncome || acqMonthlyIncome <= 0) return "월 보수액을 입력해주세요.";
    }
    if (activeTab === "loss") {
      if (!lossDate) return "자격상실일을 입력해주세요.";
      if (!lossLastWorkDate) return "최종근무일을 입력해주세요.";
    }
    if (activeTab === "salary_change") {
      if (!changeDate) return "변경일자를 입력해주세요.";
      if (!afterSalary || afterSalary <= 0) return "변경 후 보수월액을 입력해주세요.";
      if (afterSalary === beforeSalary) return "변경 전후 금액이 동일합니다.";
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
      setSuccess("신고서가 저장되었습니다. 아래 미리보기를 확인하세요.");
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
      setAcqReason(rd.acquisitionReason || "신규입사");
      setAcqWeeklyHours(rd.weeklyWorkHours || 40);
      setAcqMonthlyIncome(rd.monthlyIncome || emp.monthlySalary);
      setAcqNP(rd.nationalPension !== false);
      setAcqHI(rd.healthInsurance !== false);
      setAcqEI(rd.employmentInsurance !== false);
      setAcqIA(rd.industrialAccident !== false);
    } else if (report.reportType === "loss") {
      setLossDate(rd.lossDate || "");
      setLossLastWorkDate(rd.lastWorkDate || "");
      setLossReason(rd.lossReason || "resign");
      setLossReasonDetail(rd.lossReasonDetail || "");
      setLossAvgSalary(rd.avgSalary3Months || emp.monthlySalary);
    } else {
      setChangeDate(rd.changeDate || "");
      setBeforeSalary(rd.beforeSalary || emp.monthlySalary);
      setAfterSalary(rd.afterSalary || 0);
      setChangeReason(rd.changeReason || "연봉인상 (정기)");
    }
    setShowPreview(true);
  };

  const deadlineInfo = DEADLINE_INFO[activeTab];

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">4대보험 신고서</h1>
        <p className="text-gray-600 mt-1">직원의 4대보험 취득/상실/보수월액변경 신고서를 자동 작성합니다.</p>
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
            <span className="mr-1">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Deadline Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
        <div className="flex gap-4 text-amber-800">
          <div><strong>신고기한:</strong> {deadlineInfo.deadline}</div>
        </div>
        <div className="text-amber-700 mt-1 text-xs"><strong>제출처:</strong> {deadlineInfo.where}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Employee Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">직원 선택</CardTitle>
              <CardDescription>신고할 직원을 선택하세요.</CardDescription>
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
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-gray-500">이름: <strong className="text-gray-900">{selectedEmployee.name}</strong></span>
                    <span className="text-gray-500">부서: <strong className="text-gray-900">{selectedEmployee.department || "-"}</strong></span>
                    <span className="text-gray-500">입사일: <strong className="text-gray-900">{new Date(selectedEmployee.hireDate).toLocaleDateString("ko-KR")}</strong></span>
                    <span className="text-gray-500">월급여: <strong className="text-gray-900">{selectedEmployee.monthlySalary.toLocaleString()}원</strong></span>
                  </div>
                </div>
              )}

              {/* 주민등록번호 - 인쇄 전용 */}
              {selectedEmployee && (
                <div>
                  <Label className="text-xs text-gray-500">주민등록번호 (인쇄용, 서버 미저장)</Label>
                  <Input
                    type="text"
                    value={residentNo}
                    onChange={e => setResidentNo(e.target.value)}
                    placeholder="000000-0000000"
                    maxLength={14}
                  />
                </div>
              )}

              {employees.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  등록된 직원이 없습니다. <a href="/labor/payslip" className="text-blue-600 underline">급여명세서</a> 메뉴에서 직원을 먼저 등록해주세요.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tab-specific form */}
          {selectedEmployee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{TABS.find(t => t.key === activeTab)?.label} 정보 입력</CardTitle>
                <CardDescription>{TABS.find(t => t.key === activeTab)?.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ─── 취득신고 ─── */}
                {activeTab === "acquisition" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>자격취득일 *</Label>
                        <Input type="date" value={acqDate} onChange={e => setAcqDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>취득사유 *</Label>
                        <Select value={acqReason} onValueChange={setAcqReason}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACQUISITION_REASONS.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>주 소정근로시간</Label>
                        <Input type="number" value={acqWeeklyHours} onChange={e => setAcqWeeklyHours(Number(e.target.value))} />
                      </div>
                      <div>
                        <Label>월 보수액 (원) *</Label>
                        <Input type="number" value={acqMonthlyIncome} onChange={e => setAcqMonthlyIncome(Number(e.target.value))} />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">가입 보험 선택</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "국민연금", checked: acqNP, setter: setAcqNP },
                          { label: "건강보험", checked: acqHI, setter: setAcqHI },
                          { label: "고용보험", checked: acqEI, setter: setAcqEI },
                          { label: "산재보험", checked: acqIA, setter: setAcqIA },
                        ].map(item => (
                          <label key={item.label} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
                            <input type="checkbox" checked={item.checked} onChange={e => item.setter(e.target.checked)} className="rounded border-gray-300" />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ─── 상실신고 ─── */}
                {activeTab === "loss" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>최종근무일 *</Label>
                        <Input type="date" value={lossLastWorkDate} onChange={e => {
                          setLossLastWorkDate(e.target.value);
                          // 상실일 자동 설정 (최종근무일 다음날)
                          if (e.target.value) {
                            const next = new Date(e.target.value);
                            next.setDate(next.getDate() + 1);
                            setLossDate(next.toISOString().split("T")[0]);
                          }
                        }} />
                      </div>
                      <div>
                        <Label>자격상실일 * <span className="text-xs text-gray-400">(최종근무일 다음날)</span></Label>
                        <Input type="date" value={lossDate} onChange={e => setLossDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>상실사유 *</Label>
                        <Select value={lossReason} onValueChange={setLossReason}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LOSS_REASONS.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>상실사유 상세</Label>
                        <Input value={lossReasonDetail} onChange={e => setLossReasonDetail(e.target.value)} placeholder="상세 사유 입력 (선택)" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>최근 3개월 평균보수 (원)</Label>
                        <Input type="number" value={lossAvgSalary} onChange={e => setLossAvgSalary(Number(e.target.value))} />
                        <p className="text-xs text-gray-400 mt-1">퇴직 전 3개월간 지급된 임금 총액의 월 평균 (고용보험 실업급여 산정 기준)</p>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── 보수월액변경 ─── */}
                {activeTab === "salary_change" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>변경일자 *</Label>
                      <Input type="date" value={changeDate} onChange={e => setChangeDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>변경사유 *</Label>
                      <Select value={changeReason} onValueChange={setChangeReason}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANGE_REASONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
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
                    {beforeSalary > 0 && afterSalary > 0 && afterSalary !== beforeSalary && (
                      <div className="sm:col-span-2">
                        <div className={`text-sm font-medium p-3 rounded-lg ${afterSalary > beforeSalary ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                          {afterSalary > beforeSalary ? "인상" : "인하"}: {Math.abs(afterSalary - beforeSalary).toLocaleString()}원
                          ({((afterSalary - beforeSalary) / beforeSalary * 100).toFixed(1)}%)
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error / Success */}
                {error && (
                  <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                )}
                {success && (
                  <Alert><AlertDescription className="text-green-700">{success}</AlertDescription></Alert>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handlePreviewOnly}>미리보기</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "저장 중..." : "저장"}
                  </Button>
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
                      residentNo={residentNo}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inline Preview */}
          {showPreview && selectedEmployee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">미리보기</CardTitle>
                <CardDescription>인쇄 시 아래와 같은 형식으로 출력됩니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <InlinePreview
                  reportType={activeTab}
                  employee={selectedEmployee}
                  company={company}
                  reportData={buildReportData()}
                  residentNo={residentNo}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Saved Reports + Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">저장된 신고서</CardTitle>
              <CardDescription>최근 작성한 신고서</CardDescription>
            </CardHeader>
            <CardContent>
              {savedReports.length === 0 ? (
                <p className="text-sm text-gray-500">아직 작성한 신고서가 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {savedReports.map(report => (
                    <div key={report.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {report.employee.name} - {TABS.find(t => t.key === report.reportType)?.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(report.createdAt).toLocaleDateString("ko-KR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <button onClick={() => handleLoadReport(report)}
                          className="flex-1 text-xs py-1.5 px-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                          불러오기
                        </button>
                        <button onClick={() => handleDelete(report.id)}
                          className="text-xs py-1.5 px-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors">
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
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
                <p className="font-medium text-gray-800 mb-1">오프라인 신고</p>
                <p>관할 국민연금공단, 건강보험공단, 근로복지공단 지사 방문 또는 FAX</p>
              </div>
              <div className="border-t pt-3">
                <p className="font-medium text-gray-800 mb-1">주의사항</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li>취득일은 <strong>입사일</strong>이 원칙</li>
                  <li>상실일은 <strong>퇴사일 다음날</strong>이 원칙</li>
                  <li>신고기한: 사유 발생일로부터 <strong>14일 이내</strong></li>
                  <li>미신고/지연신고 시 과태료 부과 가능</li>
                  <li>본 신고서는 <strong>참고용</strong>이며, 각 공단 서식과 다를 수 있습니다</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Preview Component ───

function InlinePreview({
  reportType, employee, company, reportData, residentNo,
}: {
  reportType: ReportType;
  employee: Employee;
  company: CompanyInfo;
  reportData: Record<string, unknown>;
  residentNo: string;
}) {
  const fmt = (d?: string | null) => {
    if (!d) return "-";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString("ko-KR");
  };
  const money = (n?: number | null) => n != null ? n.toLocaleString("ko-KR") + "원" : "-";
  const empTypes: Record<string, string> = { regular: "정규직", contract: "계약직", parttime: "파트타임", daily: "일용직" };
  const lossReasonMap: Record<string, string> = { resign: "자진퇴사", dismiss: "해고", contract_end: "계약만료", retirement: "정년퇴직", transfer: "전근", death: "사망", other: "기타" };

  return (
    <div className="border rounded-lg p-4 bg-white text-xs space-y-3 max-h-[500px] overflow-y-auto">
      <h3 className="text-center font-bold text-base tracking-widest">
        {reportType === "acquisition" && "4대보험 자격취득 신고서"}
        {reportType === "loss" && "4대보험 자격상실 신고서"}
        {reportType === "salary_change" && "4대보험 보수월액변경 신고서"}
      </h3>

      {/* 사업장 */}
      <div>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">1. 사업장 정보</p>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr><td className="border px-2 py-1 bg-gray-50 w-24 font-medium">사업장명</td><td className="border px-2 py-1" colSpan={3}>{company.companyName || "-"}</td></tr>
            <tr>
              <td className="border px-2 py-1 bg-gray-50 font-medium">사업자번호</td><td className="border px-2 py-1">{company.bizRegNo || "-"}</td>
              <td className="border px-2 py-1 bg-gray-50 font-medium w-20">대표자명</td><td className="border px-2 py-1">{company.ownerName || "-"}</td>
            </tr>
            <tr><td className="border px-2 py-1 bg-gray-50 font-medium">소재지</td><td className="border px-2 py-1" colSpan={3}>{company.address || "-"}</td></tr>
          </tbody>
        </table>
      </div>

      {/* 피보험자 */}
      <div>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">2. 피보험자 정보</p>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="border px-2 py-1 bg-gray-50 w-24 font-medium">성명</td><td className="border px-2 py-1">{employee.name}</td>
              <td className="border px-2 py-1 bg-gray-50 w-24 font-medium">주민등록번호</td><td className="border px-2 py-1">{residentNo || "미입력"}</td>
            </tr>
            <tr>
              <td className="border px-2 py-1 bg-gray-50 font-medium">생년월일</td><td className="border px-2 py-1">{fmt(employee.birthDate)}</td>
              <td className="border px-2 py-1 bg-gray-50 font-medium">고용형태</td><td className="border px-2 py-1">{empTypes[employee.employmentType] || employee.employmentType}</td>
            </tr>
            <tr>
              <td className="border px-2 py-1 bg-gray-50 font-medium">부서</td><td className="border px-2 py-1">{employee.department || "-"}</td>
              <td className="border px-2 py-1 bg-gray-50 font-medium">직위</td><td className="border px-2 py-1">{employee.position || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 신고 내용 */}
      <div>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">3. 신고 내용</p>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {reportType === "acquisition" && (
              <>
                <tr><td className="border px-2 py-1 bg-gray-50 w-28 font-medium">자격취득일</td><td className="border px-2 py-1">{fmt(reportData.acquisitionDate as string)}</td><td className="border px-2 py-1 bg-gray-50 w-24 font-medium">취득사유</td><td className="border px-2 py-1">{String(reportData.acquisitionReason || "신규입사")}</td></tr>
                <tr><td className="border px-2 py-1 bg-gray-50 font-medium">주 근로시간</td><td className="border px-2 py-1">{String(reportData.weeklyWorkHours || 40)}시간</td><td className="border px-2 py-1 bg-gray-50 font-medium">월 보수액</td><td className="border px-2 py-1 font-medium text-right">{money(reportData.monthlyIncome as number)}</td></tr>
              </>
            )}
            {reportType === "loss" && (
              <>
                <tr><td className="border px-2 py-1 bg-gray-50 w-28 font-medium">자격상실일</td><td className="border px-2 py-1">{fmt(reportData.lossDate as string)}</td><td className="border px-2 py-1 bg-gray-50 w-24 font-medium">최종근무일</td><td className="border px-2 py-1">{fmt(reportData.lastWorkDate as string)}</td></tr>
                <tr><td className="border px-2 py-1 bg-gray-50 font-medium">상실사유</td><td className="border px-2 py-1" colSpan={3}>{lossReasonMap[reportData.lossReason as string] || String(reportData.lossReason || "")} {reportData.lossReasonDetail ? `(${reportData.lossReasonDetail})` : ""}</td></tr>
                <tr><td className="border px-2 py-1 bg-gray-50 font-medium">3개월 평균보수</td><td className="border px-2 py-1 text-right font-medium" colSpan={3}>{money(reportData.avgSalary3Months as number)}</td></tr>
              </>
            )}
            {reportType === "salary_change" && (
              <>
                <tr><td className="border px-2 py-1 bg-gray-50 w-28 font-medium">변경일자</td><td className="border px-2 py-1" colSpan={3}>{fmt(reportData.changeDate as string)}</td></tr>
                <tr><td className="border px-2 py-1 bg-gray-50 font-medium">변경 전</td><td className="border px-2 py-1 text-right">{money(reportData.beforeSalary as number)}</td><td className="border px-2 py-1 bg-gray-50 font-medium">변경 후</td><td className="border px-2 py-1 text-right font-medium">{money(reportData.afterSalary as number)}</td></tr>
                <tr><td className="border px-2 py-1 bg-gray-50 font-medium">변경사유</td><td className="border px-2 py-1" colSpan={3}>{String(reportData.changeReason || "")}</td></tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* 보험 종류 */}
      <div>
        <p className="font-bold border-b border-gray-300 pb-1 mb-2">4. 보험 종류</p>
        <div className="flex gap-4">
          {[
            { label: "국민연금", checked: reportType !== "acquisition" || reportData.nationalPension !== false },
            { label: "건강보험", checked: reportType !== "acquisition" || reportData.healthInsurance !== false },
            { label: "고용보험", checked: reportType !== "acquisition" || reportData.employmentInsurance !== false },
            { label: "산재보험", checked: reportType !== "acquisition" || reportData.industrialAccident !== false },
          ].map(ins => (
            <span key={ins.label} className={`px-2 py-1 rounded text-xs font-medium ${ins.checked ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-400 line-through"}`}>
              {ins.checked ? "✓" : "✗"} {ins.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
