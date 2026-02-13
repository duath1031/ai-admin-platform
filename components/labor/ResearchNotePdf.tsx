"use client";

import { useRef } from "react";

interface ResearchNoteData {
  projectName: string;
  projectCode?: string | null;
  researchPeriod?: string | null;
  noteDate: string;
  noteNumber: number;
  title: string;
  purpose?: string | null;
  content: string;
  result?: string | null;
  conclusion?: string | null;
  nextPlan?: string | null;
  materials?: string | null;
  equipment?: string | null;
  researcherName?: string | null;
  supervisorName?: string | null;
}

interface ResearchNotePdfProps {
  note: ResearchNoteData;
}

export default function ResearchNotePdf({ note }: ResearchNotePdfProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}.`;
    } catch {
      return dateStr;
    }
  };

  const nl2br = (text: string | null | undefined) => {
    if (!text) return "";
    return text.replace(/\n/g, "<br/>");
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>연구노트 - ${note.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            padding: 15mm 20mm;
            font-size: 10.5pt;
            color: #222;
            line-height: 1.6;
          }
          .rn-header {
            text-align: center;
            font-size: 20pt;
            font-weight: bold;
            letter-spacing: 12px;
            padding: 16px 0;
            border-top: 3px solid #222;
            border-bottom: 3px solid #222;
            margin-bottom: 0;
          }
          table.rn-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          table.rn-table th,
          table.rn-table td {
            border: 1px solid #555;
            padding: 8px 12px;
            vertical-align: top;
            font-size: 10.5pt;
          }
          table.rn-table th {
            background: #f5f5f5;
            font-weight: bold;
            text-align: center;
            width: 120px;
            white-space: nowrap;
          }
          table.rn-table td {
            text-align: left;
          }
          .rn-section-title {
            background: #f5f5f5;
            font-weight: bold;
            padding: 8px 12px;
            border: 1px solid #555;
            border-bottom: none;
            font-size: 10.5pt;
          }
          .rn-section-content {
            padding: 12px;
            border: 1px solid #555;
            min-height: 60px;
            font-size: 10.5pt;
            line-height: 1.8;
            white-space: pre-wrap;
          }
          .rn-section-content-large {
            min-height: 120px;
          }
          .rn-sign-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
          }
          .rn-sign-table th,
          .rn-sign-table td {
            border: 1px solid #555;
            padding: 8px 12px;
            text-align: center;
            font-size: 10.5pt;
          }
          .rn-sign-table th {
            background: #f5f5f5;
            font-weight: bold;
            width: 120px;
          }
          .rn-sign-table td {
            height: 60px;
            vertical-align: middle;
          }
          .rn-footer {
            margin-top: 24px;
            text-align: center;
            font-size: 8.5pt;
            color: #999;
          }
          .rn-sub-info {
            padding: 8px 12px;
            border: 1px solid #555;
            border-top: none;
            font-size: 9.5pt;
            color: #555;
          }
          @media print {
            body { padding: 10mm 15mm; }
            .rn-section-content { page-break-inside: avoid; }
          }
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        인쇄 / PDF 저장
      </button>

      {/* 인쇄 콘텐츠 */}
      <div ref={printRef} className="bg-white p-6 rounded-lg border max-w-[210mm] mx-auto">
        {/* 제목 */}
        <div
          className="rn-header"
          style={{
            textAlign: "center",
            fontSize: "20pt",
            fontWeight: "bold",
            letterSpacing: "12px",
            padding: "16px 0",
            borderTop: "3px solid #222",
            borderBottom: "3px solid #222",
            marginBottom: 0,
          }}
        >
          연 구 노 트
        </div>

        {/* 과제 정보 테이블 */}
        <table
          className="rn-table"
          style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
        >
          <tbody>
            <tr>
              <th
                style={{
                  border: "1px solid #555",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                  whiteSpace: "nowrap",
                }}
              >
                과제명
              </th>
              <td style={{ border: "1px solid #555", padding: "8px 12px" }}>
                {note.projectName}
              </td>
            </tr>
            <tr>
              <th
                style={{
                  border: "1px solid #555",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                }}
              >
                과제번호
              </th>
              <td style={{ border: "1px solid #555", padding: "8px 12px" }}>
                {note.projectCode || "-"}
              </td>
            </tr>
            <tr>
              <th
                style={{
                  border: "1px solid #555",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                }}
              >
                연구기간
              </th>
              <td style={{ border: "1px solid #555", padding: "8px 12px" }}>
                {note.researchPeriod || "-"}
              </td>
            </tr>
            <tr>
              <th
                style={{
                  border: "1px solid #555",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                }}
              >
                작성일
              </th>
              <td style={{ border: "1px solid #555", padding: "8px 12px" }}>
                {formatDate(note.noteDate)}&nbsp;&nbsp;&nbsp;&nbsp;No.{" "}
                {note.noteNumber}
              </td>
            </tr>
            <tr>
              <th
                style={{
                  border: "1px solid #555",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                }}
              >
                제목
              </th>
              <td
                style={{
                  border: "1px solid #555",
                  padding: "8px 12px",
                  fontWeight: "bold",
                }}
              >
                {note.title}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 1. 연구목적 */}
        <div
          className="rn-section-title"
          style={{
            background: "#f5f5f5",
            fontWeight: "bold",
            padding: "8px 12px",
            border: "1px solid #555",
            borderTop: "none",
            borderBottom: "none",
          }}
        >
          1. 연구목적
        </div>
        <div
          className="rn-section-content"
          style={{
            padding: "12px",
            border: "1px solid #555",
            minHeight: 60,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: nl2br(note.purpose) || "&nbsp;" }}
        />

        {/* 2. 실험/연구 내용 */}
        <div
          className="rn-section-title"
          style={{
            background: "#f5f5f5",
            fontWeight: "bold",
            padding: "8px 12px",
            border: "1px solid #555",
            borderTop: "none",
            borderBottom: "none",
          }}
        >
          2. 실험/연구 내용
        </div>
        <div
          className="rn-section-content rn-section-content-large"
          style={{
            padding: "12px",
            border: "1px solid #555",
            minHeight: 120,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: nl2br(note.content) || "&nbsp;" }}
        />

        {/* 3. 결과 */}
        <div
          className="rn-section-title"
          style={{
            background: "#f5f5f5",
            fontWeight: "bold",
            padding: "8px 12px",
            border: "1px solid #555",
            borderTop: "none",
            borderBottom: "none",
          }}
        >
          3. 결과
        </div>
        <div
          className="rn-section-content"
          style={{
            padding: "12px",
            border: "1px solid #555",
            minHeight: 60,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: nl2br(note.result) || "&nbsp;" }}
        />

        {/* 4. 결론 및 고찰 */}
        <div
          className="rn-section-title"
          style={{
            background: "#f5f5f5",
            fontWeight: "bold",
            padding: "8px 12px",
            border: "1px solid #555",
            borderTop: "none",
            borderBottom: "none",
          }}
        >
          4. 결론 및 고찰
        </div>
        <div
          className="rn-section-content"
          style={{
            padding: "12px",
            border: "1px solid #555",
            minHeight: 60,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: nl2br(note.conclusion) || "&nbsp;" }}
        />

        {/* 5. 향후 계획 */}
        <div
          className="rn-section-title"
          style={{
            background: "#f5f5f5",
            fontWeight: "bold",
            padding: "8px 12px",
            border: "1px solid #555",
            borderTop: "none",
            borderBottom: "none",
          }}
        >
          5. 향후 계획
        </div>
        <div
          className="rn-section-content"
          style={{
            padding: "12px",
            border: "1px solid #555",
            minHeight: 60,
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{ __html: nl2br(note.nextPlan) || "&nbsp;" }}
        />

        {/* 사용재료 / 사용장비 */}
        {(note.materials || note.equipment) && (
          <div
            className="rn-sub-info"
            style={{
              padding: "8px 12px",
              border: "1px solid #555",
              borderTop: "none",
              fontSize: "9.5pt",
              color: "#555",
            }}
          >
            {note.materials && (
              <div>
                <strong>사용재료:</strong> {note.materials}
              </div>
            )}
            {note.equipment && (
              <div>
                <strong>사용장비:</strong> {note.equipment}
              </div>
            )}
          </div>
        )}

        {/* 서명란 */}
        <table
          className="rn-sign-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 0,
          }}
        >
          <tbody>
            <tr>
              <th
                style={{
                  border: "1px solid #555",
                  borderTop: note.materials || note.equipment ? "1px solid #555" : "none",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                }}
              >
                연구원
              </th>
              <td
                style={{
                  border: "1px solid #555",
                  borderTop: note.materials || note.equipment ? "1px solid #555" : "none",
                  padding: "8px 12px",
                  height: 60,
                  textAlign: "center",
                  verticalAlign: "middle",
                }}
              >
                {note.researcherName || ""}&nbsp;&nbsp;&nbsp;&nbsp;(서명)
              </td>
              <th
                style={{
                  border: "1px solid #555",
                  borderTop: note.materials || note.equipment ? "1px solid #555" : "none",
                  padding: "8px 12px",
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  textAlign: "center",
                  width: 120,
                }}
              >
                연구책임자
              </th>
              <td
                style={{
                  border: "1px solid #555",
                  borderTop: note.materials || note.equipment ? "1px solid #555" : "none",
                  padding: "8px 12px",
                  height: 60,
                  textAlign: "center",
                  verticalAlign: "middle",
                }}
              >
                {note.supervisorName || ""}&nbsp;&nbsp;&nbsp;&nbsp;(서명)
              </td>
            </tr>
          </tbody>
        </table>

        {/* 푸터 */}
        <div
          className="rn-footer"
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: "8.5pt",
            color: "#999",
          }}
        >
          <p style={{ marginTop: 8 }}>
            ※ 어드미니(Admini) AI 행정서비스로 자동 생성된 연구노트입니다.
          </p>
          <p style={{ marginTop: 4, fontSize: "8pt" }}>
            aiadminplatform.vercel.app
          </p>
        </div>
      </div>
    </div>
  );
}
