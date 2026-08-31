'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import liff from '@line/liff';
import CalendarGrid from '@/components/CalendarGrid';
import { format } from 'date-fns';

const PRESET_TITLES = ['有休申請', '直行・直帰', '出張・外出', '会議・打合せ', '社内研修'];

export default function Home() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isApprovalRequired, setIsApprovalRequired] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 予定一覧の取得
  const fetchSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        users:created_by (
          display_name
        )
      `)
      .order('start_at', { ascending: true });

    if (error) {
      console.error('取得エラー:', error);
      return;
    }

    if (data) setSchedules(data);
  }, []);

  // 初回ロード時のLIFF初期化およびユーザー登録 (Upsert化)
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (!liff.isLoggedIn()) {
          if (!liff.isInClient()) {
            liff.login({ redirectUri: window.location.href });
            return;
          }
        }

        const profile = await liff.getProfile();

        // line_user_id をキーにして upsert (作成または更新)
        const { data: user, error: upsertError } = await supabase
          .from('users')
          .upsert(
            { line_user_id: profile.userId, display_name: profile.displayName },
            { onConflict: 'line_user_id' }
          )
          .select('id')
          .single();

        if (upsertError) {
          console.error('ユーザー同期エラー:', upsertError);
          alert(`ユーザー同期エラー: ${upsertError.message}`);
          return;
        }

        if (user) {
          setUserId(user.id);
        }

        await fetchSchedules();
      } catch (err: any) {
        console.error('LIFF Error:', err);
        alert(`LINE認証エラー: ${err.message || err}`);
      } finally {
        setLoading(false);
      }
    };

    initLiff();
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, [fetchSchedules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) return alert('件名を入力してください。');
    if (!date) return alert('日付を選択してください。');
    if (!userId) return alert('ユーザー認証が完了していません。再読み込みしてください。');

    setSubmitting(true);

    // JSTのタイムゾーンを明示 (+09:00)
    const startAt = `${date}T${startTime}:00+09:00`;
    const endAt = `${date}T${endTime}:00+09:00`;
    const status = isApprovalRequired ? 'pending' : 'approved';

    try {
      const { error } = await supabase.from('schedules').insert({
        title,
        start_at: startAt,
        end_at: endAt,
        is_approval_required: isApprovalRequired,
        status,
        created_by: userId,
      });

      if (error) throw error;

      setTitle('');
      setIsApprovalRequired(false);
      await fetchSchedules();
      alert('予定を追加しました！');
    } catch (err: any) {
      console.error('登録エラー:', err);
      alert(`登録に失敗しました: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('schedules').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      fetchSchedules();
    } catch (err) {
      console.error('更新エラー:', err);
      alert('状態の更新に失敗しました。');
    }
  };

  const handleDeleteSchedule = async (id: string, scheduleTitle: string) => {
    const confirmed = window.confirm(`【${scheduleTitle}】\nこの予定を削除してもよろしいですか？`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;

      alert('予定を削除しました。');
      fetchSchedules();
    } catch (err) {
      console.error('削除エラー:', err);
      alert('削除に失敗しました。');
    }
  };

  // 選択された日付の予定のみを抽出（過去日付でも参照可能に修正）
  const filteredSchedules = schedules.filter((item) => {
    if (!date || !item.start_at) return false;
    const scheduleDateStr = format(new Date(item.start_at), 'yyyy-MM-dd');
    return scheduleDateStr === date;
  });

  if (loading) return <div className="p-6 text-center text-gray-500">LINE認証中...</div>;

  return (
    <main className="min-h-screen bg-slate-50 p-4 max-w-md mx-auto text-slate-800">
      <h1 className="text-xl font-bold mb-4 text-center text-emerald-600">📱 社内予定共有カレンダー</h1>

      <CalendarGrid
        schedules={schedules}
        selectedDate={date}
        onSelectDate={(selectedDate) => setDate(selectedDate)}
        onSelectSchedule={(schedule) => {
          // 自身の作成した予定のみ削除を許容する場合は条件判定を追加
          handleDeleteSchedule(schedule.id, schedule.title);
        }}
      />

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <h2 className="font-bold text-sm mb-3 text-slate-700">＋ 予定のクイック入力</h2>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_TITLES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTitle(preset)}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-full border text-slate-600 transition"
            >
              {preset}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="予定の件名を入力"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg p-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />

        <div className="mb-3 space-y-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-lg p-2 text-sm bg-slate-50"
            required
          />
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 border rounded-lg p-2 text-sm bg-slate-50"
            />
            <span className="text-xs text-slate-400">〜</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="flex-1 border rounded-lg p-2 text-sm bg-slate-50"
            />
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border mb-4">
          <span className="block text-xs font-semibold text-slate-500 mb-2">予定の種類</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsApprovalRequired(false)}
              className={`py-2 text-xs font-bold rounded-md border transition ${
                !isApprovalRequired
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              通常予定（承認不要）
            </button>
            <button
              type="button"
              onClick={() => setIsApprovalRequired(true)}
              className={`py-2 text-xs font-bold rounded-md border transition ${
                isApprovalRequired
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              申請予定（要承認）
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold py-3 rounded-lg text-sm transition shadow disabled:opacity-50"
        >
          {submitting ? '保存中...' : '予定を追加'}
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-bold text-sm text-slate-700">
          📋 予定・承認管理リスト ({date || '未選択'})
        </h2>

        {filteredSchedules.length === 0 ? (
          <div className="bg-white rounded-xl p-4 text-center text-xs text-slate-400 border border-slate-100">
            選択した日付の予定はありません
          </div>
        ) : (
          filteredSchedules.map((item) => {
            const start = new Date(item.start_at);
            const end = new Date(item.end_at);
            const isOwner = item.created_by === userId;

            return (
              <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-slate-800">{item.title}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.status === 'approved'
                      ? '承認済み'
                      : item.status === 'rejected'
                      ? '非承認'
                      : '承認待ち'}
                  </span>
                </div>

                <div className="text-xs text-slate-500 mb-2 flex justify-between items-center">
                  <span>
                    {start.getMonth() + 1}/{start.getDate()} ({['日','月','火','水','木','金','土'][start.getDay()]}){' '}
                    {String(start.getHours()).padStart(2, '0')}:{String(start.getMinutes()).padStart(2, '0')} 〜{' '}
                    {String(end.getHours()).padStart(2, '0')}:{String(end.getMinutes()).padStart(2, '0')}
                  </span>

                  <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                    👤 {item.users?.display_name || '名称不明'}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  {item.is_approval_required && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'approved')}
                        disabled={item.status === 'approved'}
                        className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 disabled:opacity-40 font-bold py-1.5 rounded text-xs transition"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'rejected')}
                        disabled={item.status === 'rejected'}
                        className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-40 font-bold py-1.5 rounded text-xs transition"
                      >
                        非承認
                      </button>
                    </>
                  )}
                  {/* 作成者本人のみ削除可能にする場合などの制御 */}
                  {(isOwner || true) && (
                    <button
                      onClick={() => handleDeleteSchedule(item.id, item.title)}
                      className="px-3 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold py-1.5 rounded text-xs transition"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}