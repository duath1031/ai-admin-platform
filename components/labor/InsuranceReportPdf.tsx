"use client";

// ═══════════════════════════════════════════════════════════════════
// 4대보험 신고서 법정양식 PDF 인쇄 컴포넌트
// - 별지 제5호서식: 자격취득 신고서 (국민연금법·건강보험법·고용보험법 시행규칙)
// - 별지 제6호서식: 자격상실 신고서
// - 보수월액변경 신고서
// ═══════════════════════════════════════════════════════════════════

export interface EmployeeInfo {
  name: string;
  birthDate?: string | null;
  department?: string | null;
  position?: string | null;
  hireDate: string;
  resignDate?: string | null;
  employmentType: string;
  monthlySalary: number;
}

export interface CompanyInfo {
  companyName?: string;
  ownerName?: string;
  bizRegNo?: string;
  address?: string;
  phone?: string;
  npBizNo?: string;   // 국민연금 사업장관리번호
  hiBizNo?: string;   // 건강보험 사업장관리번호
  eiBizNo?: string;   // 고용·산재 사업장관리번호
}

export interface ReportData {
  reportDate: string;
  residentNo?: string;
  workerAddress?: string;
  workerPhone?: string;

  // ── 취득 (별지 제5호서식) ──
  acquisitionDate?: string;
  // 국민연금
  npAcqCode?: string;         // 취득부호 (1: 18세이상 당연취득, 5: 일용근로자, 6: 단시간, ...)
  npFirstMonthPay?: string;   // 취득월 납부여부 (1: 희망, 2: 미희망)
  npIncome?: number;          // 소득월액
  // 건강보험
  hiAcqCode?: string;         // 취득부호 (00: 최초취득, 13: 기타)
  hiSalary?: number;          // 보수월액
  // 고용보험
  eiSalary?: number;
  weeklyWorkHours?: number;   // 1주 소정근로시간
  isContract?: boolean;       // 계약직 여부
  contractEndDate?: string;   // 계약종료예정일
  // 산재보험
  iaSalary?: number;
  // 가입보험 선택
  nationalPension?: boolean;
  healthInsurance?: boolean;
  employmentInsurance?: boolean;
  industrialAccident?: boolean;

  // ── 상실 (별지 제6호서식) ──
  lossDate?: string;
  lastWorkDate?: string;
  // 국민연금
  npLossCode?: string;         // 상실부호 (1: 사업장탈퇴, 2: 60세도달, 3: 사망, ...)
  // 건강보험
  hiLossCode?: string;         // 상실부호 (1: 사용관계종료, 3: 사망, 9: 기타)
  hiCurrentYearSalary?: number;
  hiCurrentYearMonths?: number;
  hiPrevYearSalary?: number;
  hiPrevYearMonths?: number;
  // 고용보험
  eiLossCode?: string;         // 상실사유코드 (11: 자진퇴사, 23: 경영상필요, 26: 귀책사유, 31: 정년, 32: 계약만료 ...)
  eiLossDetail?: string;
  eiCurrentYearSalary?: number;
  eiCurrentYearMonths?: number;
  eiPrevYearSalary?: number;
  eiPrevYearMonths?: number;
  eiSubmitLeaveConfirm?: boolean;

  // ── 보수월액변경 ──
  changeDate?: string;
  beforeSalary?: number;
  afterSalary?: number;
  changeReason?: string;
}

interface InsuranceReportPdfProps {
  reportType: "acquisition" | "loss" | "salary_change";
  employee: EmployeeInfo;
  company: CompanyInfo;
  reportData: ReportData;
}

export default function InsuranceReportPdf({
  reportType,
  employee,
  company,
  reportData,
}: InsuranceReportPdfProps) {

  const handlePrint = () => {
    const html = generateHtml(reportType, employee, company, reportData);
    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
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

// ─── Utilities ───

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateParts(dateStr?: string | null): { y: string; m: string; d: string } {
  if (!dateStr) return { y: "", m: "", d: "" };
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return { y: "", m: "", d: "" };
  return {
    y: String(dt.getFullYear()),
    m: String(dt.getMonth() + 1).padStart(2, "0"),
    d: String(dt.getDate()).padStart(2, "0"),
  };
}

function fmtMoney(amount?: number | null): string {
  if (amount == null) return "";
  return amount.toLocaleString("ko-KR");
}

function fmtBizNo(no?: string): string {
  if (!no) return "";
  const c = no.replace(/\D/g, "");
  if (c.length === 10) return `${c.slice(0, 3)}-${c.slice(3, 5)}-${c.slice(5)}`;
  return no;
}

// ─── HTML Generation ───

function generateHtml(
  reportType: string,
  emp: EmployeeInfo,
  co: CompanyInfo,
  data: ReportData,
): string {
  const styles = `<style>
    @page { size: A4; margin: 12mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-size: 10px; color: #000; line-height: 1.4; }
    .page { width: 100%; max-width: 190mm; margin: 0 auto; }
    .form-no { font-size: 9px; color: #555; margin-bottom: 2px; }
    .title-box { text-align: center; margin: 8px 0 4px; }
    .title-box h1 { font-size: 11px; line-height: 1.6; letter-spacing: 1px; }
    .title-box .sub { font-size: 9px; color: #666; margin-top: 2px; }
    .proc { text-align: right; font-size: 9px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 3px 5px; font-size: 10px; vertical-align: middle; }
    th { background: #f9f9f9; font-weight: 600; text-align: center; }
    .section-header { background: #eee; font-weight: 700; text-align: center; font-size: 10px; padding: 4px; }
    .no-border { border: none; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .small { font-size: 8px; }
    .tiny { font-size: 7px; color: #666; }
    .sign-area { margin-top: 15px; font-size: 10px; line-height: 1.8; }
    .sign-area .date-line { text-align: center; margin: 10px 0; }
    .sign-area .signer { margin-left: 40%; }
    .recipient { margin-top: 12px; text-align: center; font-size: 10px; }
    .legal-text { font-size: 8px; line-height: 1.5; margin-top: 12px; border-top: 1px solid #000; padding-top: 6px; }
    .footer { margin-top: 10px; text-align: center; font-size: 8px; color: #999; border-top: 1px dashed #ccc; padding-top: 4px; }
    .field-box { display: inline-block; min-width: 60px; border-bottom: 1px solid #999; text-align: center; padding: 0 4px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; }
    }
  </style>`;

  let body = "";
  if (reportType === "acquisition") {
    body = genAcquisitionForm(emp, co, data);
  } else if (reportType === "loss") {
    body = genLossForm(emp, co, data);
  } else {
    body = genSalaryChangeForm(emp, co, data);
  }

  const title = reportType === "acquisition" ? "4대보험 자격취득 신고서"
    : reportType === "loss" ? "4대보험 자격상실 신고서"
    : "보수월액변경 신고서";

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${title}</title>${styles}</head><body><div class="page">${body}</div></body></html>`;
}

// ═══════════════════════════════════════════
// 별지 제5호서식 - 자격취득 신고서
// ═══════════════════════════════════════════
function genAcquisitionForm(emp: EmployeeInfo, co: CompanyInfo, d: ReportData): string {
  const dateParts = fmtDateParts(d.reportDate);
  const acqDateParts = fmtDateParts(d.acquisitionDate || emp.hireDate);
  const salary = d.npIncome || d.hiSalary || emp.monthlySalary;

  return `
    <p class="form-no">[별지 제5호서식] &lt;국민연금법 시행규칙 / 국민건강보험법 시행규칙 / 고용보험법 시행규칙&gt;</p>

    <div class="title-box">
      <h1>
        국민연금 사업장가입자 자격취득 신고서<br/>
        건강보험 직장가입자 자격취득 신고서<br/>
        고용보험 피보험자 자격취득 신고서<br/>
        산재보험 근로자 고용 신고서
      </h1>
    </div>
    <p class="proc">처리기간: 즉시</p>

    <!-- 접수 -->
    <table>
      <tr>
        <th style="width:80px;">접수번호</th>
        <td style="width:120px;"></td>
        <th style="width:80px;">접수일자</th>
        <td></td>
      </tr>
    </table>

    <!-- 1. 사업장 -->
    <table style="margin-top:-1px;">
      <tr><td class="section-header" colspan="6">1. 사 업 장</td></tr>
      <tr>
        <th rowspan="4" style="width:80px;">사업장<br/>관리번호</th>
        <th style="width:65px;">국민연금</th>
        <td style="width:140px;">${co.npBizNo || ""}</td>
        <th style="width:65px;">건강보험</th>
        <td colspan="2">${co.hiBizNo || ""}</td>
      </tr>
      <tr>
        <th>고용보험</th>
        <td>${co.eiBizNo || ""}</td>
        <th>산재보험</th>
        <td colspan="2">${co.eiBizNo || ""}</td>
      </tr>
      <tr>
        <th colspan="2">명 칭</th>
        <td colspan="3">${co.companyName || ""}</td>
      </tr>
      <tr>
        <th colspan="2">전화번호</th>
        <td colspan="3">${co.phone || ""}</td>
      </tr>
    </table>

    <!-- 2. 가입자 인적사항 -->
    <table style="margin-top:-1px;">
      <tr><td class="section-header" colspan="14">2. 가입자(피보험자) 인적사항</td></tr>
      <tr>
        <th rowspan="2" style="width:24px;">번호</th>
        <th rowspan="2" style="width:50px;">성명</th>
        <th rowspan="2" style="width:80px;">주민등록번호</th>
        <th rowspan="2" style="width:60px;">자격<br/>취득일</th>
        <th colspan="3" class="text-center">국민연금</th>
        <th colspan="2" class="text-center">건강보험</th>
        <th colspan="4" class="text-center">고용보험</th>
        <th class="text-center">산재</th>
      </tr>
      <tr>
        <th class="small" style="width:32px;">취득<br/>부호</th>
        <th class="small" style="width:32px;">취득월<br/>납부</th>
        <th class="small" style="width:55px;">소득월액</th>
        <th class="small" style="width:32px;">취득<br/>부호</th>
        <th class="small" style="width:55px;">보수월액</th>
        <th class="small" style="width:55px;">보수월액</th>
        <th class="small" style="width:30px;">1주<br/>소정</th>
        <th class="small" style="width:30px;">계약<br/>직</th>
        <th class="small" style="width:50px;">계약<br/>종료일</th>
        <th class="small" style="width:55px;">보수월액</th>
      </tr>
      <tr>
        <td class="text-center">1</td>
        <td class="text-center">${emp.name}</td>
        <td class="text-center">${d.residentNo || ""}</td>
        <td class="text-center small">${acqDateParts.y}.${acqDateParts.m}.${acqDateParts.d}</td>
        <td class="text-center">${d.nationalPension !== false ? (d.npAcqCode || "1") : "-"}</td>
        <td class="text-center">${d.nationalPension !== false ? (d.npFirstMonthPay || "2") : "-"}</td>
        <td class="text-right small">${d.nationalPension !== false ? fmtMoney(d.npIncome || salary) : "-"}</td>
        <td class="text-center">${d.healthInsurance !== false ? (d.hiAcqCode || "00") : "-"}</td>
        <td class="text-right small">${d.healthInsurance !== false ? fmtMoney(d.hiSalary || salary) : "-"}</td>
        <td class="text-right small">${d.employmentInsurance !== false ? fmtMoney(d.eiSalary || salary) : "-"}</td>
        <td class="text-center">${d.employmentInsurance !== false ? String(d.weeklyWorkHours || 40) : "-"}</td>
        <td class="text-center">${d.employmentInsurance !== false ? (d.isContract ? "Y" : "N") : "-"}</td>
        <td class="text-center small">${d.isContract && d.contractEndDate ? fmtDate(d.contractEndDate) : ""}</td>
        <td class="text-right small">${d.industrialAccident !== false ? fmtMoney(d.iaSalary || salary) : "-"}</td>
      </tr>
      <tr>
        <th>주소</th>
        <td colspan="13" class="text-left">${d.workerAddress || ""}</td>
      </tr>
      <tr>
        <th class="small">전화</th>
        <td colspan="13" class="text-left">${d.workerPhone || ""}</td>
      </tr>
    </table>

    <!-- 법적 근거 + 서명 -->
    <div class="sign-area">
      <p style="font-size:9px; line-height:1.6;">
        「국민연금법」 제21조, 「국민건강보험법」 제11조, 「고용보험법」 제15조, 「산업재해보상보험법」 제5조의 규정에 따라 위와 같이 신고합니다.
      </p>
      <p class="date-line">${dateParts.y}년 ${dateParts.m}월 ${dateParts.d}일</p>
      <div class="signer">
        <table class="no-border" style="border:none; width:auto;">
          <tr class="no-border">
            <td class="no-border text-left" style="width:100px; padding:2px 0;">신고인(사업주)</td>
            <td class="no-border text-left" style="padding:2px 0;">사업장명칭: ${co.companyName || ""}</td>
          </tr>
          <tr class="no-border">
            <td class="no-border"></td>
            <td class="no-border text-left" style="padding:2px 0;">대표자(성명): ${co.ownerName || ""}  (서명 또는 인)</td>
          </tr>
          <tr class="no-border">
            <td class="no-border"></td>
            <td class="no-border text-left" style="padding:2px 0;">전화번호: ${co.phone || ""}</td>
          </tr>
        </table>
      </div>
    </div>

    <p class="recipient">국민연금공단 이사장 / 국민건강보험공단 이사장 / 근로복지공단 ○○지역본부(지사)장 귀하</p>

    <!-- 작성방법 안내 -->
    <div class="legal-text">
      <p><strong>※ 작성방법</strong></p>
      <p>1. 국민연금 취득부호: 1-18세이상 당연취득, 5-일용근로자, 6-단시간근로자, 7-18세미만</p>
      <p>2. 국민연금 취득월 납부: 1-희망(입사월부터 납부), 2-미희망(다음달부터 납부)</p>
      <p>3. 건강보험 취득부호: 00-최초취득, 13-기타</p>
      <p>4. 고용보험 계약직: Y-예, N-아니오 (계약직인 경우 계약종료일 기재)</p>
      <p>5. 보수월액(소득월액): 비과세 소득을 제외한 월 급여총액</p>
    </div>

    <div class="footer">
      본 신고서는 어드미니(Admini) 플랫폼에서 자동 생성되었습니다. 실제 신고는 4대 사회보험 정보연계센터(www.4insure.or.kr)에 제출하세요.
    </div>
  `;
}

// ═══════════════════════════════════════════
// 별지 제6호서식 - 자격상실 신고서
// ═══════════════════════════════════════════
function genLossForm(emp: EmployeeInfo, co: CompanyInfo, d: ReportData): string {
  const dateParts = fmtDateParts(d.reportDate);
  const lossDateParts = fmtDateParts(d.lossDate || emp.resignDate);

  return `
    <p class="form-no">[별지 제6호서식] &lt;국민연금법 시행규칙 / 국민건강보험법 시행규칙 / 고용보험법 시행규칙&gt;</p>

    <div class="title-box">
      <h1>
        국민연금 사업장가입자 자격상실 신고서<br/>
        건강보험 직장가입자 자격상실 신고서<br/>
        고용보험 피보험자 자격상실 신고서<br/>
        산재보험 근로자 고용종료 신고서
      </h1>
    </div>
    <p class="proc">처리기간: 즉시</p>

    <!-- 접수 -->
    <table>
      <tr>
        <th style="width:80px;">접수번호</th>
        <td style="width:120px;"></td>
        <th style="width:80px;">접수일자</th>
        <td></td>
      </tr>
    </table>

    <!-- 1. 사업장 -->
    <table style="margin-top:-1px;">
      <tr><td class="section-header" colspan="6">1. 사 업 장</td></tr>
      <tr>
        <th rowspan="4" style="width:80px;">사업장<br/>관리번호</th>
        <th style="width:65px;">국민연금</th>
        <td style="width:140px;">${co.npBizNo || ""}</td>
        <th style="width:65px;">건강보험</th>
        <td colspan="2">${co.hiBizNo || ""}</td>
      </tr>
      <tr>
        <th>고용보험</th>
        <td>${co.eiBizNo || ""}</td>
        <th>산재보험</th>
        <td colspan="2">${co.eiBizNo || ""}</td>
      </tr>
      <tr>
        <th colspan="2">명 칭</th>
        <td colspan="3">${co.companyName || ""}</td>
      </tr>
      <tr>
        <th colspan="2">전화번호</th>
        <td colspan="3">${co.phone || ""}</td>
      </tr>
    </table>

    <!-- 2. 가입자 인적사항 + 상실내용 -->
    <table style="margin-top:-1px;">
      <tr><td class="section-header" colspan="14">2. 가입자(피보험자) 상실 내용</td></tr>
      <!-- Header Row 1 -->
      <tr>
        <th rowspan="2" style="width:24px;">번호</th>
        <th rowspan="2" style="width:45px;">성명</th>
        <th rowspan="2" style="width:80px;">주민등록번호</th>
        <th rowspan="2" style="width:55px;">자격<br/>상실일</th>
        <th colspan="1" class="text-center">국민연금</th>
        <th colspan="4" class="text-center">건강보험</th>
        <th colspan="5" class="text-center">고용보험</th>
      </tr>
      <!-- Header Row 2 -->
      <tr>
        <th class="small" style="width:30px;">상실<br/>부호</th>
        <th class="small" style="width:30px;">상실<br/>부호</th>
        <th class="small" style="width:50px;">당해연도<br/>보수총액</th>
        <th class="small" style="width:24px;">개월</th>
        <th class="small" style="width:50px;">전년도<br/>보수총액</th>
        <th class="small" style="width:35px;">상실<br/>사유</th>
        <th class="small" style="width:50px;">당해연도<br/>보수총액</th>
        <th class="small" style="width:24px;">개월</th>
        <th class="small" style="width:50px;">전년도<br/>보수총액</th>
        <th class="small" style="width:24px;">이직<br/>확인</th>
      </tr>
      <!-- Data Row -->
      <tr>
        <td class="text-center">1</td>
        <td class="text-center">${emp.name}</td>
        <td class="text-center">${d.residentNo || ""}</td>
        <td class="text-center small">${lossDateParts.y}.${lossDateParts.m}.${lossDateParts.d}</td>
        <td class="text-center">${d.npLossCode || "1"}</td>
        <td class="text-center">${d.hiLossCode || "1"}</td>
        <td class="text-right small">${fmtMoney(d.hiCurrentYearSalary)}</td>
        <td class="text-center">${d.hiCurrentYearMonths || ""}</td>
        <td class="text-right small">${fmtMoney(d.hiPrevYearSalary)}</td>
        <td class="text-center small">${d.eiLossCode || "11"}</td>
        <td class="text-right small">${fmtMoney(d.eiCurrentYearSalary)}</td>
        <td class="text-center">${d.eiCurrentYearMonths || ""}</td>
        <td class="text-right small">${fmtMoney(d.eiPrevYearSalary)}</td>
        <td class="text-center">${d.eiSubmitLeaveConfirm ? "Y" : "N"}</td>
      </tr>
      <tr>
        <th class="small">최종<br/>근무일</th>
        <td colspan="3" class="text-left">${fmtDate(d.lastWorkDate)}</td>
        <th class="small">전화</th>
        <td colspan="9" class="text-left">${d.workerPhone || ""}</td>
      </tr>
      ${d.eiLossDetail ? `<tr>
        <th class="small">고용보험<br/>상세사유</th>
        <td colspan="13" class="text-left">${d.eiLossDetail}</td>
      </tr>` : ""}
    </table>

    <!-- 법적 근거 + 서명 -->
    <div class="sign-area">
      <p style="font-size:9px; line-height:1.6;">
        「국민연금법」 제22조, 「국민건강보험법」 제11조, 「고용보험법」 제16조, 「산업재해보상보험법」 제5조의 규정에 따라 위와 같이 신고합니다.
      </p>
      <p class="date-line">${dateParts.y}년 ${dateParts.m}월 ${dateParts.d}일</p>
      <div class="signer">
        <table class="no-border" style="border:none; width:auto;">
          <tr class="no-border">
            <td class="no-border text-left" style="width:100px; padding:2px 0;">신고인(사업주)</td>
            <td class="no-border text-left" style="padding:2px 0;">사업장명칭: ${co.companyName || ""}</td>
          </tr>
          <tr class="no-border">
            <td class="no-border"></td>
            <td class="no-border text-left" style="padding:2px 0;">대표자(성명): ${co.ownerName || ""}  (서명 또는 인)</td>
          </tr>
          <tr class="no-border">
            <td class="no-border"></td>
            <td class="no-border text-left" style="padding:2px 0;">전화번호: ${co.phone || ""}</td>
          </tr>
        </table>
      </div>
    </div>

    <p class="recipient">국민연금공단 이사장 / 국민건강보험공단 이사장 / 근로복지공단 ○○지역본부(지사)장 귀하</p>

    <div class="legal-text">
      <p><strong>※ 작성방법</strong></p>
      <p>1. 국민연금 상실부호: 1-사업장탈퇴, 2-60세도달, 3-사망, 4-국적상실/국외이주, 5-다른 공적연금 가입, 11-기타</p>
      <p>2. 건강보험 상실부호: 1-사용관계종료, 2-적용제외사유발생, 3-사망, 4-국적상실/국외이주, 9-기타</p>
      <p>3. 고용보험 상실사유: 11-자진퇴사, 22-폐업/도산, 23-경영상필요, 26-근로자귀책사유, 31-정년, 32-계약기간만료, 41-고용보험비적용</p>
      <p>4. 자격상실일: 퇴사일(최종근무일) 다음 날</p>
      <p>5. 보수총액: 비과세 소득 제외, 세전 기준 (퇴직금 제외)</p>
      <p>6. 이직확인서 동시제출: 피보험자격 상실신고와 함께 이직확인서 제출 여부 (Y/N)</p>
    </div>

    <div class="footer">
      본 신고서는 어드미니(Admini) 플랫폼에서 자동 생성되었습니다. 실제 신고는 4대 사회보험 정보연계센터(www.4insure.or.kr)에 제출하세요.
    </div>
  `;
}

// ═══════════════════════════════════════════
// 보수월액변경 신고서
// ═══════════════════════════════════════════
function genSalaryChangeForm(emp: EmployeeInfo, co: CompanyInfo, d: ReportData): string {
  const dateParts = fmtDateParts(d.reportDate);
  const changeDateParts = fmtDateParts(d.changeDate);
  const diff = (d.afterSalary && d.beforeSalary) ? d.afterSalary - d.beforeSalary : 0;

  return `
    <p class="form-no">[별지 서식] &lt;국민건강보험법 시행규칙 / 국민연금법 시행규칙&gt;</p>

    <div class="title-box">
      <h1>
        건강보험 보수월액변경 신고서<br/>
        국민연금 소득월액변경 신고서
      </h1>
    </div>
    <p class="proc">처리기간: 즉시</p>

    <!-- 접수 -->
    <table>
      <tr>
        <th style="width:80px;">접수번호</th>
        <td style="width:120px;"></td>
        <th style="width:80px;">접수일자</th>
        <td></td>
      </tr>
    </table>

    <!-- 1. 사업장 -->
    <table style="margin-top:-1px;">
      <tr><td class="section-header" colspan="6">1. 사 업 장</td></tr>
      <tr>
        <th rowspan="2" style="width:80px;">사업장<br/>관리번호</th>
        <th style="width:65px;">국민연금</th>
        <td style="width:140px;">${co.npBizNo || ""}</td>
        <th style="width:65px;">건강보험</th>
        <td colspan="2">${co.hiBizNo || ""}</td>
      </tr>
      <tr>
        <th colspan="2">명 칭</th>
        <td colspan="3">${co.companyName || ""}</td>
      </tr>
      <tr>
        <td colspan="6" style="padding:0;">
          <table style="margin:0;">
            <tr>
              <th style="width:80px;">사업자등록번호</th>
              <td style="width:140px;">${fmtBizNo(co.bizRegNo)}</td>
              <th style="width:65px;">전화번호</th>
              <td>${co.phone || ""}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- 2. 변경내용 -->
    <table style="margin-top:-1px;">
      <tr><td class="section-header" colspan="8">2. 보수월액(소득월액) 변경 내용</td></tr>
      <tr>
        <th style="width:24px;">번호</th>
        <th style="width:50px;">성명</th>
        <th style="width:85px;">주민등록번호</th>
        <th style="width:65px;">변경일자</th>
        <th>변경 전<br/>보수월액(원)</th>
        <th>변경 후<br/>보수월액(원)</th>
        <th style="width:55px;">증감액(원)</th>
        <th>변경사유</th>
      </tr>
      <tr>
        <td class="text-center">1</td>
        <td class="text-center">${emp.name}</td>
        <td class="text-center">${d.residentNo || ""}</td>
        <td class="text-center small">${changeDateParts.y}.${changeDateParts.m}.${changeDateParts.d}</td>
        <td class="text-right">${fmtMoney(d.beforeSalary || emp.monthlySalary)}</td>
        <td class="text-right">${fmtMoney(d.afterSalary)}</td>
        <td class="text-right">${diff !== 0 ? (diff > 0 ? "+" : "") + fmtMoney(diff) : ""}</td>
        <td class="text-left">${d.changeReason || ""}</td>
      </tr>
    </table>

    <!-- 법적 근거 + 서명 -->
    <div class="sign-area">
      <p style="font-size:9px; line-height:1.6;">
        「국민건강보험법」 제71조, 「국민연금법」 제21조의 규정에 따라 위와 같이 신고합니다.
      </p>
      <p class="date-line">${dateParts.y}년 ${dateParts.m}월 ${dateParts.d}일</p>
      <div class="signer">
        <table class="no-border" style="border:none; width:auto;">
          <tr class="no-border">
            <td class="no-border text-left" style="width:100px; padding:2px 0;">신고인(사업주)</td>
            <td class="no-border text-left" style="padding:2px 0;">사업장명칭: ${co.companyName || ""}</td>
          </tr>
          <tr class="no-border">
            <td class="no-border"></td>
            <td class="no-border text-left" style="padding:2px 0;">대표자(성명): ${co.ownerName || ""}  (서명 또는 인)</td>
          </tr>
          <tr class="no-border">
            <td class="no-border"></td>
            <td class="no-border text-left" style="padding:2px 0;">전화번호: ${co.phone || ""}</td>
          </tr>
        </table>
      </div>
    </div>

    <p class="recipient">국민연금공단 이사장 / 국민건강보험공단 이사장 귀하</p>

    <div class="legal-text">
      <p><strong>※ 작성방법</strong></p>
      <p>1. 보수월액(소득월액): 비과세 소득을 제외한 월 급여 총액</p>
      <p>2. 변경일자: 급여가 실제 변경된 날짜</p>
      <p>3. 국민연금 소득월액 = (계약기간 총소득 ÷ 총일수) × 30일</p>
      <p>4. 건강보험 보수월액 = (계약기간 총보수 ÷ 총일수) × 30일</p>
    </div>

    <div class="footer">
      본 신고서는 어드미니(Admini) 플랫폼에서 자동 생성되었습니다. 실제 신고는 4대 사회보험 정보연계센터(www.4insure.or.kr)에 제출하세요.
    </div>
  `;
}
