"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui";
import Link from "next/link";

interface Payment {
  id: string;
  orderId: string;
  itemName: string;
  itemType: string;
  amount: number;
  status: string;
  method: string | null;
  receiptUrl: string | null;
  requestedAt: string;
  approvedAt: string | null;
  cancelledAt: string | null;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  READY: { label: "대기", className: "bg-yellow-100 text-yellow-800" },
  PAID: { label: "완료", className: "bg-green-100 text-green-800" },
  CANCELLED: { label: "취소", className: "bg-red-100 text-red-800" },
  pending: { label: "대기", className: "bg-yellow-100 text-yellow-800" },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  useEffect(() => {
    fetchPayments();
  }, [pagination.page]);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/user/payments?page=${pagination.page}&limit=20`);
      const data = await res.json();

      if (data.success) {
        setPayments(data.payments || []);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("결제 내역 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const info = STATUS_MAP[status] || { label: status, className: "bg-gray-100 text-gray-600" };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.className}`}>
        {info.label}
      </span>
    );
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("ko-KR") + "원";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/mypage" className="hover:text-primary-600">마이페이지</Link>
          <span>/</span>
          <span>결제 내역</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">결제 내역</h1>
        <p className="text-gray-500 mt-1">
          결제 및 구매 내역을 확인할 수 있습니다. 총 {pagination.total}건
        </p>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 결제 내역 */}
      {!isLoading && payments.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-lg font-medium text-gray-500">결제 내역이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">서비스를 이용하면 결제 내역이 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && payments.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제수단</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">영수증</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {payment.orderId.length > 20
                        ? payment.orderId.slice(0, 20) + "..."
                        : payment.orderId}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {payment.itemName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {formatAmount(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {payment.method || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(payment.approvedAt || payment.requestedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {payment.receiptUrl ? (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          보기
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                총 {pagination.total}건 중{" "}
                {(pagination.page - 1) * 20 + 1}-{Math.min(pagination.page * 20, pagination.total)}건
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
