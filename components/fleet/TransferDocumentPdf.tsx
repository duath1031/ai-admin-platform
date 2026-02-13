"use client";

// ─── Types ───

interface PersonInfo {
  name: string;
  idNumber?: string;
  address?: string;
  phone?: string;
}

interface VehicleInfo {
  name: string;
  type?: string;
  vin?: string;
  plateNumber?: string;
  modelYear?: number | null;
  displacement?: number | null;
  color?: string;
  purpose?: string;
  mileage?: number | null;
}

export interface TransferDocumentData {
  seller: PersonInfo;
  buyer: PersonInfo;
  vehicle: VehicleInfo;
  transferDate: string;
  transferReason?: string;
  salePrice?: number;
  contractDate?: string;
  specialTerms?: string;
  agent?: PersonInfo;
  delegationScope?: string;
  delegationDate?: string;
}

// ─── Common Styles ───

const COMMON_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    padding: 15mm 20mm;
    font-size: 11pt;
    color: #333;
    line-height: 1.6;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  th, td {
    border: 1px solid #333;
    padding: 8px 10px;
    font-size: 10pt;
    vertical-align: middle;
  }
  th {
    background: #f5f5f5;
    font-weight: bold;
    text-align: center;
    width: 100px;
  }
  td { text-align: left; }
  .doc-title {
    text-align: center;
    font-size: 20pt;
    font-weight: bold;
    margin-bottom: 24px;
    letter-spacing: 4px;
  }
  .section-title {
    font-size: 12pt;
    font-weight: bold;
    margin: 20px 0 8px;
    padding-left: 8px;
    border-left: 3px solid #333;
  }
  .signature-area {
    margin-top: 40px;
    text-align: right;
    font-size: 11pt;
    line-height: 2;
  }
  .signature-area .name {
    display: inline-block;
    min-width: 120px;
    border-bottom: 1px solid #333;
    text-align: center;
    margin-left: 8px;
  }
  .footer-note {
    margin-top: 40px;
    text-align: center;
    font-size: 8pt;
    color: #999;
  }
  .authority {
    text-align: center;
    margin-top: 30px;
    font-size: 12pt;
  }
  .seal-area {
    display: inline-block;
    margin-left: 16px;
    font-size: 10pt;
    color: #999;
  }
  @media print {
    body { padding: 10mm 15mm; }
  }
`;

// ─── Helper ───

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}년 ${m}월 ${day}일`;
}

function formatPrice(price: number): string {
  if (!price) return "";
  return price.toLocaleString();
}

function priceToKorean(num: number): string {
  if (!num || num <= 0) return "";
  const units = ["", "만", "억", "조"];
  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const subUnits = ["", "십", "백", "천"];

  let result = "";
  let unitIndex = 0;
  let n = num;

  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      let chunkStr = "";
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        if (d > 0) {
          chunkStr = digits[d] + subUnits[i] + chunkStr;
        }
        c = Math.floor(c / 10);
      }
      result = chunkStr + units[unitIndex] + result;
    }
    n = Math.floor(n / 10000);
    unitIndex++;
  }

  return "금 " + result + "원정";
}

// ─── Print Helper ───

function openPrintWindow(title: string, bodyHtml: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>${COMMON_STYLES}</style>
    </head>
    <body>
      ${bodyHtml}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

// ─── 1. 이전등록신청서 ───

export function printTransferApplication(data: TransferDocumentData) {
  const html = `
    <div class="doc-title">자동차이전등록신청서</div>

    <div class="section-title">양도인 (매도인)</div>
    <table>
      <tr>
        <th>성 명</th>
        <td>${data.seller.name}</td>
        <th>주민등록번호</th>
        <td>${data.seller.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.seller.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.seller.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">양수인 (매수인)</div>
    <table>
      <tr>
        <th>성명(법인명)</th>
        <td>${data.buyer.name}</td>
        <th>주민(사업자)번호</th>
        <td>${data.buyer.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.buyer.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.buyer.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">자동차</div>
    <table>
      <tr>
        <th>차 명</th>
        <td>${data.vehicle.name}</td>
        <th>차종</th>
        <td>${data.vehicle.type || ""}</td>
      </tr>
      <tr>
        <th>차대번호</th>
        <td>${data.vehicle.vin || ""}</td>
        <th>등록번호</th>
        <td>${data.vehicle.plateNumber || ""}</td>
      </tr>
      <tr>
        <th>연 식</th>
        <td>${data.vehicle.modelYear ? data.vehicle.modelYear + "년" : ""}</td>
        <th>용 도</th>
        <td>${data.vehicle.purpose || "자가용"}</td>
      </tr>
      ${data.vehicle.displacement ? `
      <tr>
        <th>배기량</th>
        <td>${data.vehicle.displacement.toLocaleString()}cc</td>
        <th>색 상</th>
        <td>${data.vehicle.color || ""}</td>
      </tr>
      ` : ""}
    </table>

    <div class="section-title">이전등록 사항</div>
    <table>
      <tr>
        <th>이전사유</th>
        <td>${data.transferReason || "매매"}</td>
        <th>양도일자</th>
        <td>${formatDate(data.transferDate)}</td>
      </tr>
      ${data.salePrice ? `
      <tr>
        <th>양도가액</th>
        <td colspan="3">${formatPrice(data.salePrice)}원 (${priceToKorean(data.salePrice)})</td>
      </tr>
      ` : ""}
    </table>

    <p style="margin-top: 24px; text-align: center; font-size: 11pt; line-height: 1.8;">
      「자동차관리법」 제12조 및 같은 법 시행규칙 제28조에 따라<br/>
      위와 같이 자동차 이전등록을 신청합니다.
    </p>

    <p style="text-align: center; margin-top: 20px; font-size: 11pt;">
      ${formatDate(data.transferDate)}
    </p>

    <div class="signature-area">
      <div>양도인 (매도인): <span class="name">${data.seller.name}</span> <span class="seal-area">(서명 또는 인)</span></div>
      <div>양수인 (매수인): <span class="name">${data.buyer.name}</span> <span class="seal-area">(서명 또는 인)</span></div>
    </div>

    <div class="authority" style="margin-top: 40px;">
      ○○시장 / 군수 / 구청장 귀하
    </div>

    <div class="footer-note">
      ※ 어드미니(Admini) AI 행정서비스로 자동 생성된 문서입니다.
    </div>
  `;

  openPrintWindow(`이전등록신청서 - ${data.vehicle.name}`, html);
}

// ─── 2. 양도증명서 ───

export function printTransferCertificate(data: TransferDocumentData) {
  const html = `
    <div class="doc-title">양 도 증 명 서</div>

    <div class="section-title">양도인 (매도인)</div>
    <table>
      <tr>
        <th>성 명</th>
        <td>${data.seller.name}</td>
        <th>주민등록번호</th>
        <td>${data.seller.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.seller.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.seller.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">양수인 (매수인)</div>
    <table>
      <tr>
        <th>성명(법인명)</th>
        <td>${data.buyer.name}</td>
        <th>주민(사업자)번호</th>
        <td>${data.buyer.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.buyer.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.buyer.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">양도 차량</div>
    <table>
      <tr>
        <th>차 명</th>
        <td>${data.vehicle.name}</td>
        <th>차종</th>
        <td>${data.vehicle.type || ""}</td>
      </tr>
      <tr>
        <th>차대번호</th>
        <td>${data.vehicle.vin || ""}</td>
        <th>등록번호</th>
        <td>${data.vehicle.plateNumber || ""}</td>
      </tr>
      <tr>
        <th>연 식</th>
        <td colspan="3">${data.vehicle.modelYear ? data.vehicle.modelYear + "년" : ""}</td>
      </tr>
    </table>

    <div class="section-title">양도 내역</div>
    <table>
      <tr>
        <th>양도가액</th>
        <td colspan="3">
          ${data.salePrice ? formatPrice(data.salePrice) + "원" : ""}
          ${data.salePrice ? "<br/><span style='font-size:9pt;color:#666;'>(" + priceToKorean(data.salePrice) + ")</span>" : ""}
        </td>
      </tr>
      <tr>
        <th>양도일자</th>
        <td colspan="3">${formatDate(data.transferDate)}</td>
      </tr>
    </table>

    <p style="margin-top: 24px; text-align: center; font-size: 11pt; line-height: 1.8;">
      위 자동차를 상기 양도가액에 양도하였음을 증명합니다.
    </p>

    <p style="text-align: center; margin-top: 20px; font-size: 11pt;">
      ${formatDate(data.transferDate)}
    </p>

    <div class="signature-area">
      <div style="margin-top: 32px;">
        양도인 (매도인)<br/>
        성 명: <span class="name">${data.seller.name}</span> <span class="seal-area">(서명 또는 인)</span><br/>
        주민등록번호: <span class="name">${data.seller.idNumber || ""}</span><br/>
        주 소: ${data.seller.address || ""}
      </div>
    </div>

    <div class="footer-note">
      ※ 어드미니(Admini) AI 행정서비스로 자동 생성된 문서입니다.
    </div>
  `;

  openPrintWindow(`양도증명서 - ${data.vehicle.name}`, html);
}

// ─── 3. 위임장 ───

export function printPowerOfAttorney(data: TransferDocumentData) {
  const agent = data.agent || { name: "", idNumber: "", address: "", phone: "" };

  const html = `
    <div class="doc-title">위  임  장</div>

    <div class="section-title">위임인 (양수인)</div>
    <table>
      <tr>
        <th>성명(법인명)</th>
        <td>${data.buyer.name}</td>
        <th>주민(사업자)번호</th>
        <td>${data.buyer.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.buyer.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.buyer.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">수임인 (대리인)</div>
    <table>
      <tr>
        <th>성 명</th>
        <td>${agent.name}</td>
        <th>주민등록번호</th>
        <td>${agent.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${agent.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${agent.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">위임 사항</div>
    <table>
      <tr>
        <th>위임 내용</th>
        <td colspan="3">${data.delegationScope || "자동차이전등록 신청 일체"}</td>
      </tr>
    </table>

    <div class="section-title">차량 정보</div>
    <table>
      <tr>
        <th>차 명</th>
        <td>${data.vehicle.name}</td>
        <th>등록번호</th>
        <td>${data.vehicle.plateNumber || ""}</td>
      </tr>
      <tr>
        <th>차대번호</th>
        <td colspan="3">${data.vehicle.vin || ""}</td>
      </tr>
    </table>

    <p style="margin-top: 24px; text-align: center; font-size: 11pt; line-height: 1.8;">
      위 사항에 관한 권한을 위 수임인에게 위임합니다.
    </p>

    <p style="text-align: center; margin-top: 20px; font-size: 11pt;">
      ${formatDate(data.delegationDate || data.transferDate)}
    </p>

    <div class="signature-area">
      <div style="margin-top: 32px;">
        위임인<br/>
        성 명: <span class="name">${data.buyer.name}</span> <span class="seal-area">(서명 또는 인)</span><br/>
        주민등록번호: <span class="name">${data.buyer.idNumber || ""}</span><br/>
        주 소: ${data.buyer.address || ""}
      </div>
    </div>

    <div class="footer-note">
      ※ 어드미니(Admini) AI 행정서비스로 자동 생성된 문서입니다.
    </div>
  `;

  openPrintWindow(`위임장 - ${data.vehicle.name}`, html);
}

// ─── 4. 매매계약서 ───

export function printSaleContract(data: TransferDocumentData) {
  const html = `
    <div class="doc-title">자동차 매매계약서</div>

    <div class="section-title">매도인</div>
    <table>
      <tr>
        <th>성 명</th>
        <td>${data.seller.name}</td>
        <th>주민등록번호</th>
        <td>${data.seller.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.seller.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.seller.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">매수인</div>
    <table>
      <tr>
        <th>성명(법인명)</th>
        <td>${data.buyer.name}</td>
        <th>주민(사업자)번호</th>
        <td>${data.buyer.idNumber || ""}</td>
      </tr>
      <tr>
        <th>주 소</th>
        <td colspan="3">${data.buyer.address || ""}</td>
      </tr>
      <tr>
        <th>전화번호</th>
        <td colspan="3">${data.buyer.phone || ""}</td>
      </tr>
    </table>

    <div class="section-title">매매 차량</div>
    <table>
      <tr>
        <th>차 명</th>
        <td>${data.vehicle.name}</td>
        <th>차종</th>
        <td>${data.vehicle.type || ""}</td>
      </tr>
      <tr>
        <th>연 식</th>
        <td>${data.vehicle.modelYear ? data.vehicle.modelYear + "년" : ""}</td>
        <th>색 상</th>
        <td>${data.vehicle.color || ""}</td>
      </tr>
      <tr>
        <th>차대번호</th>
        <td colspan="3">${data.vehicle.vin || ""}</td>
      </tr>
      <tr>
        <th>등록번호</th>
        <td colspan="3">${data.vehicle.plateNumber || ""}</td>
      </tr>
      ${data.vehicle.displacement ? `
      <tr>
        <th>배기량</th>
        <td>${data.vehicle.displacement.toLocaleString()}cc</td>
        <th>주행거리</th>
        <td>${data.vehicle.mileage ? data.vehicle.mileage.toLocaleString() + " km" : ""}</td>
      </tr>
      ` : (data.vehicle.mileage ? `
      <tr>
        <th>주행거리</th>
        <td colspan="3">${data.vehicle.mileage.toLocaleString()} km</td>
      </tr>
      ` : "")}
    </table>

    <div class="section-title">매매 대금</div>
    <table>
      <tr>
        <th>매매금액</th>
        <td colspan="3">
          ${data.salePrice ? formatPrice(data.salePrice) + "원" : ""}
          ${data.salePrice ? "<br/><span style='font-size:9pt;color:#666;'>(" + priceToKorean(data.salePrice) + ")</span>" : ""}
        </td>
      </tr>
    </table>

    ${data.specialTerms ? `
    <div class="section-title">특약 사항</div>
    <table>
      <tr>
        <td style="min-height: 80px; white-space: pre-wrap;">${data.specialTerms}</td>
      </tr>
    </table>
    ` : `
    <div class="section-title">특약 사항</div>
    <table>
      <tr>
        <td style="min-height: 80px;">
          1. 매도인은 본 차량에 대한 저당, 압류, 가압류 등 권리 제한이 없음을 보증합니다.<br/>
          2. 매도인은 이전등록에 필요한 서류 일체를 매수인에게 교부합니다.<br/>
          3. 차량의 이전등록에 소요되는 비용은 매수인이 부담합니다.<br/>
          4. 본 계약 체결 후 차량의 인도 및 이전등록은 매매대금 완납 시 완료합니다.
        </td>
      </tr>
    </table>
    `}

    <p style="margin-top: 24px; text-align: center; font-size: 11pt; line-height: 1.8;">
      위와 같이 자동차 매매계약을 체결하고,<br/>
      신의성실의 원칙에 따라 이를 이행할 것을 확인합니다.
    </p>

    <p style="text-align: center; margin-top: 20px; font-size: 11pt;">
      ${formatDate(data.contractDate || data.transferDate)}
    </p>

    <div class="signature-area">
      <div style="margin-top: 32px;">
        매도인<br/>
        성 명: <span class="name">${data.seller.name}</span> <span class="seal-area">(서명 또는 인)</span><br/>
        주민등록번호: <span class="name">${data.seller.idNumber || ""}</span>
      </div>
      <div style="margin-top: 24px;">
        매수인<br/>
        성 명: <span class="name">${data.buyer.name}</span> <span class="seal-area">(서명 또는 인)</span><br/>
        주민등록번호: <span class="name">${data.buyer.idNumber || ""}</span>
      </div>
    </div>

    <div class="footer-note">
      ※ 어드미니(Admini) AI 행정서비스로 자동 생성된 문서입니다.
    </div>
  `;

  openPrintWindow(`매매계약서 - ${data.vehicle.name}`, html);
}

// ─── 전체 인쇄 (4종 순차 인쇄) ───

export function printAllDocuments(data: TransferDocumentData) {
  printTransferApplication(data);
  setTimeout(() => printTransferCertificate(data), 500);
  setTimeout(() => printPowerOfAttorney(data), 1000);
  setTimeout(() => printSaleContract(data), 1500);
}

// ─── 미리보기 HTML 생성 ───

export function getTransferApplicationHtml(data: TransferDocumentData): string {
  return `
    <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; font-size: 10pt; color: #333;">
      <h2 style="text-align:center; letter-spacing:4px; margin-bottom:16px;">자동차이전등록신청서</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; width:90px; text-align:center; font-size:9pt;">양도인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.seller.name} / ${data.seller.idNumber || "-"} / ${data.seller.address || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">양수인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.buyer.name} / ${data.buyer.idNumber || "-"} / ${data.buyer.address || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">차량</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.vehicle.name} / ${data.vehicle.plateNumber || "-"} / ${data.vehicle.vin || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">이전사유</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.transferReason || "매매"} / ${formatDate(data.transferDate)}</td>
        </tr>
      </table>
      <p style="text-align:center; font-size:9pt; color:#999; margin-top:8px;">자동차관리법 제12조에 따른 이전등록 신청</p>
    </div>
  `;
}

export function getTransferCertificateHtml(data: TransferDocumentData): string {
  return `
    <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; font-size: 10pt; color: #333;">
      <h2 style="text-align:center; letter-spacing:4px; margin-bottom:16px;">양도증명서</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; width:90px; text-align:center; font-size:9pt;">양도인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.seller.name} / ${data.seller.address || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">양수인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.buyer.name} / ${data.buyer.address || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">차량</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.vehicle.name} / ${data.vehicle.plateNumber || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">양도가액</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.salePrice ? formatPrice(data.salePrice) + "원" : "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">양도일자</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${formatDate(data.transferDate)}</td>
        </tr>
      </table>
    </div>
  `;
}

export function getPowerOfAttorneyHtml(data: TransferDocumentData): string {
  const agent = data.agent || { name: "", idNumber: "", address: "", phone: "" };
  return `
    <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; font-size: 10pt; color: #333;">
      <h2 style="text-align:center; letter-spacing:4px; margin-bottom:16px;">위임장</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; width:90px; text-align:center; font-size:9pt;">위임인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.buyer.name} / ${data.buyer.idNumber || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">수임인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${agent.name || "-"} / ${agent.idNumber || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">위임사항</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.delegationScope || "자동차이전등록 신청 일체"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">차량</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.vehicle.name} / ${data.vehicle.plateNumber || "-"}</td>
        </tr>
      </table>
    </div>
  `;
}

export function getSaleContractHtml(data: TransferDocumentData): string {
  return `
    <div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px; font-size: 10pt; color: #333;">
      <h2 style="text-align:center; letter-spacing:4px; margin-bottom:16px;">자동차 매매계약서</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; width:90px; text-align:center; font-size:9pt;">매도인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.seller.name} / ${data.seller.address || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">매수인</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.buyer.name} / ${data.buyer.address || "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">차량</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.vehicle.name} / ${data.vehicle.plateNumber || "-"} / ${data.vehicle.modelYear ? data.vehicle.modelYear + "년식" : "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">매매금액</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${data.salePrice ? formatPrice(data.salePrice) + "원" : "-"}</td>
        </tr>
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">계약일</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt;">${formatDate(data.contractDate || data.transferDate)}</td>
        </tr>
        ${data.specialTerms ? `
        <tr>
          <th style="border:1px solid #333; background:#f5f5f5; padding:6px 8px; text-align:center; font-size:9pt;">특약사항</th>
          <td style="border:1px solid #333; padding:6px 8px; font-size:9pt; white-space:pre-wrap;">${data.specialTerms}</td>
        </tr>
        ` : ""}
      </table>
    </div>
  `;
}
