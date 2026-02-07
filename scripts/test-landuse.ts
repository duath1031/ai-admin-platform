/**
 * 토지이용계획 + 건축물대장 API 테스트 스크립트
 * Progressive buffer + PNU fallback 검증
 */

// .env.local에서 환경변수 로드
const fs = require('fs');
const envPath = require('path').resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { searchLandUse, formatLandUseResult } from '../lib/landUseApi';
import { searchBuilding, formatBuildingResult } from '../lib/buildingApi';

const testAddresses = [
  "서울특별시 금천구 독산동 336-5",       // 지번 (준공업지역)
  "인천광역시 계양구 오조산로45번길 12",    // 도로명 (기존 실패 케이스)
  "오조산로45번길 12",                     // 도로명 (시/도 생략)
  "독산동 336-5",                         // 지번 (시/도 생략)
  "용종로 123",                           // 불규칙 주소
];

async function main() {
  console.log("=== 토지이용계획 + 건축물대장 API 테스트 ===\n");
  console.log(`VWORLD_KEY: ${process.env.VWORLD_KEY ? '설정됨' : '❌ 미설정'}`);
  console.log(`VWORLD_DOMAIN: ${process.env.VWORLD_DOMAIN || 'localhost'}`);
  console.log(`PUBLIC_DATA_KEY: ${process.env.PUBLIC_DATA_KEY ? '설정됨' : '❌ 미설정'}\n`);

  for (const address of testAddresses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 테스트: "${address}"`);
    console.log('='.repeat(60));

    // 1. 토지이용계획 조회
    console.log("\n--- 토지이용계획 ---");
    try {
      const landResult = await searchLandUse(address);
      if (landResult.success) {
        console.log(`✅ 성공!`);
        console.log(`  주소: ${landResult.address}`);
        console.log(`  좌표: (${landResult.coordinates?.x}, ${landResult.coordinates?.y})`);
        console.log(`  PNU: ${landResult.pnu || '없음'}`);
        console.log(`  용도지역: ${landResult.zoneInfo?.map(z => z.name).join(', ')}`);
      } else {
        console.log(`❌ 실패: ${landResult.error}`);
        console.log(`  PNU: ${landResult.pnu || '없음'}`);
        if (landResult.address) console.log(`  주소: ${landResult.address}`);
      }
    } catch (e: any) {
      console.log(`💥 예외: ${e.message}`);
    }

    // 2. 건축물대장 조회
    console.log("\n--- 건축물대장 ---");
    try {
      const buildingResult = await searchBuilding(address);
      if (buildingResult.success) {
        console.log(`✅ 성공!`);
        console.log(`  주소: ${buildingResult.address}`);
        console.log(`  주용도: ${buildingResult.mainPurpose}`);
        console.log(`  구조: ${buildingResult.structure}`);
      } else {
        console.log(`❌ 실패: ${buildingResult.error}`);
      }
    } catch (e: any) {
      console.log(`💥 예외: ${e.message}`);
    }
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log("=== 테스트 완료 ===");
}

main().catch(console.error);
