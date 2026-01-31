/**
 * Vercel Cron: 지식베이스 Gemini 캐시 자동 갱신
 *
 * 6시간마다 실행되어 12시간 이내 만료 예정인 문서를 선제적으로 갱신.
 * RPA Worker의 /rag/renew-gemini 엔드포인트를 호출하여
 * Supabase 영구저장소 → Gemini File API 재업로드.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const RPA_WORKER_URL = process.env.RPA_WORKER_URL || process.env.NEXT_PUBLIC_RPA_URL || 'https://admini-rpa-worker-production.up.railway.app';
const WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || process.env.WORKER_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET(req: NextRequest) {
  try {
    // Vercel Cron 보안: Authorization 헤더 검증
    if (CRON_SECRET) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[Cron] 지식베이스 갱신 시작...');

    // 12시간 이내 만료 예정이거나 이미 만료된 문서 조회
    const renewalWindow = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const expiringDocs = await prisma.knowledgeDocument.findMany({
      where: {
        status: "completed",
        processingMode: "gemini_file",
        storagePath: { not: null },
        OR: [
          { geminiExpiresAt: { lt: renewalWindow } },
          { geminiExpiresAt: null },
        ],
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        storagePath: true,
        geminiExpiresAt: true,
      },
    });

    console.log(`[Cron] 갱신 대상: ${expiringDocs.length}개 문서`);

    if (expiringDocs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "갱신 대상 문서 없음",
        renewed: 0,
        failed: 0,
      });
    }

    let renewed = 0;
    let failed = 0;
    const results: Array<{ id: string; title: string; success: boolean; error?: string }> = [];

    for (const doc of expiringDocs) {
      try {
        console.log(`[Cron] 갱신 중: ${doc.title || doc.fileName}`);

        const response = await fetch(`${RPA_WORKER_URL}/rag/renew-gemini`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': WORKER_API_KEY,
          },
          body: JSON.stringify({
            storagePath: doc.storagePath,
            originalName: doc.fileName,
            title: doc.title || doc.fileName,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => 'unknown');
          throw new Error(`RPA Worker ${response.status}: ${errText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || '갱신 실패');
        }

        // DB 업데이트
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: {
            geminiFileUri: data.fileUri,
            geminiMimeType: data.mimeType,
            geminiFileName: data.fileName,
            geminiExpiresAt: new Date(data.expiresAt),
            status: "completed",
          },
        });

        renewed++;
        results.push({ id: doc.id, title: doc.title || doc.fileName, success: true });
        console.log(`[Cron] 갱신 완료: ${doc.title} (만료: ${data.expiresAt})`);
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({ id: doc.id, title: doc.title || doc.fileName, success: false, error: errMsg });
        console.error(`[Cron] 갱신 실패: ${doc.title} - ${errMsg}`);
      }
    }

    console.log(`[Cron] 갱신 완료: ${renewed}/${expiringDocs.length} 성공, ${failed} 실패`);

    return NextResponse.json({
      success: true,
      message: `${renewed}/${expiringDocs.length}개 갱신 완료`,
      renewed,
      failed,
      results,
    });
  } catch (error) {
    console.error('[Cron] 갱신 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    );
  }
}
