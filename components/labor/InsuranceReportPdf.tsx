"use client";

interface EmployeeInfo {
  name: string;
  birthDate?: string | null;
  department?: string | null;
  position?: string | null;
  hireDate: string;
  resignDate?: string | null;
  employmentType: string;
  monthlySalary: number;
}

interface CompanyInfo {
  companyName?: string;
  ownerName?: string;
  bizRegNo?: string;
  address?: string;
}

interface ReportData {
  // 공통
  reportDate: string;
  // 취득
  acquisitionDate?: string;
  acquisitionReason?: string;
  weeklyWorkHours?: number;
  monthlyIncome?: number;
  nationalPension?: boolean;
  healthInsurance?: boolean;
  employmentInsurance?: boolean;
  industrialAccident?: boolean;
  // 상실
  lossDate?: string;
  lossReason?: string;
  lossReasonDetail?: string;
  lastWorkDate?: string;
  avgSalary3Months?: number;
  // 보수월액변경
  changeDate?: string;
  beforeSalary?: number;
  afterSalary?: number;
  changeReason?: string;
}

interface InsuranceReportPdfProps {
  reportType: "acquisition" | "loss" | "salary_change";
  employee: EmployeeInfo;
  company?: CompanyInfo;
  reportData: ReportData;
  residentNo?: string;
}

const REPORT_TITLES: Record<string, string> = {
  acquisition: "4대보험 자격취득 신고서",
  loss: "4대보험 자격상실 신고서",
  salary_change: "4대보험 보수월액변경 신고서",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  regular: "정규직",
  contract: "계약직",
  parttime: "파트타임",
  daily: "일용직",
};

const LOSS_REASONS: Record<string, string> = {
  resign: "자진퇴사",
  dismiss: "해고",
  contract_end: "계약만료",
  retirement: "정년퇴직",
  death: "사망",
  other: "기타",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatBizRegNo(no?: string): string {
  if (!no) return "";
  const cleaned = no.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
  }
  return no;
}

function formatMoney(amount?: number | null): string {
  if (amount == null) return "0";
  return amount.toLocaleString("ko-KR");
}

export default function InsuranceReportPdf({
  reportType,
  employee,
  company,
  reportData,
  residentNo,
}: InsuranceReportPdfProps) {

  const handlePrint = () => {
    const title = REPORT_TITLES[reportType];
    const html = generateHtml(reportType, employee, company, reportData, residentNo);

    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <button
      onClick={handlePrint}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      인쇄 / PDF 저장
    </button>
  );
}

function generateHtml(
  reportType: string,
  employee: EmployeeInfo,
  company?: CompanyInfo,
  data?: ReportData,
  residentNo?: string,
): string {
  const title = REPORT_TITLES[reportType];
  const today = data?.reportDate || new Date().toISOString().split("T")[0];

  const commonStyles = `
    <style>
      @page { size: A4; margin: 15mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11px; color: #000; line-height: 1.5; }
      .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; }
      h1 { text-align: center; font-size: 20px; margin-bottom: 20px; letter-spacing: 4px; }
      .subtitle { text-align: center; font-size: 12px; color: #555; margin-bottom: 15px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 11px; }
      th { background: #f5f5f5; font-weight: 600; width: 120px; text-align: center; }
      .section-title { font-size: 13px; font-weight: 700; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #333; }
      .check-row td { text-align: center; }
      .check { display: inline-block; width: 14px; height: 14px; border: 1px solid #333; text-align: center; line-height: 14px; font-size: 10px; margin-right: 2px; }
      .check.on { background: #333; color: #fff; }
      .sign-area { margin-top: 30px; text-align: center; }
      .sign-area p { margin-bottom: 10px; font-size: 12px; }
      .sign-box { display: inline-block; width: 150px; height: 50px; border-bottom: 1px solid #333; margin: 0 20px; }
      .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
      .money { text-align: right; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { padding: 0; }
      }
    </style>
  `;

  let bodyContent = "";

  if (reportType === "acquisition") {
    bodyContent = generateAcquisitionBody(employee, company, data, residentNo);
  } else if (reportType === "loss") {
    bodyContent = generateLossBody(employee, company, data, residentNo);
  } else {
    bodyContent = generateSalaryChangeBody(employee, company, data, residentNo);
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${commonStyles}
</head>
<body>
  <div class="page">
    <h1>${title}</h1>
    <p class="subtitle">신고일: ${formatDate(today)}</p>
    ${bodyContent}
    <div class="sign-area">
      <p>위와 같이 신고합니다.</p>
      <p style="margin-top:15px;">${formatDate(today)}</p>
      <div style="margin-top:20px;">
        <span>사업주 (서명/인)</span>
        <div class="sign-box"></div>
      </div>
    </div>
    <div class="footer">
      <p>본 신고서는 어드미니(Admini) 플랫폼에서 자동 생성되었습니다.</p>
      <p>실제 신고는 4대 사회보험 정보연계센터(www.4insure.or.kr) 또는 관할 지사에 제출하세요.</p>
    </div>
  </div>
</body>
</html>`;
}

function checkBox(checked?: boolean): string {
  return checked
    ? '<span class="check on">&#10003;</span>'
    : '<span class="check"></span>';
}

function generateAcquisitionBody(
  emp: EmployeeInfo,
  co?: CompanyInfo,
  data?: ReportData,
  residentNo?: string,
): string {
  const monthlyIncome = data?.monthlyIncome || emp.monthlySalary;

  return `
    <div class="section-title">1. 사업장 정보</div>
    <table>
      <tr><th>사업장명</th><td colspan="3">${co?.companyName || ""}</td></tr>
      <tr><th>사업자등록번호</th><td>${formatBizRegNo(co?.bizRegNo)}</td><th>대표자명</th><td>${co?.ownerName || ""}</td></tr>
      <tr><th>사업장 소재지</th><td colspan="3">${co?.address || ""}</td></tr>
    </table>

    <div class="section-title">2. 피보험자(가입자) 정보</div>
    <table>
      <tr><th>성명</th><td>${emp.name}</td><th>주민등록번호</th><td>${residentNo || ""}</td></tr>
      <tr><th>생년월일</th><td>${formatDate(emp.birthDate)}</td><th>고용형태</th><td>${EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}</td></tr>
      <tr><th>근무부서</th><td>${emp.department || "-"}</td><th>직위</th><td>${emp.position || "-"}</td></tr>
      <tr><th>주 소정근로시간</th><td colspan="3">${data?.weeklyWorkHours || 40}시간</td></tr>
    </table>

    <div class="section-title">3. 취득 신고 내용</div>
    <table>
      <tr><th>자격취득일</th><td>${formatDate(data?.acquisitionDate || emp.hireDate)}</td><th>취득사유</th><td>${data?.acquisitionReason || "신규입사"}</td></tr>
      <tr><th>월 보수액</th><td class="money" colspan="3">${formatMoney(monthlyIncome)} 원</td></tr>
    </table>

    <div class="section-title">4. 취득 보험 종류</div>
    <table>
      <tr class="check-row">
        <td>${checkBox(data?.nationalPension !== false)} 국민연금</td>
        <td>${checkBox(data?.healthInsurance !== false)} 건강보험</td>
        <td>${checkBox(data?.employmentInsurance !== false)} 고용보험</td>
        <td>${checkBox(data?.industrialAccident !== false)} 산재보험</td>
      </tr>
    </table>
  `;
}

function generateLossBody(
  emp: EmployeeInfo,
  co?: CompanyInfo,
  data?: ReportData,
  residentNo?: string,
): string {
  return `
    <div class="section-title">1. 사업장 정보</div>
    <table>
      <tr><th>사업장명</th><td colspan="3">${co?.companyName || ""}</td></tr>
      <tr><th>사업자등록번호</th><td>${formatBizRegNo(co?.bizRegNo)}</td><th>대표자명</th><td>${co?.ownerName || ""}</td></tr>
      <tr><th>사업장 소재지</th><td colspan="3">${co?.address || ""}</td></tr>
    </table>

    <div class="section-title">2. 피보험자(가입자) 정보</div>
    <table>
      <tr><th>성명</th><td>${emp.name}</td><th>주민등록번호</th><td>${residentNo || ""}</td></tr>
      <tr><th>생년월일</th><td>${formatDate(emp.birthDate)}</td><th>고용형태</th><td>${EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}</td></tr>
      <tr><th>근무부서</th><td>${emp.department || "-"}</td><th>직위</th><td>${emp.position || "-"}</td></tr>
      <tr><th>자격취득일</th><td colspan="3">${formatDate(emp.hireDate)}</td></tr>
    </table>

    <div class="section-title">3. 상실 신고 내용</div>
    <table>
      <tr><th>자격상실일</th><td>${formatDate(data?.lossDate || emp.resignDate)}</td><th>최종근무일</th><td>${formatDate(data?.lastWorkDate || data?.lossDate || emp.resignDate)}</td></tr>
      <tr><th>상실사유</th><td>${LOSS_REASONS[data?.lossReason || ""] || data?.lossReason || ""}</td><th>상실사유 상세</th><td>${data?.lossReasonDetail || ""}</td></tr>
      <tr><th>최근 3개월<br/>평균보수</th><td class="money" colspan="3">${formatMoney(data?.avgSalary3Months || emp.monthlySalary)} 원</td></tr>
    </table>

    <div class="section-title">4. 상실 보험 종류</div>
    <table>
      <tr class="check-row">
        <td>${checkBox(true)} 국민연금</td>
        <td>${checkBox(true)} 건강보험</td>
        <td>${checkBox(true)} 고용보험</td>
        <td>${checkBox(true)} 산재보험</td>
      </tr>
    </table>
  `;
}

function generateSalaryChangeBody(
  emp: EmployeeInfo,
  co?: CompanyInfo,
  data?: ReportData,
  residentNo?: string,
): string {
  return `
    <div class="section-title">1. 사업장 정보</div>
    <table>
      <tr><th>사업장명</th><td colspan="3">${co?.companyName || ""}</td></tr>
      <tr><th>사업자등록번호</th><td>${formatBizRegNo(co?.bizRegNo)}</td><th>대표자명</th><td>${co?.ownerName || ""}</td></tr>
      <tr><th>사업장 소재지</th><td colspan="3">${co?.address || ""}</td></tr>
    </table>

    <div class="section-title">2. 피보험자(가입자) 정보</div>
    <table>
      <tr><th>성명</th><td>${emp.name}</td><th>주민등록번호</th><td>${residentNo || ""}</td></tr>
      <tr><th>생년월일</th><td>${formatDate(emp.birthDate)}</td><th>고용형태</th><td>${EMPLOYMENT_TYPE_LABELS[emp.employmentType] || emp.employmentType}</td></tr>
      <tr><th>근무부서</th><td>${emp.department || "-"}</td><th>직위</th><td>${emp.position || "-"}</td></tr>
      <tr><th>자격취득일</th><td colspan="3">${formatDate(emp.hireDate)}</td></tr>
    </table>

    <div class="section-title">3. 보수월액 변경 내용</div>
    <table>
      <tr><th>변경일자</th><td colspan="3">${formatDate(data?.changeDate)}</td></tr>
      <tr><th>변경 전 보수월액</th><td class="money">${formatMoney(data?.beforeSalary || emp.monthlySalary)} 원</td><th>변경 후 보수월액</th><td class="money">${formatMoney(data?.afterSalary)} 원</td></tr>
      <tr>
        <th>증감액</th>
        <td class="money" colspan="3">
          ${(data?.afterSalary && data?.beforeSalary)
            ? `${formatMoney(data.afterSalary - data.beforeSalary)} 원 (${data.afterSalary > data.beforeSalary ? "인상" : "인하"})`
            : "-"
          }
        </td>
      </tr>
      <tr><th>변경사유</th><td colspan="3">${data?.changeReason || ""}</td></tr>
    </table>

    <div class="section-title">4. 적용 보험 종류</div>
    <table>
      <tr class="check-row">
        <td>${checkBox(true)} 국민연금</td>
        <td>${checkBox(true)} 건강보험</td>
        <td>${checkBox(true)} 고용보험</td>
        <td>${checkBox(true)} 산재보험</td>
      </tr>
    </table>
  `;
}
