/**
 * =============================================================================
 * RPA Worker RAG Client
 * =============================================================================
 * RPA Worker의 RAG API를 호출하는 클라이언트
 * 대용량 문서 업로드 및 처리를 위한 프록시 역할
 */

const WORKER_URL = process.env.RPA_WORKER_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.WORKER_API_KEY || '';

interface UploadResponse {
  success: boolean;
  documentId?: string;
  message?: string;
  statusUrl?: string;
  error?: string;
}

interface StatusResponse {
  success: boolean;
  documentId?: string;
  status?: string;
  progress?: number;
  document?: {
    title: string;
    category: string;
    totalChunks: number;
    status: string;
    createdAt: string;
  };
  taskInfo?: {
    startTime: number;
    updatedAt: number;
    totalChunks?: number;
    error?: string;
  };
  error?: string;
}

interface SearchResult {
  content: string;
  documentTitle: string;
  documentId: string;
  category: string;
  chunkIndex: number;
  pageNumber?: number;
  sectionTitle?: string;
  similarity: string;
}

interface SearchResponse {
  success: boolean;
  query?: string;
  resultCount?: number;
  results?: SearchResult[];
  error?: string;
}

/**
 * 대용량 문서 업로드 (RPA Worker로 전송)
 * @param file - File 객체
 * @param title - 문서 제목
 * @param category - 카테고리
 * @returns 업로드 결과
 */
export async function uploadLargeDocument(
  file: File,
  title: string,
  category: string = 'general'
): Promise<UploadResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('category', category);

    const response = await fetch(`${WORKER_URL}/rag/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': WORKER_API_KEY,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[WorkerClient] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 문서 처리 상태 조회
 * @param documentId - 문서 ID
 * @returns 상태 정보
 */
export async function getDocumentStatus(documentId: string): Promise<StatusResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/rag/status/${documentId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': WORKER_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[WorkerClient] Status check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 벡터 검색 수행
 * @param query - 검색 쿼리
 * @param options - 검색 옵션
 * @returns 검색 결과
 */
export async function searchKnowledge(
  query: string,
  options: {
    category?: string;
    limit?: number;
    threshold?: number;
  } = {}
): Promise<SearchResponse> {
  try {
    const response = await fetch(`${WORKER_URL}/rag/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': WORKER_API_KEY,
      },
      body: JSON.stringify({
        query,
        ...options,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[WorkerClient] Search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gemini File API로 대용량 문서 업로드 (Long Context 방식)
 * - 임베딩/청킹 없이 즉시 완료
 * - RPA Worker의 /rag/upload-gemini 엔드포인트 사용
 */
export async function uploadViaGeminiFileApi(
  file: File,
  title: string,
  category: string = 'general'
): Promise<{
  success: boolean;
  fileUri?: string;
  mimeType?: string;
  fileName?: string;
  displayName?: string;
  expiresAt?: string;
  processingTime?: number;
  error?: string;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('category', category);

    console.log(`[WorkerClient] Uploading to Gemini File API: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    const response = await fetch(`${WORKER_URL}/rag/upload-gemini`, {
      method: 'POST',
      headers: {
        'X-API-Key': WORKER_API_KEY,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[WorkerClient] Gemini upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * RAG 서비스 헬스체크
 * @returns 서비스 상태
 */
export async function checkRagHealth(): Promise<{
  success: boolean;
  status?: string;
  database?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${WORKER_URL}/rag/health`, {
      method: 'GET',
      headers: {
        'X-API-Key': WORKER_API_KEY,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 상태 폴링 유틸리티
 * 문서 처리가 완료될 때까지 상태를 주기적으로 확인
 * @param documentId - 문서 ID
 * @param onProgress - 진행 콜백
 * @param interval - 폴링 간격 (ms)
 * @param timeout - 타임아웃 (ms)
 */
export async function pollUntilComplete(
  documentId: string,
  onProgress?: (status: StatusResponse) => void,
  interval: number = 3000,
  timeout: number = 600000 // 10분
): Promise<StatusResponse> {
  const startTime = Date.now();

  while (true) {
    const status = await getDocumentStatus(documentId);

    if (onProgress) {
      onProgress(status);
    }

    // 완료 또는 실패 시 종료
    if (status.status === 'ready' || status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed' || status.error) {
      return {
        ...status,
        success: false,
      };
    }

    // 타임아웃 체크
    if (Date.now() - startTime > timeout) {
      return {
        success: false,
        documentId,
        status: 'timeout',
        error: '처리 시간이 초과되었습니다.',
      };
    }

    // 대기
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
