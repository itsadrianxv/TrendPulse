import test from 'node:test';
import assert from 'node:assert/strict';

import { ALERT_EVENT_TYPES } from '../../app/lib/alert/defaults.mjs';
import * as worker from '../../app/lib/alert/worker.mjs';

const binding = {
  targetFundCode: '161725',
  targetFundName: 'Test Fund',
  benchmarkFundCode: '512690',
  benchmarkFundName: 'Test ETF'
};

test('shouldEvaluateSignalMinute only allows 60m close points', () => {
  assert.equal(typeof worker.shouldEvaluateSignalMinute, 'function');
  assert.equal(worker.shouldEvaluateSignalMinute('10:30'), true);
  assert.equal(worker.shouldEvaluateSignalMinute('11:30'), true);
  assert.equal(worker.shouldEvaluateSignalMinute('14:00'), true);
  assert.equal(worker.shouldEvaluateSignalMinute('15:00'), true);
  assert.equal(worker.shouldEvaluateSignalMinute('14:58'), false);
});

test('buildSignalEventDecision creates notifiable entry payloads', () => {
  assert.equal(typeof worker.buildSignalEventDecision, 'function');

  const decision = worker.buildSignalEventDecision({
    binding,
    signal: {
      eventType: ALERT_EVENT_TYPES.ENTRY,
      entryMode: 'INITIAL',
      reason: 'pullback_reclaimed',
      barEndTime: '2026-04-07T02:30:00.000Z',
      triggerAnchorTime: '2026-04-07T01:30:00.000Z',
      indicators: {
        close: 132.46,
        emaFast: 130.98,
        emaSlow: 126.42,
        adx: 31.2
      }
    },
    existingEvents: []
  });

  assert.equal(decision.shouldNotify, true);
  assert.equal(decision.event.event_type, ALERT_EVENT_TYPES.ENTRY);
  assert.equal(decision.event.signal_side, 'LONG');
  assert.equal(decision.event.payload_json.entry_mode, 'INITIAL');
});

test('buildSignalEventDecision suppresses duplicate events on the same bar', () => {
  const decision = worker.buildSignalEventDecision({
    binding,
    signal: {
      eventType: ALERT_EVENT_TYPES.ENTRY,
      entryMode: 'ADD',
      reason: 'pullback_reclaimed',
      barEndTime: '2026-04-07T06:00:00.000Z',
      triggerAnchorTime: '2026-04-07T05:00:00.000Z',
      indicators: {
        close: 136.2,
        emaFast: 134.9,
        emaSlow: 130.8,
        adx: 28.4
      }
    },
    existingEvents: [
      {
        event_type: ALERT_EVENT_TYPES.ENTRY,
        bar_end_time: '2026-04-07T06:00:00.000Z'
      }
    ]
  });

  assert.equal(decision, null);
});

test('buildSignalEventDecision records invalidated setups without notifying Feishu', () => {
  const decision = worker.buildSignalEventDecision({
    binding,
    signal: {
      eventType: ALERT_EVENT_TYPES.SETUP_INVALIDATED,
      reason: 'setup_lost_ema60',
      barEndTime: '2026-04-07T03:30:00.000Z',
      triggerAnchorTime: '2026-04-07T02:30:00.000Z',
      indicators: {
        close: 125.16,
        emaFast: 129.8,
        emaSlow: 126.1,
        adx: 19.8
      }
    },
    existingEvents: []
  });

  assert.equal(decision.shouldPersist, true);
  assert.equal(decision.shouldNotify, false);
  assert.equal(decision.event.event_type, ALERT_EVENT_TYPES.SETUP_INVALIDATED);
});
