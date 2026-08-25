'use client';

import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';

type Schedule = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: 'pending' | 'approved' | 'rejected';
  is_approval_required: boolean;
};

export default function CalendarGrid({
  schedules = [],
  selectedDate,
  onSelectSchedule,
  onSelectDate,
}: {
  schedules?: Schedule[];
  selectedDate?: string;
  onSelectSchedule?: (schedule: Schedule) => void;
  onSelectDate?: (dateStr: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = [];
  let day = startDate;

  while (day <= endDate) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-6">
      <div className="flex justify-between items-center mb-3">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold"
        >
          ◀ 前月
        </button>
        <h2 className="font-bold text-sm text-slate-700">
          {format(currentMonth, 'yyyy年 M月')}
        </h2>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold"
        >
          次月 ▶
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1 text-center text-[10px] font-bold text-slate-400">
        <span className="text-rose-500">日</span>
        <span>月</span>
        <span>火</span>
        <span>水</span>
        <span>木</span>
        <span>金</span>
        <span className="text-blue-500">土</span>
      </div>

      <div className="grid grid-cols-7 rounded-lg overflow-hidden border border-slate-100">
        {calendarDays.map((cellDay) => {
          const dateStr = format(cellDay, 'yyyy-MM-dd');
          const isSelected = selectedDate === dateStr;

          // 対象日に該当する予定があるかチェック
          const daySchedules = schedules.filter((s) => {
            if (!s.start_at) return false;
            // ISO文字列をローカル日付 (YYYY-MM-DD) に変換して比較
            const scheduleDateStr = format(new Date(s.start_at), 'yyyy-MM-dd');
            return scheduleDateStr === dateStr;
          });

          const hasSchedules = daySchedules.length > 0;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => {
                if (onSelectDate) onSelectDate(dateStr);
              }}
              className={`min-h-[72px] border border-slate-100 p-1 bg-white flex flex-col justify-between cursor-pointer select-none transition text-left ${
                isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'hover:bg-slate-50'
              } ${!isSameMonth(cellDay, monthStart) ? 'bg-slate-50 opacity-40' : ''}`}
            >
              {/* 日付数字 */}
              <span className="text-[10px] font-bold text-slate-600 self-end">
                {format(cellDay, 'd')}
              </span>

              {/* 予定がある場合の目印（ドットマーク） */}
              <div className="flex flex-col items-center justify-center gap-1 my-auto min-h-[20px]">
                {hasSchedules && (
                  <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span>{daySchedules.length}件</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}