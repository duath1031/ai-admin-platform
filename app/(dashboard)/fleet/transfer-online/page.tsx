"use client";

export default function TransferOnlinePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">이전등록 대행 접수</h1>
        <p className="text-sm text-gray-500 mt-1">
          자동차 명의이전(이전등록)을 전문 행정사가 대행합니다.
        </p>
      </div>

      {/* 서비스 안내 카드 */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold">행정사합동사무소 정의</h2>
            <p className="text-sm text-blue-200">자동차 이전등록 전문 대행</p>
          </div>
        </div>
        <p className="text-sm text-blue-100 leading-relaxed">
          전문 행정사가 관할 차량등록사업소(구청)에 직접 방문하여 이전등록을 대행합니다.
          아래 필요서류를 준비하시고 전화로 접수해 주세요.
        </p>
      </div>

      {/* 대행비 안내 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          대행 비용
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs text-blue-600 font-semibold">온라인 이전등록 대행</p>
            <p className="text-lg font-bold text-gray-900 mt-1">16,500원 <span className="text-xs font-normal text-gray-500">(VAT 포함)</span></p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <p className="text-xs text-purple-600 font-semibold">행정사 방문 대행</p>
            <p className="text-lg font-bold text-gray-900 mt-1">50,000원~ <span className="text-xs font-normal text-gray-500">(협의)</span></p>
            <p className="text-xs text-gray-500 mt-0.5">차종, 지역에 따라 비용 상이</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">* 취등록세는 별도이며, 차량 매매금액에 따라 자동 산출됩니다.</p>
      </div>

      {/* 필요서류 안내 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          필요서류 안내
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 매도인 서류 */}
          <div className="bg-red-50 rounded-xl p-5 border border-red-100">
            <h4 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              매도인 (양도인)
            </h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">자동차등록증 원본</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">매매용 인감증명서</p>
                  <p className="text-xs text-gray-500">매수인 인적사항 기재 필수</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">현재 운행 키로수</p>
                  <p className="text-xs text-gray-500">주행거리 전달 (사진 또는 구두)</p>
                </div>
              </li>
            </ul>
          </div>

          {/* 매수인 서류 */}
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
            <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              매수인 (양수인)
            </h4>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">신분증 사본</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">자동차보험 가입</p>
                  <p className="text-xs text-gray-500">이전등록 전 반드시 가입 필수</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 주의사항 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-amber-800">주의사항</h4>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-700">
              <li>- 차량에 <strong>저당(근저당)</strong>이 설정되어 있는 경우 이전이 어려울 수 있습니다.</li>
              <li>- <strong>법인 차량</strong>의 경우 별도 상담이 필요합니다.</li>
              <li>- 지게차(건설기계), 수출말소 차량, 영업용 차량(노란색 번호판)은 이전등록 불가합니다.</li>
              <li>- 서류는 <strong>등기 발송</strong> 또는 <strong>방문 전달</strong>로 보내주셔야 합니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 전화 접수 CTA */}
      <div className="bg-white rounded-2xl border-2 border-blue-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">전화로 바로 접수하세요</h3>
        <p className="text-sm text-gray-500 mb-5">
          필요서류를 준비하신 후 아래 번호로 전화해 주시면<br />
          담당 행정사가 친절히 안내해 드립니다.
        </p>
        <a
          href="tel:070-8657-1888"
          className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
          070-8657-1888
        </a>
        <p className="text-xs text-gray-400 mt-3">
          행정사합동사무소 정의 | 평일 09:00~18:00
        </p>
      </div>

      {/* 취등록세 계산기 링크 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">취등록세가 얼마인지 궁금하신가요?</h4>
            <p className="text-xs text-gray-500 mt-0.5">차량 매매금액으로 취등록세를 미리 계산해 볼 수 있습니다.</p>
          </div>
          <a
            href="/fleet/transfer-documents"
            className="px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex-shrink-0 ml-4"
          >
            서류 생성 / 비용 계산
          </a>
        </div>
      </div>
    </div>
  );
}
