/**
 * V-World Geocoder 응답 구조 디버깅
 */
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

async function main() {
  const VWORLD_KEY = process.env.VWORLD_KEY!;
  const address = "인천광역시 계양구 오조산로45번길 12";

  const geoUrl = "https://api.vworld.kr/req/address";
  const params = new URLSearchParams({
    service: "address",
    request: "getcoord",
    version: "2.0",
    crs: "epsg:4326",
    address: address,
    refine: "true",
    simple: "false",
    format: "json",
    type: "road",
    key: VWORLD_KEY,
  });

  console.log("=== V-World Geocoder 응답 분석 ===\n");

  const response = await fetch(`${geoUrl}?${params}`);
  const data = await response.json();

  console.log("전체 응답 구조:");
  console.log(JSON.stringify(data, null, 2));

  console.log("\n--- 주요 경로 ---");
  console.log("response.status:", data.response?.status);
  console.log("response.result:", JSON.stringify(data.response?.result));
  console.log("response.result.text:", data.response?.result?.text);
  console.log("response.result.point:", data.response?.result?.point);
  console.log("response.refined:", JSON.stringify(data.response?.refined));
  console.log("response.input:", JSON.stringify(data.response?.input));

  // 지번 주소로도 시도
  console.log("\n\n=== 지번 주소 테스트 ===\n");
  params.set("type", "parcel");
  params.set("address", "서울특별시 금천구 독산동 336-5");
  const response2 = await fetch(`${geoUrl}?${params}`);
  const data2 = await response2.json();
  console.log("전체 응답 구조:");
  console.log(JSON.stringify(data2, null, 2));
}

main().catch(console.error);
