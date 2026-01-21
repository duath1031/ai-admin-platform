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

const documentTypes = {
  petition: { name: "진정서", icon: "📝" },
  appeal: { name: "탄원서", icon: "📋" },
  objection: { name: "이의신청서", icon: "📄" },
  application: { name: "신청서", icon: "📑" },
};

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
          <p className="text-gray-600">AI가 전문적인 행정 서류를 작성해 드립니다</p>
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

      {/* Document Types */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {Object.entries(documentTypes).map(([key, value]) => (
          <Link key={key} href={`/documents/new?type=${key}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <span className="text-3xl mb-2 block">{value.icon}</span>
                <span className="font-medium text-gray-900">{value.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Document List */}
      <Card>
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
                      {documentTypes[doc.type as keyof typeof documentTypes]?.icon || "📄"}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="text-sm text-gray-500">
                        {documentTypes[doc.type as keyof typeof documentTypes]?.name || doc.type}
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
