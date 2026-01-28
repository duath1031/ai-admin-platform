"use client";

import { useState } from "react";

interface SetupResult {
  success: boolean;
  results?: string[];
  finalStatus?: {
    ready: boolean;
    extension: boolean;
    embeddingColumn: boolean;
    documentsCount: number;
    chunksWithEmbedding: number;
  };
  message?: string;
  error?: string;
}

export default function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);

  // 상태 확인
  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/setup-rag");
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: "요청 실패" });
    } finally {
      setChecking(false);
    }
  };

  // 자동 설정 실행
  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup-rag", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: "요청 실패" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">🔧 RAG 시스템 설정</h1>
      <p className="text-gray-600 mb-6">
        지식베이스 검색 시스템의 데이터베이스 설정을 자동으로 확인하고 구성합니다.
      </p>

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleCheck}
          disabled={checking || loading}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 font-medium"
        >
          {checking ? "확인 중..." : "📋 상태 확인"}
        </button>
        <button
          onClick={handleSetup}
          disabled={checking || loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? "설정 중..." : "🚀 자동 설정 실행"}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          {/* 상태 표시 */}
          {result.finalStatus && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">시스템 상태</h2>
              <div className="grid grid-cols-2 gap-4">
                <StatusItem
                  label="전체 상태"
                  value={result.finalStatus.ready ? "준비 완료" : "설정 필요"}
                  ok={result.finalStatus.ready}
                />
                <StatusItem
                  label="pgvector Extension"
                  value={result.finalStatus.extension ? "설치됨" : "미설치"}
                  ok={result.finalStatus.extension}
                />
                <StatusItem
                  label="Embedding 컬럼"
                  value={result.finalStatus.embeddingColumn ? "존재함" : "없음"}
                  ok={result.finalStatus.embeddingColumn}
                />
                <StatusItem
                  label="문서 수"
                  value={`${result.finalStatus.documentsCount}개`}
                  ok={result.finalStatus.documentsCount > 0}
                />
                <StatusItem
                  label="임베딩된 청크"
                  value={`${result.finalStatus.chunksWithEmbedding}개`}
                  ok={result.finalStatus.chunksWithEmbedding > 0}
                />
              </div>
            </div>
          )}

          {/* 메시지 */}
          {result.message && (
            <div className={`p-4 rounded-lg mb-4 ${
              result.finalStatus?.ready
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-yellow-50 text-yellow-800 border border-yellow-200"
            }`}>
              {result.message}
            </div>
          )}

          {/* 실행 결과 */}
          {result.results && result.results.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">실행 로그</h2>
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                {result.results.map((line, idx) => (
                  <div key={idx} className="py-1">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 에러 */}
          {result.error && (
            <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg">
              ❌ 오류: {result.error}
            </div>
          )}
        </div>
      )}

      {/* 도움말 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <h3 className="font-semibold mb-2">💡 도움말</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>상태 확인</strong>: 현재 데이터베이스 설정 상태를 확인합니다.</li>
          <li><strong>자동 설정</strong>: pgvector extension과 embedding 컬럼을 자동으로 생성합니다.</li>
          <li>임베딩된 청크가 0개면 지식베이스 페이지에서 문서를 다시 업로드해주세요.</li>
          <li>문서 업로드 후에도 청크가 0이면 RPA Worker 로그를 확인해주세요.</li>
        </ul>
      </div>
    </div>
  );
}

function StatusItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${ok ? "text-green-600" : "text-red-600"}`}>
        {ok ? "✅" : "❌"} {value}
      </span>
    </div>
  );
}
