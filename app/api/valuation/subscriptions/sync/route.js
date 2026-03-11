import { NextResponse } from 'next/server';
import { syncFundValuationSubscriptions } from '../../../../lib/alert/db.mjs';
import {
  getSupabaseUserByAccessToken,
  isSupabaseAdminConfigured
} from '../../../../lib/supabaseAdmin.mjs';

const unauthorized = (message = 'Unauthorized') =>
  NextResponse.json({ ok: false, error: message }, { status: 401 });

const badRequest = (message) =>
  NextResponse.json({ ok: false, error: message }, { status: 400 });

export async function POST(request) {
  try {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        { ok: false, error: 'Supabase admin not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const matched = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!matched?.[1]) {
      return unauthorized('Missing access token');
    }

    const user = await getSupabaseUserByAccessToken(matched[1]);
    if (!user?.id) {
      return unauthorized('Invalid access token');
    }

    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.funds)) {
      return badRequest('funds must be an array');
    }

    const result = await syncFundValuationSubscriptions({
      userId: user.id,
      funds: body.funds
    });

    return NextResponse.json({
      ok: true,
      data: {
        activeCount: result.activeCount
      }
    });
  } catch (error) {
    const status = error?.status === 401 ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: error.message || 'Sync subscriptions failed' },
      { status }
    );
  }
}
