const fs = require('fs');
const envPath = require('path').resolve(__dirname, '../.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (t && !t.startsWith('#')) {
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.substring(0, eq).trim();
      let v = t.substring(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[k] = v;
    }
  }
}

import { searchLandUse, formatLandUseResult } from '../lib/landUseApi';
import { searchBuilding, formatBuildingResult } from '../lib/buildingApi';

async function main() {
  const address = "서울특별시 금천구 디지털로9길 32";
  console.log(`=== 테스트: "${address}" ===\n`);

  const [landResult, buildingResult] = await Promise.all([
    searchLandUse(address).catch((e: any) => ({ success: false as const, error: e.message })),
    searchBuilding(address).catch((e: any) => ({ success: false as const, error: e.message })),
  ]);

  console.log("--- 토지이용계획 ---");
  if (landResult.success) {
    console.log(formatLandUseResult(landResult as any));
  } else {
    console.log("실패:", landResult.error);
  }

  console.log("\n--- 건축물대장 ---");
  if (buildingResult.success) {
    console.log(formatBuildingResult(buildingResult as any));
  } else {
    console.log("실패:", buildingResult.error);
  }
}
main().catch(console.error);
