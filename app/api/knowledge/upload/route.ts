/**
 * =============================================================================
 * Knowledge Upload API
 * =============================================================================
 * POST /api/knowledge/upload
 *
 * 관리자 전용 - 지식 문서 업로드 및 벡터화
 * 1. 파일 업로드 (multipart/form-data)
 * 2. 텍스트 추출
 * 3. 청킹 (의미 단위 분할)
 * 4. 임베딩 생성 및 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  extractTextFromFile,
  getFileType,
  validateFileSize,
  cleanExtractedText,
} from "@/lib/rag/documentProcessor";
import { chunkText, getChunkStats, validateChunks } from "@/lib/rag/chunker";
import { generateEmbeddings } from "@/lib/rag/embeddings";
import { saveChunkEmbeddings } from "@/lib/rag/vectorStore";

// 관리자 이메일 목록
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);

// 최대 파일 크기 (MB)
const MAX_FILE_SIZE_MB = 50;

export async function POST(req: NextRequest) {
  try {
    // 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    // FormData 파싱
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const category = formData.get("category") as string | null;
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 필요합니다." },
        { status: 400 }
      );
    }

    // 파일 타입 확인
    const fileType = getFileType(file.name);
    if (!fileType) {
      return NextResponse.json(
        { success: false, error: "지원하지 않는 파일 형식입니다. (PDF, HWP, DOCX, TXT 지원)" },
        { status: 400 }
      );
    }

    // 파일 크기 확인
    const sizeValidation = validateFileSize(file.size, MAX_FILE_SIZE_MB);
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { success: false, error: sizeValidation.error },
        { status: 400 }
      );
    }

    console.log(`[Knowledge Upload] Processing: ${file.name} (${fileType}, ${file.size} bytes)`);

    // 1. DB에 문서 레코드 생성 (pending 상태)
    const document = await prisma.knowledgeDocument.create({
      data: {
        fileName: file.name,
        fileType,
        fileSize: file.size,
        title: title || file.name.replace(/\.[^/.]+$/, ""), // 확장자 제거
        category,
        description,
        status: "processing",
        uploadedBy: session.user.email,
      },
    });

    try {
      // 2. 텍스트 추출
      const buffer = Buffer.from(await file.arrayBuffer());
      const extractResult = await extractTextFromFile(buffer, fileType, file.name);

      if (!extractResult.success || !extractResult.document) {
        await prisma.knowledgeDocument.update({
          where: { id: document.id },
          data: {
            status: "failed",
            errorMessage: extractResult.error || "텍스트 추출 실패",
          },
        });

        return NextResponse.json(
          { success: false, error: extractResult.error || "텍스트 추출 실패" },
          { status: 500 }
        );
      }

      const cleanedText = cleanExtractedText(extractResult.document.text);
      console.log(`[Knowledge Upload] Extracted ${cleanedText.length} characters`);

      // 3. 청킹
      const chunks = chunkText(cleanedText, {
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunkValidation = validateChunks(chunks);
      if (!chunkValidation.valid) {
        console.warn("[Knowledge Upload] Chunk validation issues:", chunkValidation.issues);
      }

      const chunkStats = getChunkStats(chunks);
      console.log(`[Knowledge Upload] Created ${chunks.length} chunks`);

      // 4. 청크 레코드 생성
      const createdChunks = await prisma.$transaction(
        chunks.map((chunk) =>
          prisma.knowledgeChunk.create({
            data: {
              documentId: document.id,
              content: chunk.content,
              chunkIndex: chunk.index,
              pageNumber: chunk.pageNumber,
              sectionTitle: chunk.sectionTitle,
              tokenCount: chunk.tokenCount,
            },
          })
        )
      );

      console.log(`[Knowledge Upload] Created ${createdChunks.length} chunk records`);

      // 5. 임베딩 생성 (배치 처리)
      const chunkContents = chunks.map((c) => c.content);

      try {
        const embeddings = await generateEmbeddings(chunkContents);
        console.log(`[Knowledge Upload] Generated ${embeddings.length} embeddings`);

        // 6. 임베딩 저장
        const chunkEmbeddings = createdChunks.map((chunk, i) => ({
          id: chunk.id,
          embedding: embeddings[i],
        }));

        await saveChunkEmbeddings(chunkEmbeddings);
        console.log(`[Knowledge Upload] Saved embeddings to vector store`);
      } catch (embeddingError) {
        console.error("[Knowledge Upload] Embedding error:", embeddingError);
        // 임베딩 실패해도 문서는 저장됨 (나중에 재시도 가능)
        await prisma.knowledgeDocument.update({
          where: { id: document.id },
          data: {
            status: "completed",
            totalChunks: chunks.length,
            totalTokens: chunkStats.estimatedTokens,
            errorMessage: "임베딩 생성 중 일부 오류 발생. 나중에 재처리 필요.",
          },
        });

        return NextResponse.json({
          success: true,
          warning: "임베딩 생성 중 오류가 발생했습니다. 검색 기능이 제한될 수 있습니다.",
          document: {
            id: document.id,
            fileName: document.fileName,
            totalChunks: chunks.length,
          },
        });
      }

      // 7. 문서 상태 업데이트 (완료)
      const updatedDocument = await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "completed",
          totalChunks: chunks.length,
          totalTokens: chunkStats.estimatedTokens,
        },
      });

      return NextResponse.json({
        success: true,
        document: {
          id: updatedDocument.id,
          fileName: updatedDocument.fileName,
          title: updatedDocument.title,
          category: updatedDocument.category,
          totalChunks: updatedDocument.totalChunks,
          totalTokens: updatedDocument.totalTokens,
          status: updatedDocument.status,
        },
        stats: chunkStats,
      });
    } catch (processingError) {
      // 처리 중 오류 발생 시 문서 상태 업데이트
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          status: "failed",
          errorMessage:
            processingError instanceof Error
              ? processingError.message
              : "처리 중 오류 발생",
        },
      });

      throw processingError;
    }
  } catch (error) {
    console.error("[Knowledge Upload] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/knowledge/upload
 * 업로드된 문서 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    // 문서 목록 조회
    const documents = await prisma.knowledgeDocument.findMany({
      where: {
        ...(category && { category }),
        ...(status && { status }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        title: true,
        category: true,
        description: true,
        status: true,
        totalChunks: true,
        totalTokens: true,
        errorMessage: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      documents,
      total: documents.length,
    });
  } catch (error) {
    console.error("[Knowledge List] Error:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류" },
      { status: 500 }
    );
  }
}
