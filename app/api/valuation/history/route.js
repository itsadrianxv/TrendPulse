import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { NextResponse } from 'next/server';
import {
  getLatestFundValuationTradeDate,
  listFundValuationSamplesByDate
} from '../../../lib/alert/db.mjs';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const FUND_CODE_RE = /^\d{5,6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const badRequest = (message) =>
  NextResponse.json({ ok: false, error: message }, { status: 400 });

const toNullableNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = String(url.searchParams.get('code') || '').trim();
    const dateParam = String(url.searchParams.get('date') || '').trim();

    if (!FUND_CODE_RE.test(code)) {
      return badRequest('code is invalid');
    }

    if (dateParam && !DATE_RE.test(dateParam)) {
      return badRequest('date is invalid');
    }

    const tradeDate = dateParam || await getLatestFundValuationTradeDate(code);
    if (!tradeDate) {
      return NextResponse.json({
        ok: true,
        data: {
          code,
          date: dateParam || null,
          referenceNav: null,
          navDate: null,
          points: []
        }
      });
    }

    const rows = await listFundValuationSamplesByDate({
      fundCode: code,
      tradeDate
    });

    const points = rows
      .map((row) => {
        const value = toNullableNumber(row.estimate_nav);
        if (value === null) {
          return null;
        }

        const sampleTime = row.sample_minute instanceof Date
          ? row.sample_minute.toISOString()
          : String(row.sample_minute || '');

        return {
          time: dayjs(sampleTime).tz(TZ).format('HH:mm'),
          value,
          sampleTime
        };
      })
      .filter(Boolean);

    const firstRow = rows[0] || {};

    return NextResponse.json({
      ok: true,
      data: {
        code,
        date: tradeDate,
        referenceNav: toNullableNumber(firstRow.latest_nav),
        navDate: firstRow.nav_date || null,
        points
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Load valuation history failed' },
      { status: 500 }
    );
  }
}
