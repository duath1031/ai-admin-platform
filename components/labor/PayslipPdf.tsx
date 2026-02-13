"use client";

import { useRef } from "react";

interface PayslipData {
  id: string;
  year: number;
  month: number;
  baseSalary: number;
  overtimePay: number;
  bonusPay: number;
  otherAllowance: number;
  mealAllowance: number;
  totalGross: number;
  deductions: string; // JSON
  totalDeduction: number;
  netPay: number;
  employerBurden?: string; // JSON
  employee: {
    name: string;
    department?: string | null;
    position?: string | null;
    hireDate?: string;
  };
}

interface CompanyInfo {
  companyName?: string;
  ownerName?: string;
  bizRegNo?: string;
  address?: string;
}

interface PayslipPdfProps {
  payslip: PayslipData;
  company?: CompanyInfo;
}

export default function PayslipPdf({ payslip, company }: PayslipPdfProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const deductions = typeof payslip.deductions === "string"
    ? JSON.parse(payslip.deductions)
    : payslip.deductions;

  const employerBurden = payslip.employerBurden
    ? typeof payslip.employerBurden === "string"
      ? JSON.parse(payslip.employerBurden)
      : payslip.employerBurden
    : null;

  const fmt = (n: number) => n.toLocaleString();

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>급여명세서 - ${payslip.employee.name} ${payslip.year}년 ${payslip.month}월</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Malgun Gothic', sans-serif; padding: 20mm; font-size: 11pt; color: #333; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .header h1 { font-size: 20pt; margin-bottom: 4px; }
          .header p { font-size: 10pt; color: #666; }
          .company-info { margin-bottom: 16px; font-size: 10pt; }
          .employee-info { display: flex; gap: 32px; margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 4px; }
          .employee-info div { }
          .employee-info label { font-weight: bold; margin-right: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-size: 10pt; }
          th { background: #f0f0f0; font-weight: bold; text-align: center; }
          td:first-child { text-align: left; }
          .section-title { font-size: 12pt; font-weight: bold; margin: 16px 0 8px; padding-left: 8px; border-left: 3px solid #2563eb; }
          .summary { display: flex; justify-content: space-between; margin-top: 20px; padding: 16px; border: 2px solid #333; border-radius: 4px; }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 10pt; color: #666; margin-bottom: 4px; }
          .summary-item .value { font-size: 16pt; font-weight: bold; }
          .summary-item .value.highlight { color: #2563eb; }
          .footer { margin-top: 32px; text-align: center; font-size: 9pt; color: #999; }
          .employer-section { margin-top: 16px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div>
      {/* 인쇄 버튼 */}
      <button
        onClick={handlePrint}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 print:hidden"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        인쇄 / PDF 저장
      </button>

      {/* 인쇄 콘텐츠 */}
      <div ref={printRef} className="bg-white p-6 rounded-lg border">
        {/* 헤더 */}
        <div className="header" style={{ textAlign: "center", marginBottom: 24, borderBottom: "2px solid #333", paddingBottom: 16 }}>
          <h1 style={{ fontSize: "20pt", marginBottom: 4 }}>급여명세서</h1>
          <p style={{ fontSize: "10pt", color: "#666" }}>
            {payslip.year}년 {payslip.month}월
          </p>
        </div>

        {/* 회사 정보 */}
        {company?.companyName && (
          <div className="company-info" style={{ marginBottom: 16, fontSize: "10pt" }}>
            <div><strong>사업장:</strong> {company.companyName}</div>
            {company.bizRegNo && <div><strong>사업자등록번호:</strong> {company.bizRegNo}</div>}
            {company.address && <div><strong>주소:</strong> {company.address}</div>}
          </div>
        )}

        {/* 직원 정보 */}
        <div className="employee-info" style={{ display: "flex", gap: 32, marginBottom: 20, padding: 12, background: "#f8f9fa", borderRadius: 4 }}>
          <div><label style={{ fontWeight: "bold", marginRight: 8 }}>성명:</label>{payslip.employee.name}</div>
          {payslip.employee.department && (
            <div><label style={{ fontWeight: "bold", marginRight: 8 }}>부서:</label>{payslip.employee.department}</div>
          )}
          {payslip.employee.position && (
            <div><label style={{ fontWeight: "bold", marginRight: 8 }}>직급:</label>{payslip.employee.position}</div>
          )}
        </div>

        {/* 지급 내역 */}
        <div className="section-title" style={{ fontSize: "12pt", fontWeight: "bold", margin: "16px 0 8px", paddingLeft: 8, borderLeft: "3px solid #2563eb" }}>
          지급 내역
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ddd", padding: "8px 12px", background: "#f0f0f0" }}>항목</th>
              <th style={{ border: "1px solid #ddd", padding: "8px 12px", background: "#f0f0f0" }}>금액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>기본급</td>
              <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.baseSalary)}원</td>
            </tr>
            {payslip.overtimePay > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>연장근로수당</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.overtimePay)}원</td>
              </tr>
            )}
            {payslip.bonusPay > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>상여금</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.bonusPay)}원</td>
              </tr>
            )}
            {payslip.otherAllowance > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>기타수당</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.otherAllowance)}원</td>
              </tr>
            )}
            {payslip.mealAllowance > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>식대 (비과세)</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.mealAllowance)}원</td>
              </tr>
            )}
            <tr style={{ fontWeight: "bold", background: "#f8f9fa" }}>
              <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>총 지급액</td>
              <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.totalGross)}원</td>
            </tr>
          </tbody>
        </table>

        {/* 공제 내역 */}
        <div className="section-title" style={{ fontSize: "12pt", fontWeight: "bold", margin: "16px 0 8px", paddingLeft: 8, borderLeft: "3px solid #dc2626" }}>
          공제 내역
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ddd", padding: "8px 12px", background: "#f0f0f0" }}>항목</th>
              <th style={{ border: "1px solid #ddd", padding: "8px 12px", background: "#f0f0f0" }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {deductions.nationalPension > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>국민연금</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(deductions.nationalPension)}원</td>
              </tr>
            )}
            {deductions.healthInsurance > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>건강보험</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(deductions.healthInsurance)}원</td>
              </tr>
            )}
            {deductions.longTermCare > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>장기요양보험</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(deductions.longTermCare)}원</td>
              </tr>
            )}
            {deductions.employmentInsurance > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>고용보험</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(deductions.employmentInsurance)}원</td>
              </tr>
            )}
            {deductions.incomeTax > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>소득세</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(deductions.incomeTax)}원</td>
              </tr>
            )}
            {deductions.localIncomeTax > 0 && (
              <tr>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>지방소득세</td>
                <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(deductions.localIncomeTax)}원</td>
              </tr>
            )}
            <tr style={{ fontWeight: "bold", background: "#fef2f2" }}>
              <td style={{ border: "1px solid #ddd", padding: "8px 12px" }}>총 공제액</td>
              <td style={{ border: "1px solid #ddd", padding: "8px 12px", textAlign: "right" }}>{fmt(payslip.totalDeduction)}원</td>
            </tr>
          </tbody>
        </table>

        {/* 요약 */}
        <div className="summary" style={{ display: "flex", justifyContent: "space-between", marginTop: 20, padding: 16, border: "2px solid #333", borderRadius: 4 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>총 지급액</div>
            <div style={{ fontSize: "14pt", fontWeight: "bold" }}>{fmt(payslip.totalGross)}원</div>
          </div>
          <div style={{ textAlign: "center", fontSize: "20pt", alignSelf: "center" }}>-</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>총 공제액</div>
            <div style={{ fontSize: "14pt", fontWeight: "bold", color: "#dc2626" }}>{fmt(payslip.totalDeduction)}원</div>
          </div>
          <div style={{ textAlign: "center", fontSize: "20pt", alignSelf: "center" }}>=</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10pt", color: "#666", marginBottom: 4 }}>실수령액</div>
            <div style={{ fontSize: "16pt", fontWeight: "bold", color: "#2563eb" }}>{fmt(payslip.netPay)}원</div>
          </div>
        </div>

        {/* 사업주 부담분 */}
        {employerBurden && (
          <div className="employer-section" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ fontSize: "11pt", fontWeight: "bold", margin: "16px 0 8px", paddingLeft: 8, borderLeft: "3px solid #9333ea" }}>
              사업주 부담분 (참고)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {employerBurden.nationalPension > 0 && (
                  <tr>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", fontSize: "9pt" }}>국민연금</td>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", textAlign: "right", fontSize: "9pt" }}>{fmt(employerBurden.nationalPension)}원</td>
                  </tr>
                )}
                {employerBurden.healthInsurance > 0 && (
                  <tr>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", fontSize: "9pt" }}>건강보험</td>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", textAlign: "right", fontSize: "9pt" }}>{fmt(employerBurden.healthInsurance)}원</td>
                  </tr>
                )}
                {employerBurden.longTermCare > 0 && (
                  <tr>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", fontSize: "9pt" }}>장기요양보험</td>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", textAlign: "right", fontSize: "9pt" }}>{fmt(employerBurden.longTermCare)}원</td>
                  </tr>
                )}
                {employerBurden.employmentInsurance > 0 && (
                  <tr>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", fontSize: "9pt" }}>고용보험</td>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", textAlign: "right", fontSize: "9pt" }}>{fmt(employerBurden.employmentInsurance)}원</td>
                  </tr>
                )}
                {employerBurden.industrialAccident > 0 && (
                  <tr>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", fontSize: "9pt" }}>산재보험</td>
                    <td style={{ border: "1px solid #ddd", padding: "6px 12px", textAlign: "right", fontSize: "9pt" }}>{fmt(employerBurden.industrialAccident)}원</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 푸터 */}
        <div className="footer" style={{ marginTop: 32, textAlign: "center", fontSize: "9pt", color: "#999" }}>
          <p>본 급여명세서는 어드미니(Admini) 플랫폼에서 자동 생성되었습니다.</p>
          <p>발급일: {new Date().toLocaleDateString("ko-KR")}</p>
        </div>
      </div>
    </div>
  );
}
