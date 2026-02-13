'use client';

// =============================================================================
// Settings Page
// 설정 페이지
// =============================================================================

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  credits: number;
  plan: string;
  createdAt: string;
  connectedProviders: string[];
  _count: {
    documents: number;
    chats: number;
    civilServiceSubmissions: number;
    powersOfAttorney: number;
  };
}

const PLAN_LABELS: Record<string, { name: string; price: string }> = {
  none: { name: '미가입', price: '-' },
  starter: { name: 'Starter', price: '무료' },
  standard: { name: 'Standard', price: '90,000원/월' },
  basic: { name: '일반 (Basic)', price: '90,000원/월' },
  pro: { name: 'Pro', price: '150,000원/월' },
  pro_plus: { name: 'Pro Plus', price: '250,000원/월' },
};

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  kakao: '카카오',
  naver: '네이버',
};

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();

      if (data.success) {
        setProfile(data.data);
        setName(data.data.name || '');
        setPhone(data.data.phone || '');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('프로필을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: phone || null }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('프로필이 저장되었습니다');
        setProfile(prev => prev ? { ...prev, name, phone } : null);
        await updateSession({ name });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('프로필 저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('삭제 확인을 위해 DELETE를 입력해주세요');
      return;
    }

    try {
      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: 'DELETE',
          reason: deleteReason,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await signOut({ callbackUrl: '/' });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('계정 삭제 중 오류가 발생했습니다');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const planInfo = PLAN_LABELS[profile?.plan || 'none'];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">프로필 정보</h2>

          <div className="flex items-center gap-6 mb-6">
            {profile?.image ? (
              <img
                src={profile.image}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div>
              <p className="font-medium">{profile?.name || '이름 없음'}</p>
              <p className="text-gray-500">{profile?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '프로필 저장'}
            </button>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">구독 정보</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">현재 플랜</p>
              <p className="text-lg font-semibold">{planInfo.name}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">월 요금</p>
              <p className="text-lg font-semibold">{planInfo.price}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">보유 크레딧</p>
              <p className="text-lg font-semibold text-blue-600">{profile?.credits || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">가입일</p>
              <p className="text-sm font-medium">
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString('ko-KR')
                  : '-'}
              </p>
            </div>
          </div>

          <Link
            href="/payment"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            구독 관리 / 크레딧 충전
          </Link>
        </div>

        {/* Connected Accounts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">연결된 계정</h2>

          <div className="space-y-3">
            {profile?.connectedProviders.map((provider) => (
              <div
                key={provider}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {provider === 'google' && (
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  {provider === 'kakao' && (
                    <div className="w-6 h-6 bg-yellow-400 rounded flex items-center justify-center">
                      <span className="text-xs font-bold">K</span>
                    </div>
                  )}
                  {provider === 'naver' && (
                    <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-white">N</span>
                    </div>
                  )}
                  <span>{PROVIDER_LABELS[provider] || provider}</span>
                </div>
                <span className="text-sm text-green-600">연결됨</span>
              </div>
            ))}

            {profile?.connectedProviders.length === 0 && (
              <p className="text-gray-500">연결된 소셜 계정이 없습니다</p>
            )}
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">이용 현황</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {profile?._count.documents || 0}
              </p>
              <p className="text-sm text-gray-500">생성 문서</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {profile?._count.chats || 0}
              </p>
              <p className="text-sm text-gray-500">AI 상담</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {profile?._count.civilServiceSubmissions || 0}
              </p>
              <p className="text-sm text-gray-500">민원 접수</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {profile?._count.powersOfAttorney || 0}
              </p>
              <p className="text-sm text-gray-500">위임장</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
          <h2 className="text-lg font-semibold text-red-600 mb-4">위험 구역</h2>

          {!showDeleteConfirm ? (
            <div>
              <p className="text-gray-600 mb-4">
                계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
              >
                계정 삭제
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-red-600 font-medium">
                정말로 계정을 삭제하시겠습니까?
              </p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  삭제 확인 (DELETE 입력)
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="w-full border border-red-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  탈퇴 사유 (선택)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmation !== 'DELETE'}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  계정 삭제 확인
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmation('');
                    setDeleteReason('');
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
