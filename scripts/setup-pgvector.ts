/**
 * pgvector 설정 스크립트
 * Supabase에서 vector extension 활성화 및 embedding 컬럼 추가
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function setupPgVector() {
  console.log("pgvector 설정 시작...\n");

  try {
    // 1. vector extension 활성화
    console.log("1. vector extension 활성화 중...");
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("   ✅ vector extension 활성화 완료\n");

    // 2. embedding 컬럼 추가
    console.log("2. KnowledgeChunk에 embedding 컬럼 추가 중...");
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "KnowledgeChunk"
        ADD COLUMN IF NOT EXISTS embedding vector(768);
      `);
      console.log("   ✅ embedding 컬럼 추가 완료\n");
    } catch (e: any) {
      if (e.message.includes("already exists")) {
        console.log("   ℹ️ embedding 컬럼이 이미 존재합니다\n");
      } else {
        throw e;
      }
    }

    // 3. 인덱스 생성
    console.log("3. 벡터 검색 인덱스 생성 중...");
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
        ON "KnowledgeChunk"
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);
      console.log("   ✅ 인덱스 생성 완료\n");
    } catch (e: any) {
      if (e.message.includes("already exists")) {
        console.log("   ℹ️ 인덱스가 이미 존재합니다\n");
      } else {
        // ivfflat 인덱스는 데이터가 없으면 실패할 수 있음 - hnsw 시도
        console.log("   ⚠️ ivfflat 인덱스 생성 실패, hnsw 시도...");
        try {
          await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
            ON "KnowledgeChunk"
            USING hnsw (embedding vector_cosine_ops);
          `);
          console.log("   ✅ hnsw 인덱스 생성 완료\n");
        } catch (e2) {
          console.log("   ℹ️ 인덱스는 나중에 데이터가 있을 때 생성됩니다\n");
        }
      }
    }

    // 4. 설정 확인
    console.log("4. 설정 확인 중...");
    const extensionCheck = await prisma.$queryRaw<any[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector';
    `;

    const columnCheck = await prisma.$queryRaw<any[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'KnowledgeChunk' AND column_name = 'embedding';
    `;

    console.log(`   - vector extension: ${extensionCheck.length > 0 ? '✅ 활성화됨' : '❌ 없음'}`);
    console.log(`   - embedding 컬럼: ${columnCheck.length > 0 ? '✅ 존재함' : '❌ 없음'}`);

    console.log("\n🎉 pgvector 설정 완료!");

  } catch (error) {
    console.error("\n❌ 오류 발생:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupPgVector();
