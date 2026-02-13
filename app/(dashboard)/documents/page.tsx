"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, Button } from "@/components/ui";

interface Document {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
}

const documentTypes: Record<string, { name: string; icon: string }> = {
  // 행정 서류
  petition: { name: "진정서", icon: "📝" },
  appeal: { name: "탄원서", icon: "📋" },
  objection: { name: "이의신청서", icon: "📄" },
  application: { name: "신청서", icon: "📑" },
  // 계약서
  lease_contract: { name: "임대차계약서", icon: "🏠" },
  goods_contract: { name: "물품매매계약서", icon: "📦" },
  service_contract: { name: "용역계약서", icon: "🤝" },
  labor_contract_doc: { name: "근로계약서", icon: "👷" },
  general_contract: { name: "일반계약서", icon: "📃" },
  // 내용증명
  content_certification: { name: "내용증명서", icon: "✉️" },
};

const quickLaunchGroups = [
  {
    label: "행정 서류",
    items: [
      { key: "petition", ...documentTypes.petition },
      { key: "appeal", ...documentTypes.appeal },
      { key: "objection", ...documentTypes.objection },
      { key: "application", ...documentTypes.application },
    ],
  },
  {
    label: "계약서",
    items: [
      { key: "lease_contract", ...documentTypes.lease_contract },
      { key: "goods_contract", ...documentTypes.goods_contract },
      { key: "service_contract", ...documentTypes.service_contract },
      { key: "labor_contract_doc", ...documentTypes.labor_contract_doc },
      { key: "general_contract", ...documentTypes.general_contract },
    ],
  },
  {
    label: "내용증명",
    items: [
      { key: "content_certification", ...documentTypes.content_certification },
    ],
  },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서류 작성</h1>
          <p className="text-gray-600">AI가 전문적인 행정 서류, 계약서, 내용증명서를 작성해 드립니다</p>
        </div>
        <Link href="/documents/new">
          <Button>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 서류 작성
          </Button>
        </Link>
      </div>

      {/* Document Types - Grouped */}
      {quickLaunchGroups.map(group => (
        <div key={group.label} className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{group.label}</h2>
          <div className={`grid gap-3 ${group.items.length <= 2 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5"}`}>
            {group.items.map(item => (
              <Link key={item.key} href={`/documents/new?type=${item.key}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <span className="text-2xl sm:text-3xl mb-1.5 block">{item.icon}</span>
                    <span className="font-medium text-gray-900 text-xs sm:text-sm">{item.name}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Document List */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">작성 이력</h2>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mb-4">아직 작성한 서류가 없습니다</p>
              <Link href="/documents/new">
                <Button variant="outline">첫 서류 작성하기</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex items-center justify-between py-4 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {documentTypes[doc.type]?.icon || "📄"}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="text-sm text-gray-500">
                        {documentTypes[doc.type]?.name || doc.type}
                        {" · "}
                        {new Date(doc.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {doc.status === "completed" ? "완료" : "작성중"}
                    </span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
