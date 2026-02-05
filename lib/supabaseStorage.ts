/**
 * Supabase Storage 클라이언트 - 지식베이스 영구저장소
 *
 * 업로드된 문서를 Supabase Storage에 영구 보관하여
 * Gemini File API 48시간 만료 후 자동 재업로드 지원
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET_NAME = "knowledge";

/**
 * 파일명을 Supabase Storage 호환 형식으로 변환
 * - 한글, 공백, 특수문자 → UUID + 확장자
 */
function sanitizeFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  // UUID 기반 안전한 파일명 생성
  return `${randomUUID()}.${ext}`;
}

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_KEY가 설정되지 않았습니다.");
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

/**
 * 파일을 Supabase Storage에 업로드
 * @returns storagePath (예: "knowledge/abc123/파일명.pdf")
 */
export async function saveToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ storagePath: string; storageProvider: string }> {
  const supabase = getClient();
  const uuid = randomUUID();
  // 한글/공백 파일명 → 안전한 UUID 기반 파일명으로 변환
  const safeFileName = sanitizeFileName(fileName);
  const storagePath = `${uuid}/${safeFileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Storage 업로드 실패: ${error.message}`);
  }

  console.log(`[Storage] Supabase 저장 완료: ${BUCKET_NAME}/${storagePath}`);
  return { storagePath: `${BUCKET_NAME}/${storagePath}`, storageProvider: "supabase" };
}

/**
 * Supabase Storage에서 파일 다운로드
 */
export async function readFromSupabase(storagePath: string): Promise<Buffer> {
  const supabase = getClient();

  // "knowledge/uuid/filename" → bucket="knowledge", path="uuid/filename"
  const pathParts = storagePath.split("/");
  const bucket = pathParts[0];
  const filePath = pathParts.slice(1).join("/");

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);

  if (error || !data) {
    throw new Error(`Supabase Storage 다운로드 실패: ${error?.message || "데이터 없음"}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

// ============= Templates Bucket =============
const TEMPLATES_BUCKET = "templates";

/**
 * 템플릿 파일을 Supabase Storage에 업로드
 */
export async function saveTemplateToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ storagePath: string; storageProvider: string }> {
  const supabase = getClient();
  const uuid = randomUUID();
  // 한글/공백 파일명 → 안전한 UUID 기반 파일명으로 변환
  const safeFileName = sanitizeFileName(fileName);
  const storagePath = `${uuid}/${safeFileName}`;

  const { error } = await supabase.storage
    .from(TEMPLATES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`템플릿 Storage 업로드 실패: ${error.message}`);
  }

  console.log(`[Storage] 템플릿 저장 완료: ${TEMPLATES_BUCKET}/${storagePath}`);
  return { storagePath: `${TEMPLATES_BUCKET}/${storagePath}`, storageProvider: "supabase" };
}

/**
 * Supabase Storage에서 템플릿 파일 다운로드
 */
export async function readTemplateFromSupabase(storagePath: string): Promise<Buffer> {
  return readFromSupabase(storagePath);
}
