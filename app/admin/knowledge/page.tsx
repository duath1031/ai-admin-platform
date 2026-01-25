"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// 문서 타입
interface KnowledgeDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  title: string | null;
  category: string | null;
  description: string | null;
  status: string;
  totalChunks: number;
  totalTokens: number | null;
  errorMessage: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

// 카테고리 옵션
const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "행정절차", label: "행정절차" },
  { value: "출입국", label: "출입국/비자" },
  { value: "인허가", label: "인허가/등록" },
  { value: "부동산", label: "부동산" },
  { value: "세무", label: "세무/회계" },
  { value: "정책자금", label: "정책자금" },
  { value: "기타", label: "기타" },
];

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  // 업로드 폼 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  // 필터
  const [filterCategory, setFilterCategory] = useState("");

  // 드래그 앤 드롭 상태
  const [isDragging, setIsDragging] = useState(false);

  // 문서 목록 조회
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);

      const res = await fetch(`/api/knowledge/upload?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDocuments();
    }
  }, [status, fetchDocuments]);

  // 파일 업로드
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress("파일 업로드 중...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title) formData.append("title", title);
      if (category) formData.append("category", category);
      if (description) formData.append("description", description);

      setUploadProgress("텍스트 추출 및 벡터화 중...");

      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setUploadProgress("업로드 완료!");
        // 폼 초기화
        setSelectedFile(null);
        setTitle("");
        setCategory("");
        setDescription("");
        // 목록 새로고침
        fetchDocuments();

        setTimeout(() => setUploadProgress(""), 2000);
      } else {
        setUploadProgress(`오류: ${data.error}`);
      }
    } catch (error) {
      setUploadProgress("업로드 실패");
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
      if (!title) {
        setTitle(files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      if (!title) {
        setTitle(files[0].name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // 문서 삭제
  const handleDelete = async (documentId: string) => {
    if (!confirm("이 문서를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/knowledge/${documentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 상태 배지
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      pending: { bg: "bg-yellow-100", text: "대기 중" },
      processing: { bg: "bg-blue-100", text: "처리 중" },
      completed: { bg: "bg-green-100", text: "완료" },
      failed: { bg: "bg-red-100", text: "실패" },
    };
    const badge = badges[status] || { bg: "bg-gray-100", text: status };
    return (
      <span className={`px-2 py-1 rounded text-xs ${badge.bg}`}>
        {badge.text}
      </span>
    );
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">지식 베이스 관리</h1>

      {/* 업로드 섹션 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">문서 업로드</h2>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <div className="text-lg font-medium">{selectedFile.name}</div>
              <div className="text-sm text-gray-500">
                {formatFileSize(selectedFile.size)}
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-red-500 text-sm hover:underline"
              >
                파일 제거
              </button>
            </div>
          ) : (
            <>
              <div className="text-gray-500 mb-2">
                파일을 드래그하거나 클릭하여 선택하세요
              </div>
              <div className="text-sm text-gray-400">
                지원 형식: PDF, HWP, DOCX, TXT (최대 50MB)
              </div>
              <input
                type="file"
                accept=".pdf,.hwp,.docx,.doc,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600"
              >
                파일 선택
              </label>
            </>
          )}
        </div>

        {/* 메타데이터 입력 */}
        {selectedFile && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="문서 제목"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">선택하세요</option>
                {CATEGORIES.slice(1).map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows={2}
                placeholder="문서에 대한 간단한 설명"
              />
            </div>
          </div>
        )}

        {/* 업로드 버튼 */}
        {selectedFile && (
          <div className="mt-4">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {uploading ? "처리 중..." : "업로드 및 벡터화"}
            </button>
            {uploadProgress && (
              <span className="ml-4 text-sm text-gray-600">{uploadProgress}</span>
            )}
          </div>
        )}
      </div>

      {/* 문서 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">업로드된 문서 ({documents.length})</h2>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1 border rounded"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  제목
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  카테고리
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  형식
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  크기
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  청크
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  업로드
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{doc.title || doc.fileName}</div>
                    {doc.description && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">
                        {doc.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {doc.category || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm uppercase">
                    {doc.fileType}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {doc.totalChunks}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(doc.status)}
                    {doc.errorMessage && (
                      <div className="text-xs text-red-500 mt-1">
                        {doc.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(doc.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-500 hover:underline text-sm"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    업로드된 문서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
