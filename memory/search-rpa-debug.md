# 검색 기반 RPA 디버그 기록 (2026-02-10)

## 문제 타임라인

### v15~v16: CappBizCD=rpa_jpg 버그
- serviceUrl에 CappBizCD 없을 때 serviceCode("rpa_jpg")를 CappBizCD로 사용
- 수정: `cappBizCD = cappBizCDMatch ? cappBizCDMatch[1] : null`

### v17: 검색 기반 RPA 첫 시도
- searchAndNavigateToService() 추가
- `gov.kr/search?srhWrd=...` URL로 직접 이동 → 검색 결과 파싱
- **결과**: Worker가 메인 페이지에 갇힘

### v18: 검색 함수 v4 전면 재작성
- 3가지 링크 탐색 전략, 12개+ 탭 셀렉터, 상세 디버그 로깅
- 메인 페이지 리디렉트 감지 + 검색창 입력 폴백
- **결과**: "동일한 에러와 사진" - 여전히 실패

### v19: 근본 원인 발견 및 수정
- **근본 원인**: `gov.kr/search?srhWrd=...` → `plus.gov.kr` 대기열 시스템 → 정부24 메인 페이지로 리디렉트
- test-url로 확인: finalUrl이 `https://plus.gov.kr/`로 변경됨
- `AA020InfoCappList.do`도 비로그인 시 `plus.gov.kr/login`으로 리디렉트
- **수정**: 메인 페이지(`gov.kr`) → `input#mainSearch` 검색창 직접 입력 → 검색 버튼 클릭
- **테스트 못함** (사용자 퇴근)

## 정부24 검색 관련 확인된 사실

### 메인 페이지 (gov.kr) 구조
- `input#mainSearch` (type="search") - 검색 입력창 존재 확인
- `button:has-text("검색")` - 검색 버튼 존재 확인
- `button:has-text("통합검색")` - 통합검색 버튼 존재 확인
- `button:has-text("민원서비스")` - 메뉴 버튼 존재 확인

### URL 접근성 (비로그인 Worker test-url 기준)
- `gov.kr` → 메인 페이지 정상 로드 (plus.gov.kr 경유)
- `gov.kr/search?srhWrd=...` → plus.gov.kr 대기열 → 메인 페이지로 돌아감 ❌
- `gov.kr/mw/AA020InfoCappList.do` → plus.gov.kr/login 리디렉트 ❌
- `gov.kr/mw/AA020InfoCappView.do?CappBizCD=...` → 테스트 안 함 (인증 필요할 수 있음)

### 인증 상태에서의 차이 (추정, 미확인)
- 인증 쿠키 있으면 AA020InfoCappList.do 접근 가능할 것
- 검색 결과 페이지도 인증 상태에서는 다를 수 있음
- **내일 인증 후 실제 테스트 필요**

## searchAndNavigateToService v19 로직
```
1. gov.kr 메인 페이지 이동 (이미 gov.kr이면 스킵)
2. input#mainSearch 찾기 → serviceName 입력 → 검색 버튼 클릭
   (못 찾으면 Step 5로 점프)
3. [검색 성공 시] 민원 탭 클릭 시도 (12개 셀렉터)
4. [검색 성공 시] 검색 결과에서 서비스 링크 탐색 (3가지 전략)
   - Strategy 1: CappBizCD/InfoCapp/AA020 링크
   - Strategy 2: 검색 결과 리스트 영역 내 링크
   - Strategy 3: 전체 gov.kr 링크에서 텍스트 매칭
5. Fallback: AA020InfoCappList.do?SearchText=... 민원 목록 검색
6. 최종 실패
```

## 내일 테스트 체크리스트
- [ ] v19 채팅에서 통신판매업 선택 → 인증 → 제출
- [ ] 프론트엔드 에러 메시지 + 스크린샷 확인
- [ ] Railway 로그에서 [Step 1], [Step 2] 등 단계별 로그 확인
- [ ] 검색 결과 페이지 도달 여부 확인
- [ ] 민원 링크 발견 여부 확인
- [ ] 실패 시: Worker에 /gov24/test-search 전용 엔드포인트 추가 고려
