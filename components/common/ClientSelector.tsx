"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useClientStore, ClientCompanyData } from "@/lib/store";

interface ClientListItem {
  id: string;
  companyName: string;
  ownerName?: string | null;
  bizRegNo?: string | null;
}

export default function ClientSelector() {
  const { selectedClient, setSelectedClient } = useClientStore();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch client list on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/labor/client-companies");
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setClients(
            json.data.map((c: ClientListItem) => ({
              id: c.id,
              companyName: c.companyName,
              ownerName: c.ownerName,
              bizRegNo: c.bizRegNo,
            }))
          );
        }
      } catch {
        // silent
      }
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  // Select a client: fetch full detail then set to store
  const handleSelect = useCallback(
    async (clientId: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/labor/client-companies/${clientId}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (json.success && json.data) {
          setSelectedClient(json.data as ClientCompanyData);
        }
      } catch {
        // If detail fetch fails, use list-level data as fallback
        const fallback = clients.find((c) => c.id === clientId);
        if (fallback) {
          setSelectedClient({
            id: fallback.id,
            companyName: fallback.companyName,
            ownerName: fallback.ownerName,
            bizRegNo: fallback.bizRegNo,
          });
        }
      } finally {
        setLoading(false);
        setOpen(false);
        setSearch("");
      }
    },
    [clients, setSelectedClient]
  );

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedClient(null);
    setOpen(false);
    setSearch("");
  }, [setSelectedClient]);

  // Filter clients by search
  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.companyName.toLowerCase().includes(q) ||
      (c.ownerName && c.ownerName.toLowerCase().includes(q)) ||
      (c.bizRegNo && c.bizRegNo.includes(q))
    );
  });

  // Format biz reg number for display
  const fmtBizNo = (v?: string | null) => {
    if (!v) return "";
    const d = v.replace(/\D/g, "");
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
    return v;
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`
          inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium
          transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40
          ${
            selectedClient
              ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          }
        `}
      >
        {selectedClient ? (
          <>
            {/* User-group icon */}
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0a4 4 0 117.74 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="max-w-[120px] truncate sm:max-w-[180px]">{selectedClient.companyName}</span>
            <span className="ml-0.5 rounded bg-blue-200 px-1 py-0.5 text-[10px] font-semibold leading-none text-blue-800">
              거래처
            </span>
          </>
        ) : (
          <>
            {/* Building icon */}
            <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="hidden sm:inline">내 기업 정보 사용 중</span>
            <span className="sm:hidden">내 기업</span>
          </>
        )}
        {/* Chevron */}
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-72 origin-top-right rounded-xl border border-gray-200 bg-white shadow-lg sm:w-80">
          {/* Search */}
          <div className="border-b border-gray-100 p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="거래처 검색..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {/* Default: my company */}
            <li>
              <button
                type="button"
                onClick={handleClear}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                  !selectedClient ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}
              >
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div>
                  <div className="font-medium">내 기업 정보 (기본)</div>
                  <div className="text-xs text-gray-400">거래처 선택 해제</div>
                </div>
                {!selectedClient && (
                  <svg className="ml-auto h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </li>

            {/* Divider */}
            {clients.length > 0 && <li className="mx-2 my-1 border-t border-gray-100" />}

            {/* Client items */}
            {filtered.length === 0 && clients.length > 0 && (
              <li className="px-3 py-3 text-center text-xs text-gray-400">
                검색 결과가 없습니다.
              </li>
            )}
            {clients.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-gray-400">
                등록된 거래처가 없습니다.
              </li>
            )}
            {filtered.map((c) => {
              const isSelected = selectedClient?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c.id)}
                    disabled={loading}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 disabled:opacity-50 ${
                      isSelected ? "bg-blue-50 text-blue-700" : "text-gray-700"
                    }`}
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {c.companyName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.companyName}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        {c.ownerName && <span>{c.ownerName}</span>}
                        {c.ownerName && c.bizRegNo && <span>|</span>}
                        {c.bizRegNo && <span>{fmtBizNo(c.bizRegNo)}</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <svg className="ml-auto h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer hint */}
          {clients.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5 text-center text-[11px] text-gray-400">
              거래처 관리에서 추가/수정할 수 있습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
