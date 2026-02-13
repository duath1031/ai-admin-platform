"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───

interface Employee {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  employmentType: string;
  monthlySalary: number;
  hireDate: string;
  isActive: boolean;
  dependents: number;
  childrenUnder20: number;
  nonTaxableAmount: number;
  industryCode: string;
}

interface Deductions {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
}

interface Payslip {
  id: string;
  employeeId: string;
  userId: string;
  year: number;
  month: number;
  baseSalary: number;
  overtimePay: number;
  bonusPay: number;
  otherAllowance: number;
  mealAllowance: number;
  totalGross: number;
  deductions: string;
  totalDeduction: number;
  netPay: number;
  employerBurden: string;
  status: string;
  employee: {
    name: string;
    department: string | null;
    position: string | null;
  };
}

interface EmployeeForm {
  name: string;
  department: string;
  position: string;
  employmentType: string;
  hireDate: string;
  monthlySalary: string;
  dependents: string;
  childrenUnder20: string;
  nonTaxableAmount: string;
  industryCode: string;
}

const EMPTY_EMPLOYEE_FORM: EmployeeForm = {
  name: "",
  department: "",
  position: "",
  employmentType: "regular",
  hireDate: "",
  monthlySalary: "",
  dependents: "1",
  childrenUnder20: "0",
  nonTaxableAmount: "0",
  industryCode: "80",
};

const EMPLOYMENT_TYPES: Record<string, string> = {
  regular: "정규직",
  contract: "계약직",
  parttime: "파트타임",
  daily: "일용직",
};

const DEDUCTION_LABELS: Record<string, string> = {
  nationalPension: "국민연금",
  healthInsurance: "건강보험",
  longTermCare: "장기요양보험",
  employmentInsurance: "고용보험",
  incomeTax: "소득세",
  localIncomeTax: "지방소득세",
};

type TabKey = "employees" | "generate" | "list";

// ─── Main Page ───

export default function PayslipPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("employees");

  // ── 직원 관리 state ──
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empError, setEmpError] = useState("");
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<EmployeeForm>(EMPTY_EMPLOYEE_FORM);
  const [empSaving, setEmpSaving] = useState(false);

  // ── 명세서 생성 state ──
  const [genEmployeeId, setGenEmployeeId] = useState("");
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [genOvertimePay, setGenOvertimePay] = useState("");
  const [genBonusPay, setGenBonusPay] = useState("");
  const [genOtherAllowance, setGenOtherAllowance] = useState("");
  const [genMealAllowance, setGenMealAllowance] = useState("200000");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");
  const [genResult, setGenResult] = useState<Payslip | null>(null);

  // ── 명세서 목록 state ──
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [listYear, setListYear] = useState(new Date().getFullYear());
  const [listMonth, setListMonth] = useState<number | "">(new Date().getMonth() + 1);
  const [detailPayslip, setDetailPayslip] = useState<Payslip | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [printPayslip, setPrintPayslip] = useState<Payslip | null>(null);

  // ── 직원 목록 로드 ──
  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    setEmpError("");
    try {
      const res = await fetch("/api/labor/employees?active=false");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "직원 목록 조회 실패");
      setEmployees(data.data);
    } catch (e) {
      setEmpError(e instanceof Error ? e.message : "직원 목록 조회 실패");
    } finally {
      setEmpLoading(false);
    }
  }, []);

  // ── 명세서 목록 로드 ──
  const fetchPayslips = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams();
      params.set("year", String(listYear));
      if (listMonth !== "") params.set("month", String(listMonth));
      const res = await fetch(`/api/labor/payslip?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "명세서 목록 조회 실패");
      setPayslips(data.data);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "명세서 목록 조회 실패");
    } finally {
      setListLoading(false);
    }
  }, [listYear, listMonth]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === "list") {
      fetchPayslips();
    }
  }, [activeTab, fetchPayslips]);

  // ── 직원 추가/수정 ──
  const handleOpenEmployeeModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmpForm({
        name: emp.name,
        department: emp.department || "",
        position: emp.position || "",
        employmentType: emp.employmentType,
        hireDate: emp.hireDate ? emp.hireDate.substring(0, 10) : "",
        monthlySalary: String(emp.monthlySalary),
        dependents: String(emp.dependents),
        childrenUnder20: String(emp.childrenUnder20),
        nonTaxableAmount: String(emp.nonTaxableAmount),
        industryCode: emp.industryCode || "80",
      });
    } else {
      setEditingEmployee(null);
      setEmpForm(EMPTY_EMPLOYEE_FORM);
    }
    setShowEmpModal(true);
  };

  const handleSaveEmployee = async () => {
    if (!empForm.name || !empForm.hireDate || !empForm.monthlySalary) {
      setEmpError("이름, 입사일, 월급여는 필수입니다.");
      return;
    }
    setEmpSaving(true);
    setEmpError("");
    try {
      const payload = {
        name: empForm.name,
        department: empForm.department || null,
        position: empForm.position || null,
        employmentType: empForm.employmentType,
        hireDate: empForm.hireDate,
        monthlySalary: Number(empForm.monthlySalary),
        dependents: Number(empForm.dependents),
        childrenUnder20: Number(empForm.childrenUnder20),
        nonTaxableAmount: Number(empForm.nonTaxableAmount),
        industryCode: empForm.industryCode,
      };

      let res: Response;
      if (editingEmployee) {
        res = await fetch(`/api/labor/employees/${editingEmployee.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/labor/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "저장 실패");

      setShowEmpModal(false);
      fetchEmployees();
    } catch (e) {
      setEmpError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setEmpSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`${name} 직원을 비활성화하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/labor/employees/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "삭제 실패");
      fetchEmployees();
    } catch (e) {
      setEmpError(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  // ── 명세서 생성 ──
  const handleGeneratePayslip = async () => {
    if (!genEmployeeId) {
      setGenError("직원을 선택해주세요.");
      return;
    }
    setGenLoading(true);
    setGenError("");
    setGenResult(null);
    try {
      const res = await fetch("/api/labor/payslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: genEmployeeId,
          year: genYear,
          month: genMonth,
          overtimePay: Number(genOvertimePay) || 0,
          bonusPay: Number(genBonusPay) || 0,
          otherAllowance: Number(genOtherAllowance) || 0,
          mealAllowance: Number(genMealAllowance) || 0,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "명세서 생성 실패");
      setGenResult(data.data);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "명세서 생성 실패");
    } finally {
      setGenLoading(false);
    }
  };

  // ── 인쇄 ──
  const handlePrint = (payslip: Payslip) => {
    setPrintPayslip(payslip);
    setTimeout(() => {
      window.print();
      setPrintPayslip(null);
    }, 300);
  };

  // ── 활성 직원 필터 ──
  const activeEmployees = employees.filter((e) => e.isActive);

  // ── 연도 옵션 ──
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <>
      {/* 인쇄 전용 뷰 */}
      {printPayslip && <PrintView payslip={printPayslip} />}

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto space-y-6 print:hidden">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">급여명세서</h1>
          <p className="text-sm text-gray-500 mt-1">
            직원 관리 및 급여명세서를 생성합니다
          </p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {([
            { key: "employees" as const, label: "직원 관리" },
            { key: "generate" as const, label: "명세서 생성" },
            { key: "list" as const, label: "명세서 목록" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ================================================================ */}
        {/* Tab 1: 직원 관리                                                 */}
        {/* ================================================================ */}
        {activeTab === "employees" && (
          <div className="space-y-4">
            {/* 액션 바 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                등록된 직원 <span className="font-semibold text-gray-900">{employees.length}</span>명
                (활성 {activeEmployees.length}명)
              </p>
              <button
                onClick={() => handleOpenEmployeeModal()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                + 직원 추가
              </button>
            </div>

            {/* 에러 */}
            {empError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {empError}
                <button onClick={() => setEmpError("")} className="ml-2 text-red-500 underline text-xs">닫기</button>
              </div>
            )}

            {/* 직원 테이블 */}
            {empLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : employees.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500 text-sm">등록된 직원이 없습니다.</p>
                <p className="text-gray-400 text-xs mt-1">직원을 추가하면 급여명세서를 생성할 수 있습니다.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">부서</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">직급</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">고용형태</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">월급여</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">입사일</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employees.map((emp) => (
                        <tr key={emp.id} className={`hover:bg-gray-50 ${!emp.isActive ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                          <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{emp.department || "-"}</td>
                          <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{emp.position || "-"}</td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              emp.employmentType === "regular" ? "bg-blue-100 text-blue-700" :
                              emp.employmentType === "contract" ? "bg-yellow-100 text-yellow-700" :
                              emp.employmentType === "parttime" ? "bg-green-100 text-green-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {EMPLOYMENT_TYPES[emp.employmentType] || emp.employmentType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-800">
                            {emp.monthlySalary.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                            {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString("ko-KR") : "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${emp.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                            <span className="ml-1 text-xs text-gray-500">{emp.isActive ? "재직" : "퇴직"}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEmployeeModal(emp)}
                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                수정
                              </button>
                              {emp.isActive && (
                                <button
                                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 직원 추가/수정 모달 */}
            {showEmpModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/50" onClick={() => setShowEmpModal(false)} />
                <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingEmployee ? "직원 정보 수정" : "직원 추가"}
                    </h3>
                    <button
                      onClick={() => setShowEmpModal(false)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* 이름 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        이름 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={empForm.name}
                        onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                        placeholder="홍길동"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>

                    {/* 부서 & 직급 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">부서</label>
                        <input
                          type="text"
                          value={empForm.department}
                          onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                          placeholder="경영지원팀"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">직급</label>
                        <input
                          type="text"
                          value={empForm.position}
                          onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                          placeholder="대리"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* 고용형태 & 입사일 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">고용형태</label>
                        <select
                          value={empForm.employmentType}
                          onChange={(e) => setEmpForm({ ...empForm, employmentType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          입사일 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={empForm.hireDate}
                          onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* 월급여 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        월급여 (원) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={empForm.monthlySalary}
                        onChange={(e) => setEmpForm({ ...empForm, monthlySalary: e.target.value })}
                        placeholder="3000000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      {empForm.monthlySalary && (
                        <p className="text-xs text-gray-400 mt-1">
                          {Number(empForm.monthlySalary).toLocaleString()}원
                        </p>
                      )}
                    </div>

                    {/* 부양가족 & 20세 이하 자녀 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          부양가족 수 (본인 포함)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={empForm.dependents}
                          onChange={(e) => setEmpForm({ ...empForm, dependents: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          20세 이하 자녀 수
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={empForm.childrenUnder20}
                          onChange={(e) => setEmpForm({ ...empForm, childrenUnder20: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* 비과세액 & 업종코드 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          비과세 금액 (원)
                        </label>
                        <input
                          type="number"
                          value={empForm.nonTaxableAmount}
                          onChange={(e) => setEmpForm({ ...empForm, nonTaxableAmount: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          업종코드
                        </label>
                        <input
                          type="text"
                          value={empForm.industryCode}
                          onChange={(e) => setEmpForm({ ...empForm, industryCode: e.target.value })}
                          placeholder="80"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">산재보험 업종코드 (기본: 80)</p>
                      </div>
                    </div>

                    {/* 에러 */}
                    {empError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        {empError}
                      </div>
                    )}
                  </div>

                  {/* 모달 하단 버튼 */}
                  <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
                    <button
                      onClick={() => setShowEmpModal(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveEmployee}
                      disabled={empSaving}
                      className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {empSaving ? "저장 중..." : editingEmployee ? "수정" : "등록"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* Tab 2: 명세서 생성                                               */}
        {/* ================================================================ */}
        {activeTab === "generate" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 입력 폼 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
              <h2 className="text-base font-semibold text-gray-900">명세서 생성</h2>

              {/* 직원 선택 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  직원 선택 <span className="text-red-500">*</span>
                </label>
                {activeEmployees.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                    등록된 활성 직원이 없습니다. &quot;직원 관리&quot; 탭에서 직원을 먼저 추가해주세요.
                  </div>
                ) : (
                  <select
                    value={genEmployeeId}
                    onChange={(e) => setGenEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- 직원을 선택하세요 --</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department || "부서없음"} / {emp.position || "직급없음"}) - 월 {emp.monthlySalary.toLocaleString()}원
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 년월 선택 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">년도</label>
                  <select
                    value={genYear}
                    onChange={(e) => setGenYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">월</label>
                  <select
                    value={genMonth}
                    onChange={(e) => setGenMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 수당 입력 */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">추가 수당 항목</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">연장근로수당 (원)</label>
                    <input
                      type="number"
                      value={genOvertimePay}
                      onChange={(e) => setGenOvertimePay(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">상여금 (원)</label>
                    <input
                      type="number"
                      value={genBonusPay}
                      onChange={(e) => setGenBonusPay(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">기타수당 (원)</label>
                    <input
                      type="number"
                      value={genOtherAllowance}
                      onChange={(e) => setGenOtherAllowance(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">식대 비과세 (원)</label>
                    <input
                      type="number"
                      value={genMealAllowance}
                      onChange={(e) => setGenMealAllowance(e.target.value)}
                      placeholder="200000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">2025년 기준 월 20만원 한도 비과세</p>
                  </div>
                </div>
              </div>

              {/* 에러 */}
              {genError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {genError}
                  <button onClick={() => setGenError("")} className="ml-2 text-red-500 underline text-xs">닫기</button>
                </div>
              )}

              {/* 생성 버튼 */}
              <button
                onClick={handleGeneratePayslip}
                disabled={genLoading || !genEmployeeId}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {genLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    생성 중...
                  </span>
                ) : (
                  "명세서 생성"
                )}
              </button>
            </div>

            {/* 생성 결과 미리보기 */}
            <div className="space-y-4">
              {genLoading ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 flex justify-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : genResult ? (
                <PayslipPreview payslip={genResult} onPrint={() => handlePrint(genResult)} />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <div className="text-gray-300 text-5xl mb-4">&#128196;</div>
                  <p className="text-gray-500 text-sm">직원과 년월을 선택하고 명세서를 생성하세요.</p>
                  <p className="text-gray-400 text-xs mt-1">
                    4대보험, 소득세, 지방소득세가 자동으로 계산됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Tab 3: 명세서 목록                                               */}
        {/* ================================================================ */}
        {activeTab === "list" && (
          <div className="space-y-4">
            {/* 필터 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={listYear}
                  onChange={(e) => setListYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  value={listMonth}
                  onChange={(e) => setListMonth(e.target.value === "" ? "" : Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">전체 월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <button
                  onClick={fetchPayslips}
                  disabled={listLoading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  {listLoading ? "조회 중..." : "조회"}
                </button>
              </div>
              <p className="text-sm text-gray-500">
                총 <span className="font-semibold text-gray-700">{payslips.length}</span>건
              </p>
            </div>

            {/* 에러 */}
            {listError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {listError}
                <button onClick={() => setListError("")} className="ml-2 text-red-500 underline text-xs">닫기</button>
              </div>
            )}

            {/* 명세서 테이블 */}
            {listLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payslips.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-500 text-sm">해당 기간의 명세서가 없습니다.</p>
                <p className="text-gray-400 text-xs mt-1">&quot;명세서 생성&quot; 탭에서 새 명세서를 만들어보세요.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">직원명</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">부서</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">년월</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">총지급액</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">공제합계</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">실수령액</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">상태</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payslips.map((ps) => (
                        <tr key={ps.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{ps.employee.name}</td>
                          <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{ps.employee.department || "-"}</td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {ps.year}.{String(ps.month).padStart(2, "0")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-800">
                            {ps.totalGross.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-red-600 hidden md:table-cell">
                            -{ps.totalDeduction.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">
                            {ps.netPay.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              ps.status === "confirmed" ? "bg-green-100 text-green-700" :
                              ps.status === "sent" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {ps.status === "confirmed" ? "확정" :
                               ps.status === "sent" ? "발송완료" :
                               ps.status === "draft" ? "작성중" : ps.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => { setDetailPayslip(ps); setShowDetail(true); }}
                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                상세보기
                              </button>
                              <button
                                onClick={() => handlePrint(ps)}
                                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              >
                                인쇄
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 상세보기 모달 */}
            {showDetail && detailPayslip && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
                <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      급여명세서 상세 - {detailPayslip.employee.name}
                    </h3>
                    <button
                      onClick={() => setShowDetail(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="p-6">
                    <PayslipPreview
                      payslip={detailPayslip}
                      onPrint={() => { setShowDetail(false); handlePrint(detailPayslip); }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── PayslipPreview Component ───

function PayslipPreview({ payslip, onPrint }: { payslip: Payslip; onPrint?: () => void }) {
  const deductions: Deductions = typeof payslip.deductions === "string"
    ? JSON.parse(payslip.deductions)
    : payslip.deductions;

  const grossItems = [
    { label: "기본급", amount: payslip.baseSalary },
    { label: "연장근로수당", amount: payslip.overtimePay },
    { label: "상여금", amount: payslip.bonusPay },
    { label: "기타수당", amount: payslip.otherAllowance },
    { label: "식대 (비과세)", amount: payslip.mealAllowance },
  ];

  const deductionItems = [
    { label: DEDUCTION_LABELS.nationalPension, amount: deductions.nationalPension },
    { label: DEDUCTION_LABELS.healthInsurance, amount: deductions.healthInsurance },
    { label: DEDUCTION_LABELS.longTermCare, amount: deductions.longTermCare },
    { label: DEDUCTION_LABELS.employmentInsurance, amount: deductions.employmentInsurance },
    { label: DEDUCTION_LABELS.incomeTax, amount: deductions.incomeTax },
    { label: DEDUCTION_LABELS.localIncomeTax, amount: deductions.localIncomeTax },
  ];

  return (
    <div className="space-y-5">
      {/* 상단 정보 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">직원명</p>
            <p className="font-semibold text-gray-900">{payslip.employee.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">부서</p>
            <p className="font-medium text-gray-700">{payslip.employee.department || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">직급</p>
            <p className="font-medium text-gray-700">{payslip.employee.position || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">귀속년월</p>
            <p className="font-semibold text-gray-900">{payslip.year}년 {payslip.month}월</p>
          </div>
        </div>
      </div>

      {/* 지급항목 & 공제항목 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 지급항목 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800">지급항목</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {grossItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-mono ${item.amount > 0 ? "text-gray-900" : "text-gray-400"}`}>
                  {item.amount.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 px-4 py-2 border-t border-blue-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-800">총 지급액</span>
            <span className="text-sm font-bold font-mono text-blue-900">
              {payslip.totalGross.toLocaleString()}원
            </span>
          </div>
        </div>

        {/* 공제항목 */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2 border-b border-red-100">
            <h4 className="text-sm font-semibold text-red-800">공제항목</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {deductionItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-mono ${item.amount > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {item.amount > 0 ? "-" : ""}{item.amount.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
          <div className="bg-red-50 px-4 py-2 border-t border-red-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-800">총 공제액</span>
            <span className="text-sm font-bold font-mono text-red-900">
              -{payslip.totalDeduction.toLocaleString()}원
            </span>
          </div>
        </div>
      </div>

      {/* 실수령액 요약 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-5 text-white">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-blue-200">총 지급액</p>
            <p className="text-lg font-bold font-mono">{payslip.totalGross.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-blue-200">총 공제액</p>
            <p className="text-lg font-bold font-mono">-{payslip.totalDeduction.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-blue-200">실수령액</p>
            <p className="text-xl font-bold font-mono">{payslip.netPay.toLocaleString()}원</p>
          </div>
        </div>
      </div>

      {/* 인쇄 버튼 */}
      {onPrint && (
        <button
          onClick={onPrint}
          className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          명세서 인쇄
        </button>
      )}
    </div>
  );
}

// ─── PrintView Component (print-optimized) ───

function PrintView({ payslip }: { payslip: Payslip }) {
  const deductions: Deductions = typeof payslip.deductions === "string"
    ? JSON.parse(payslip.deductions)
    : payslip.deductions;

  const grossItems = [
    { label: "기본급", amount: payslip.baseSalary },
    { label: "연장근로수당", amount: payslip.overtimePay },
    { label: "상여금", amount: payslip.bonusPay },
    { label: "기타수당", amount: payslip.otherAllowance },
    { label: "식대 (비과세)", amount: payslip.mealAllowance },
  ];

  const deductionItems = [
    { label: "국민연금", amount: deductions.nationalPension },
    { label: "건강보험", amount: deductions.healthInsurance },
    { label: "장기요양보험", amount: deductions.longTermCare },
    { label: "고용보험", amount: deductions.employmentInsurance },
    { label: "소득세", amount: deductions.incomeTax },
    { label: "지방소득세", amount: deductions.localIncomeTax },
  ];

  return (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible !important; }
        }
      `}</style>

      {/* 인쇄용 헤더 */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">급여명세서</h1>
        <p className="text-sm text-gray-600 mt-1">
          {payslip.year}년 {payslip.month}월
        </p>
      </div>

      {/* 직원 정보 */}
      <div className="mb-6">
        <table className="w-full text-sm border border-gray-400">
          <tbody>
            <tr>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium w-24">성명</td>
              <td className="border border-gray-400 px-3 py-2">{payslip.employee.name}</td>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium w-24">부서</td>
              <td className="border border-gray-400 px-3 py-2">{payslip.employee.department || "-"}</td>
              <td className="bg-gray-100 border border-gray-400 px-3 py-2 font-medium w-24">직급</td>
              <td className="border border-gray-400 px-3 py-2">{payslip.employee.position || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 지급 & 공제 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* 지급항목 */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">지급항목</h3>
          <table className="w-full text-sm border border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-3 py-1.5 text-left font-medium">항목</th>
                <th className="border border-gray-400 px-3 py-1.5 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {grossItems.map((item, i) => (
                <tr key={i}>
                  <td className="border border-gray-400 px-3 py-1.5">{item.label}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-right font-mono">
                    {item.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-400 px-3 py-1.5">합계</td>
                <td className="border border-gray-400 px-3 py-1.5 text-right font-mono">
                  {payslip.totalGross.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 공제항목 */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-400 pb-1">공제항목</h3>
          <table className="w-full text-sm border border-gray-400">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 px-3 py-1.5 text-left font-medium">항목</th>
                <th className="border border-gray-400 px-3 py-1.5 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {deductionItems.map((item, i) => (
                <tr key={i}>
                  <td className="border border-gray-400 px-3 py-1.5">{item.label}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-right font-mono">
                    {item.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-400 px-3 py-1.5">합계</td>
                <td className="border border-gray-400 px-3 py-1.5 text-right font-mono">
                  {payslip.totalDeduction.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 실수령액 */}
      <div className="border-2 border-gray-800 p-4 text-center">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-600">총 지급액</p>
            <p className="text-lg font-bold font-mono">{payslip.totalGross.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">총 공제액</p>
            <p className="text-lg font-bold font-mono text-red-700">-{payslip.totalDeduction.toLocaleString()}원</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">실수령액</p>
            <p className="text-xl font-bold font-mono text-blue-800">{payslip.netPay.toLocaleString()}원</p>
          </div>
        </div>
      </div>

      {/* 하단 서명란 */}
      <div className="mt-12 flex justify-end gap-16 text-sm">
        <div className="text-center">
          <p className="text-gray-600 mb-8">지급자</p>
          <div className="w-32 border-b border-gray-400" />
          <p className="text-xs text-gray-500 mt-1">(인)</p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 mb-8">수령자</p>
          <div className="w-32 border-b border-gray-400" />
          <p className="text-xs text-gray-500 mt-1">(인)</p>
        </div>
      </div>
    </div>
  );
}
