'use client';

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(targetIso: string): TimeLeft {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
}

export function CountdownTimer({
  endsAt,
  label,
  compact = false,
  locale = 'ar',
}: {
  endsAt: string;
  label?: string;
  compact?: boolean;
  locale?: string;
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTimeLeft(calcTimeLeft(endsAt));
    const timer = setInterval(() => {
      setTimeLeft(calcTimeLeft(endsAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (!timeLeft || timeLeft.expired) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const units =
    locale === 'ar'
      ? { d: 'ي', h: 'س', m: 'د', s: 'ث' }
      : locale === 'fr'
        ? { d: 'j', h: 'h', m: 'm', s: 's' }
        : { d: 'd', h: 'h', m: 'm', s: 's' };

  if (compact) {
    return (
      <span
        dir="ltr"
        className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums"
      >
        <Clock className="h-3 w-3" />
        {timeLeft.days > 0 ? `${timeLeft.days}${units.d} ` : ''}
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950">
      {label && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <Clock className="h-4 w-4 text-amber-700" />
          {label}
        </span>
      )}
      <div dir="ltr" className="flex items-center gap-1.5 text-xs font-bold tabular-nums">
        {timeLeft.days > 0 && (
          <span className="rounded-md bg-white px-2 py-1 shadow-xs">
            {timeLeft.days}
            {units.d}
          </span>
        )}
        <span className="rounded-md bg-white px-2 py-1 shadow-xs">
          {pad(timeLeft.hours)}
          {units.h}
        </span>
        <span>:</span>
        <span className="rounded-md bg-white px-2 py-1 shadow-xs">
          {pad(timeLeft.minutes)}
          {units.m}
        </span>
        <span>:</span>
        <span className="rounded-md bg-white px-2 py-1 shadow-xs">
          {pad(timeLeft.seconds)}
          {units.s}
        </span>
      </div>
    </div>
  );
}

