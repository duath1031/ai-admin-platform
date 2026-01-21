"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, Button, Textarea } from "@/components/ui";

interface Document {
  id: string;
  title: string;
  type: string;
  content: string;
  inputData: Record<string, string>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const documentTypes: Record<string, { name: string; icon: string }> = {
  petition: { name: "진정서", icon: "📝" },
  appeal: { name: "탄원서", icon: "📋" },
  objection: { name: "이의신청서", icon: "📄" },
  application: { name: "신청서", icon: "📑" },
};

export default function DocumentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDocument();
  }, [params.id]);

  const fetchDocument = async () => {
    try {
      const response = await fetch(`/api/documents/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setDocument(data);
        setEditContent(data.content);
      } else {
        router.push("/documents");
      }
    } catch (error) {
      console.error("Failed to fetch document:", error);
      router.push("/documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/documents/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (response.ok) {
        setDocument({ ...document, content: editContent });
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to save:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/documents/${params.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/documents");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("삭제에 실패했습니다.");
    }
  };

  const handleCopy = () => {
    if (document) {
      navigator.clipboard.writeText(document.content);
      alert("클립보드에 복사되었습니다.");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow && document) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${document.title}</title>
          <style>
            body {
              font-family: 'Malgun Gothic', sans-serif;
              padding: 40px;
              line-height: 1.8;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          ${document.content}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500">서류를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const typeInfo = documentTypes[document.type] || { name: document.type, icon: "📄" };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/documents")}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-2xl">{typeInfo.icon}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{document.title}</h1>
            <p className="text-sm text-gray-500">
              {typeInfo.name} · {new Date(document.createdAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              document.status === "completed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {document.status === "completed" ? "완료" : "작성중"}
          </span>
        </div>
      </div>

      {/* Content */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {isEditing ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm"
            />
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 whitespace-pre-wrap font-mono text-sm leading-relaxed min-h-[300px]">
              {document.content}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleDelete} className="text-red-600 border-red-200 hover:bg-red-50">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          삭제
        </Button>

        <div className="flex gap-3">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                저장
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCopy}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                복사
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                인쇄
              </Button>
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                수정
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Input Data Summary */}
      {document.inputData && Object.keys(document.inputData).length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">입력 정보</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              {document.inputData.applicantName && (
                <div>
                  <span className="text-gray-500">신청인:</span>{" "}
                  <span className="text-gray-900">{document.inputData.applicantName}</span>
                </div>
              )}
              {document.inputData.recipient && (
                <div>
                  <span className="text-gray-500">수신:</span>{" "}
                  <span className="text-gray-900">{document.inputData.recipient}</span>
                </div>
              )}
              {document.inputData.purpose && (
                <div className="md:col-span-2">
                  <span className="text-gray-500">요청 취지:</span>{" "}
                  <span className="text-gray-900">{document.inputData.purpose}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
