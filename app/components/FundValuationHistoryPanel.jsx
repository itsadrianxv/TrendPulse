'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import FundIntradayChart from './FundIntradayChart';
import { DatePicker } from './Common';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const LOAD_ERROR_TEXT = '\u5206\u949f\u4f30\u503c\u52a0\u8f7d\u5931\u8d25';
const SECTION_TITLE = '\u5206\u949f\u4f30\u503c';
const CHART_TITLE = '\u5206\u949f\u4f30\u503c\u8d70\u52bf';
const DATE_LABEL = '\u4ea4\u6613\u65e5\u671f';
const EMPTY_TEXT = '\u8be5\u65e5\u671f\u6682\u65e0\u5206\u949f\u4f30\u503c\u6570\u636e';
const LOADING_TEXT = '\u5206\u949f\u4f30\u503c\u52a0\u8f7d\u4e2d...';
const FALLBACK_HINT = '\u5f53\u524d\u663e\u793a\u672c\u5730\u4e34\u65f6\u5206\u65f6\uff0c\u5165\u5e93\u540e\u4f1a\u81ea\u52a8\u5207\u6362';

const toNullableNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isTodayLocalFallbackAvailable = ({ fund, fallbackSeries, todayStr }) => {
  if (!Array.isArray(fallbackSeries) || fallbackSeries.length < 2) {
    return false;
  }

  if (!fund?.gztime) {
    return false;
  }

  const today = dayjs.tz(todayStr, TZ).startOf('day');
  const estimateDate = dayjs.tz(fund.gztime, TZ).startOf('day');
  if (!estimateDate.isSame(today, 'day')) {
    return false;
  }

  if (!fund?.jzrq) {
    return true;
  }

  const navDate = dayjs.tz(fund.jzrq, TZ).startOf('day');
  return !(navDate.isSame(estimateDate) || navDate.isAfter(estimateDate));
};

export default function FundValuationHistoryPanel({
  fund,
  fallbackSeries = [],
  theme = 'dark',
  todayStr
}) {
  const fundCode = String(fund?.code || '').trim();
  const hasLocalFallback = useMemo(
    () => isTodayLocalFallbackAvailable({ fund, fallbackSeries, todayStr }),
    [fallbackSeries, fund, todayStr]
  );

  const [selectedDate, setSelectedDate] = useState(null);
  const [latestDbDate, setLatestDbDate] = useState(null);
  const [dbSeries, setDbSeries] = useState([]);
  const [dbReferenceNav, setDbReferenceNav] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setSelectedDate(hasLocalFallback ? todayStr : null);
    setLatestDbDate(null);
    setDbSeries([]);
    setDbReferenceNav(null);
    setLoading(false);
    setError('');
    hasLoadedRef.current = false;
  }, [fundCode, hasLocalFallback, todayStr]);

  useEffect(() => {
    if (!fundCode) return;

    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({ code: fundCode });
        if (selectedDate) {
          params.set('date', selectedDate);
        }

        const response = await fetch(`/api/valuation/history?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || LOAD_ERROR_TEXT);
        }

        const data = payload?.data || {};
        const points = Array.isArray(data.points)
          ? data.points
              .map((point) => {
                const value = toNullableNumber(point?.value);
                if (value === null) return null;

                return {
                  time: String(point?.time || ''),
                  value,
                  date: String(data.date || ''),
                };
              })
              .filter(Boolean)
          : [];

        setDbSeries(points);
        setDbReferenceNav(toNullableNumber(data.referenceNav));
        setLatestDbDate(data.date || null);
        hasLoadedRef.current = true;
      } catch (loadError) {
        if (loadError?.name === 'AbortError') {
          return;
        }

        setError(loadError?.message || LOAD_ERROR_TEXT);
        setDbSeries([]);
        setDbReferenceNav(null);
        hasLoadedRef.current = true;
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => controller.abort();
  }, [fundCode, selectedDate]);

  const effectiveDate = selectedDate || latestDbDate || (hasLocalFallback ? todayStr : '');
  const fallbackReferenceNav = toNullableNumber(fund?.dwjz);
  const shouldUseLocalFallback =
    effectiveDate === todayStr &&
    hasLocalFallback &&
    dbSeries.length < 2;

  const activeSeries = shouldUseLocalFallback ? fallbackSeries : dbSeries;
  const activeReferenceNav = shouldUseLocalFallback
    ? fallbackReferenceNav
    : dbReferenceNav ?? fallbackReferenceNav;
  const hasAnyContent =
    loading ||
    activeSeries.length >= 2 ||
    hasLocalFallback ||
    Boolean(latestDbDate) ||
    Boolean(error) ||
    hasLoadedRef.current;

  if (!hasAnyContent) {
    return null;
  }

  return (
    <div style={{ marginTop: 12, marginBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8
        }}
      >
        <div className="muted" style={{ fontSize: 11 }}>
          {SECTION_TITLE}
        </div>
        <div style={{ width: 148, flexShrink: 0 }}>
          <DatePicker
            value={effectiveDate || todayStr}
            onChange={(date) => setSelectedDate(date)}
          />
        </div>
      </div>

      {activeSeries.length >= 2 ? (
        <FundIntradayChart
          key={`${fundCode}-${effectiveDate || 'latest'}-${theme}`}
          series={activeSeries}
          referenceNav={activeReferenceNav ?? undefined}
          theme={theme}
          title={CHART_TITLE}
          showBeta={false}
          dateLabel={DATE_LABEL}
        />
      ) : (
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          {loading ? LOADING_TEXT : error || EMPTY_TEXT}
        </div>
      )}

      {shouldUseLocalFallback && (
        <div
          className="muted"
          style={{ fontSize: 10, marginTop: 6, textAlign: 'right' }}
        >
          {FALLBACK_HINT}
        </div>
      )}
    </div>
  );
}
