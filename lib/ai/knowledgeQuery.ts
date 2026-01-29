/**
 * Knowledge Base Query Functions
 * - 채팅 API에서 사용하는 함수만 분리
 * - @google/generative-ai/server import 없이 동작
 */

import { prisma } from "@/lib/prisma";

/**
 * 활성 문서 목록 조회 (Simple Version)
 */
export async function getActiveKnowledgeDocuments(category?: string): Promise<Array<{
  id: string;
  title: string;
  category: string | null;
  fileUri: string;
  mimeType: string;
  expiresAt: Date | null;
}>> {
  const where: Record<string, unknown> = {
    status: "completed",
    processingMode: "gemini_file",
  };

  if (category) {
    where.category = category;
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where,
    select: {
      id: true,
      title: true,
      category: true,
      fileName: true,
      geminiFileUri: true,
      geminiMimeType: true,
      geminiExpiresAt: true,
    },
  });

  const activeDocuments: Array<{
    id: string;
    title: string;
    category: string | null;
    fileUri: string;
    mimeType: string;
    expiresAt: Date | null;
  }> = [];

  for (const doc of documents) {
    if (!doc.geminiFileUri || !doc.geminiMimeType) {
      continue;
    }

    activeDocuments.push({
      id: doc.id,
      title: doc.title || "제목 없음",
      category: doc.category,
      fileUri: doc.geminiFileUri,
      mimeType: doc.geminiMimeType,
      expiresAt: doc.geminiExpiresAt,
    });
  }

  return activeDocuments;
}

/**
 * 채팅 컨텍스트에 지식베이스 문서 추가
 */
export async function getKnowledgeContext(
  category?: string,
  maxDocuments: number = 3
): Promise<{
  fileParts: Array<{ fileData: { fileUri: string; mimeType: string } }>;
  documentTitles: string[];
}> {
  const documents = await getActiveKnowledgeDocuments(category);
  const selectedDocs = documents.slice(0, maxDocuments);

  return {
    fileParts: selectedDocs.map(doc => ({
      fileData: {
        fileUri: doc.fileUri,
        mimeType: doc.mimeType,
      },
    })),
    documentTitles: selectedDocs.map(doc => doc.title),
  };
}
