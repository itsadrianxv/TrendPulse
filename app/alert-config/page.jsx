'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { ALERT_DEFAULT_PARAMS } from '../lib/alert/defaults.mjs';

const DEFAULT_STRATEGY_FORM = {
  id: null,
  name: '',
  enabled: true,
  ema_fast: String(ALERT_DEFAULT_PARAMS.ema_fast),
  ema_slow: String(ALERT_DEFAULT_PARAMS.ema_slow),
  ema_slow_rising_bars: String(ALERT_DEFAULT_PARAMS.ema_slow_rising_bars),
  adx_period: String(ALERT_DEFAULT_PARAMS.adx_period),
  adx_threshold: String(ALERT_DEFAULT_PARAMS.adx_threshold),
  pullback_lookback_bars: String(ALERT_DEFAULT_PARAMS.pullback_lookback_bars),
  pullback_touch_tolerance: String(ALERT_DEFAULT_PARAMS.pullback_touch_tolerance),
  entry_cooldown_bars: String(ALERT_DEFAULT_PARAMS.entry_cooldown_bars),
  exit_below_slow_bars: String(ALERT_DEFAULT_PARAMS.exit_below_slow_bars),
  exit_channel_lookback_bars: String(ALERT_DEFAULT_PARAMS.exit_channel_lookback_bars)
};

const DEFAULT_BINDING_FORM = {
  code: null,
  target_fund_code: '',
  target_fund_name: '',
  benchmark_fund_code: '',
  benchmark_fund_name: '',
  strategy_profile_id: '',
  enabled: true,
  params_override_json: ''
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });

  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }

  return body.data;
};

const parseInteger = (value, key, minimum = 1) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${key} 必须是大于等于 ${minimum} 的整数`);
  }
  return parsed;
};

const parseFloatValue = (value, key, minimum = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= minimum) {
    throw new Error(`${key} 必须是大于 ${minimum} 的数字`);
  }
  return parsed;
};

const buildStrategyParams = (form) => {
  const params = {
    strategy_kind: 'trend_pullback_v1',
    timeframe: '60m',
    ema_fast: parseInteger(form.ema_fast, 'ema_fast'),
    ema_slow: parseInteger(form.ema_slow, 'ema_slow'),
    ema_slow_rising_bars: parseInteger(form.ema_slow_rising_bars, 'ema_slow_rising_bars'),
    adx_period: parseInteger(form.adx_period, 'adx_period'),
    adx_threshold: parseFloatValue(form.adx_threshold, 'adx_threshold'),
    pullback_lookback_bars: parseInteger(form.pullback_lookback_bars, 'pullback_lookback_bars'),
    pullback_touch_tolerance: parseFloatValue(form.pullback_touch_tolerance, 'pullback_touch_tolerance'),
    entry_cooldown_bars: parseInteger(form.entry_cooldown_bars, 'entry_cooldown_bars'),
    exit_below_slow_bars: parseInteger(form.exit_below_slow_bars, 'exit_below_slow_bars'),
    exit_channel_lookback_bars: parseInteger(form.exit_channel_lookback_bars, 'exit_channel_lookback_bars', 2)
  };

  if (params.ema_slow <= params.ema_fast) {
    throw new Error('ema_slow 必须大于 ema_fast');
  }

  return params;
};

const strategyToForm = (row) => {
  const params = row?.params_json || {};
  return {
    id: row.id,
    name: String(row.name || ''),
    enabled: Boolean(row.enabled),
    ema_fast: String(params.ema_fast ?? ALERT_DEFAULT_PARAMS.ema_fast),
    ema_slow: String(params.ema_slow ?? ALERT_DEFAULT_PARAMS.ema_slow),
    ema_slow_rising_bars: String(params.ema_slow_rising_bars ?? ALERT_DEFAULT_PARAMS.ema_slow_rising_bars),
    adx_period: String(params.adx_period ?? ALERT_DEFAULT_PARAMS.adx_period),
    adx_threshold: String(params.adx_threshold ?? ALERT_DEFAULT_PARAMS.adx_threshold),
    pullback_lookback_bars: String(params.pullback_lookback_bars ?? ALERT_DEFAULT_PARAMS.pullback_lookback_bars),
    pullback_touch_tolerance: String(params.pullback_touch_tolerance ?? ALERT_DEFAULT_PARAMS.pullback_touch_tolerance),
    entry_cooldown_bars: String(params.entry_cooldown_bars ?? ALERT_DEFAULT_PARAMS.entry_cooldown_bars),
    exit_below_slow_bars: String(params.exit_below_slow_bars ?? ALERT_DEFAULT_PARAMS.exit_below_slow_bars),
    exit_channel_lookback_bars: String(params.exit_channel_lookback_bars ?? ALERT_DEFAULT_PARAMS.exit_channel_lookback_bars)
  };
};

const bindingToForm = (row) => ({
  code: String(row.target_fund_code || ''),
  target_fund_code: String(row.target_fund_code || ''),
  target_fund_name: String(row.target_fund_name || ''),
  benchmark_fund_code: String(row.benchmark_fund_code || ''),
  benchmark_fund_name: String(row.benchmark_fund_name || ''),
  strategy_profile_id: row.strategy_profile_id ? String(row.strategy_profile_id) : '',
  enabled: Boolean(row.enabled),
  params_override_json: row.params_override_json ? JSON.stringify(row.params_override_json, null, 2) : ''
});

const summarizeParams = (params) => (
  `EMA${params?.ema_fast ?? '--'} / EMA${params?.ema_slow ?? '--'} · ADX>=${params?.adx_threshold ?? '--'} · 回踩 ${params?.pullback_lookback_bars ?? '--'} 根`
);

export default function AlertConfigPage() {
  const [loading, setLoading] = useState(true);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [savingBinding, setSavingBinding] = useState(false);
  const [strategies, setStrategies] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [strategyForm, setStrategyForm] = useState(DEFAULT_STRATEGY_FORM);
  const [bindingForm, setBindingForm] = useState(DEFAULT_BINDING_FORM);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const strategyOptions = useMemo(
    () => strategies.map((item) => ({
      id: item.id,
      label: `${item.name}${item.enabled ? '' : '（已停用）'}`
    })),
    [strategies]
  );

  const overview = useMemo(() => ({
    strategyTotal: strategies.length,
    strategyEnabled: strategies.filter((item) => item.enabled).length,
    bindingTotal: bindings.length,
    bindingEnabled: bindings.filter((item) => item.enabled).length,
    bindingOverrides: bindings.filter((item) => item.params_override_json && Object.keys(item.params_override_json).length > 0).length
  }), [bindings, strategies]);

  const resetStrategyForm = () => setStrategyForm(DEFAULT_STRATEGY_FORM);
  const resetBindingForm = () => setBindingForm(DEFAULT_BINDING_FORM);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [strategyRows, bindingRows] = await Promise.all([
        requestJson('/api/alert/strategy-profiles'),
        requestJson('/api/alert/fund-bindings')
      ]);
      setStrategies(strategyRows || []);
      setBindings(bindingRows || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveStrategy = async (event) => {
    event.preventDefault();
    setSavingStrategy(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        name: String(strategyForm.name || '').trim(),
        enabled: Boolean(strategyForm.enabled),
        params_json: buildStrategyParams(strategyForm)
      };

      if (!payload.name) {
        throw new Error('策略名称不能为空');
      }

      if (strategyForm.id) {
        await requestJson(`/api/alert/strategy-profiles/${strategyForm.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setMessage('策略模板已更新');
      } else {
        await requestJson('/api/alert/strategy-profiles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setMessage('策略模板已创建');
      }

      resetStrategyForm();
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingStrategy(false);
    }
  };

  const deleteStrategy = async (id) => {
    if (!window.confirm('确认删除该策略模板吗？已绑定基金会退回默认参数。')) {
      return;
    }

    setError('');
    setMessage('');
    try {
      await requestJson(`/api/alert/strategy-profiles/${id}`, { method: 'DELETE' });
      setMessage('策略模板已删除');
      if (strategyForm.id === id) {
        resetStrategyForm();
      }
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const saveBinding = async (event) => {
    event.preventDefault();
    setSavingBinding(true);
    setError('');
    setMessage('');

    try {
      let params_override_json = {};
      if (String(bindingForm.params_override_json || '').trim()) {
        params_override_json = JSON.parse(bindingForm.params_override_json);
      }

      const payload = {
        target_fund_code: String(bindingForm.target_fund_code || '').trim(),
        target_fund_name: String(bindingForm.target_fund_name || '').trim(),
        benchmark_fund_code: String(bindingForm.benchmark_fund_code || '').trim(),
        benchmark_fund_name: String(bindingForm.benchmark_fund_name || '').trim(),
        strategy_profile_id: bindingForm.strategy_profile_id ? Number(bindingForm.strategy_profile_id) : null,
        enabled: Boolean(bindingForm.enabled),
        params_override_json
      };

      if (!payload.target_fund_code || !payload.target_fund_name || !payload.benchmark_fund_code || !payload.benchmark_fund_name) {
        throw new Error('基金绑定的代码和名称都不能为空');
      }

      if (bindingForm.code) {
        await requestJson(`/api/alert/fund-bindings/${bindingForm.code}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setMessage('基金绑定已更新');
      } else {
        await requestJson('/api/alert/fund-bindings', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setMessage('基金绑定已创建');
      }

      resetBindingForm();
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingBinding(false);
    }
  };

  const deleteBinding = async (code) => {
    if (!window.confirm(`确认删除 ${code} 的基金绑定吗？`)) {
      return;
    }

    setError('');
    setMessage('');
    try {
      await requestJson(`/api/alert/fund-bindings/${code}`, { method: 'DELETE' });
      setMessage('基金绑定已删除');
      if (bindingForm.code === code) {
        resetBindingForm();
      }
      await loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <main className={styles.page}>
      <section className={`card ${styles.headerCard}`}>
        <div className={styles.headerMain}>
          <div>
            <h1 className={styles.pageTitle}>60m 趋势提醒配置</h1>
            <p className={styles.pageIntro}>
              当前策略固定使用 benchmark ETF 的 60 分钟伪 K 线，在 10:30 / 11:30 / 14:00 / 15:00 收线后评估。
              这套策略只做 long-only 的趋势跟踪提醒，消息类型包括趋势入场、趋势加仓和趋势退出。
            </p>
          </div>

          <dl className={styles.metricRail}>
            <div className={styles.metricItem}>
              <dt>策略模板</dt>
              <dd>{overview.strategyEnabled} / {overview.strategyTotal}</dd>
            </div>
            <div className={styles.metricItem}>
              <dt>基金绑定</dt>
              <dd>{overview.bindingEnabled} / {overview.bindingTotal}</dd>
            </div>
            <div className={styles.metricItem}>
              <dt>参数覆盖</dt>
              <dd>{overview.bindingOverrides}</dd>
            </div>
            <div className={styles.metricItem}>
              <dt>评估级别</dt>
              <dd>60m</dd>
            </div>
          </dl>
        </div>

        <div className={styles.headerActions}>
          <Link className="button secondary" href="/">
            返回首页
          </Link>
        </div>
      </section>

      {loading ? <div className={styles.sectionMeta}>加载中...</div> : null}
      {error ? <div className={styles.errorBox}>{error}</div> : null}
      {message ? <div className={styles.successBox}>{message}</div> : null}

      <div className={styles.editorGrid}>
        <section className={`card ${styles.sectionCard}`}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>{strategyForm.id ? '编辑策略模板' : '新建策略模板'}</h2>
              <p className={styles.sectionHint}>
                模板只保留 60m 趋势参数。旧的 MACD、TD 和分时提醒时间不再生效，也不会在界面展示。
              </p>
            </div>
            <div className={styles.sectionMeta}>已启用 {overview.strategyEnabled} / {overview.strategyTotal}</div>
          </div>

          <form onSubmit={saveStrategy} className={styles.form}>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>策略名称</span>
                <input
                  className="input"
                  value={strategyForm.name}
                  onChange={(event) => setStrategyForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="例如：默认趋势版 / 保守趋势版"
                />
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={strategyForm.enabled}
                  onChange={(event) => setStrategyForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                />
                启用该策略模板
              </label>
            </div>

            <div className={styles.gridThree}>
              <label className={styles.field}><span>快均线（ema_fast）</span><input className="input" value={strategyForm.ema_fast} onChange={(event) => setStrategyForm((prev) => ({ ...prev, ema_fast: event.target.value }))} /></label>
              <label className={styles.field}><span>慢均线（ema_slow）</span><input className="input" value={strategyForm.ema_slow} onChange={(event) => setStrategyForm((prev) => ({ ...prev, ema_slow: event.target.value }))} /></label>
              <label className={styles.field}><span>慢均线上行确认（ema_slow_rising_bars）</span><input className="input" value={strategyForm.ema_slow_rising_bars} onChange={(event) => setStrategyForm((prev) => ({ ...prev, ema_slow_rising_bars: event.target.value }))} /></label>
              <label className={styles.field}><span>ADX 周期（adx_period）</span><input className="input" value={strategyForm.adx_period} onChange={(event) => setStrategyForm((prev) => ({ ...prev, adx_period: event.target.value }))} /></label>
              <label className={styles.field}><span>ADX 阈值（adx_threshold）</span><input className="input" value={strategyForm.adx_threshold} onChange={(event) => setStrategyForm((prev) => ({ ...prev, adx_threshold: event.target.value }))} /></label>
              <label className={styles.field}><span>回踩观察根数（pullback_lookback_bars）</span><input className="input" value={strategyForm.pullback_lookback_bars} onChange={(event) => setStrategyForm((prev) => ({ ...prev, pullback_lookback_bars: event.target.value }))} /></label>
              <label className={styles.field}><span>回踩容差（pullback_touch_tolerance）</span><input className="input" value={strategyForm.pullback_touch_tolerance} onChange={(event) => setStrategyForm((prev) => ({ ...prev, pullback_touch_tolerance: event.target.value }))} /></label>
              <label className={styles.field}><span>加仓冷却 bar 数（entry_cooldown_bars）</span><input className="input" value={strategyForm.entry_cooldown_bars} onChange={(event) => setStrategyForm((prev) => ({ ...prev, entry_cooldown_bars: event.target.value }))} /></label>
              <label className={styles.field}><span>跌破慢均线 bar 数（exit_below_slow_bars）</span><input className="input" value={strategyForm.exit_below_slow_bars} onChange={(event) => setStrategyForm((prev) => ({ ...prev, exit_below_slow_bars: event.target.value }))} /></label>
              <label className={styles.field}><span>通道退出窗口（exit_channel_lookback_bars）</span><input className="input" value={strategyForm.exit_channel_lookback_bars} onChange={(event) => setStrategyForm((prev) => ({ ...prev, exit_channel_lookback_bars: event.target.value }))} /></label>
            </div>

            <div className={styles.formActions}>
              <button className="button" type="submit" disabled={savingStrategy}>
                {savingStrategy ? '保存中...' : strategyForm.id ? '更新策略模板' : '创建策略模板'}
              </button>
              {strategyForm.id ? (
                <button className="button secondary" type="button" onClick={resetStrategyForm} disabled={savingStrategy}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>名称</th>
                  <th>状态</th>
                  <th>核心参数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.codeCell}>#{item.id}</td>
                    <td>{item.name}</td>
                    <td>{item.enabled ? '启用' : '停用'}</td>
                    <td>{summarizeParams(item.params_json)}</td>
                    <td className={styles.actionCell}>
                      <button className="button secondary" type="button" onClick={() => setStrategyForm(strategyToForm(item))}>编辑</button>
                      <button className="button secondary" type="button" onClick={() => deleteStrategy(item.id)}>删除</button>
                    </td>
                  </tr>
                ))}
                {!strategies.length ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>暂无策略模板</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`card ${styles.sectionCard}`}>
          <div className={styles.sectionHead}>
            <div>
              <h2 className={styles.sectionTitle}>{bindingForm.code ? '编辑基金绑定' : '新建基金绑定'}</h2>
              <p className={styles.sectionHint}>
                每只目标基金绑定一个驱动 ETF。JSON 覆盖只允许填写趋势参数，例如 adx_threshold 或 exit_channel_lookback_bars。
              </p>
            </div>
            <div className={styles.sectionMeta}>已启用 {overview.bindingEnabled} / {overview.bindingTotal}</div>
          </div>

          <form onSubmit={saveBinding} className={styles.form}>
            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>目标基金代码</span>
                <input className="input" value={bindingForm.target_fund_code} onChange={(event) => setBindingForm((prev) => ({ ...prev, target_fund_code: event.target.value }))} placeholder="161725" />
              </label>
              <label className={styles.field}>
                <span>目标基金名称</span>
                <input className="input" value={bindingForm.target_fund_name} onChange={(event) => setBindingForm((prev) => ({ ...prev, target_fund_name: event.target.value }))} placeholder="招商中证白酒" />
              </label>
              <label className={styles.field}>
                <span>驱动 ETF 代码</span>
                <input className="input" value={bindingForm.benchmark_fund_code} onChange={(event) => setBindingForm((prev) => ({ ...prev, benchmark_fund_code: event.target.value }))} placeholder="512690" />
              </label>
              <label className={styles.field}>
                <span>驱动 ETF 名称</span>
                <input className="input" value={bindingForm.benchmark_fund_name} onChange={(event) => setBindingForm((prev) => ({ ...prev, benchmark_fund_name: event.target.value }))} placeholder="酒 ETF" />
              </label>
              <label className={styles.field}>
                <span>策略模板</span>
                <select className="select" value={bindingForm.strategy_profile_id} onChange={(event) => setBindingForm((prev) => ({ ...prev, strategy_profile_id: event.target.value }))}>
                  <option value="">使用默认趋势参数</option>
                  {strategyOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.checkboxField}>
                <input type="checkbox" checked={bindingForm.enabled} onChange={(event) => setBindingForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
                启用该基金绑定
              </label>
            </div>

            <label className={styles.field}>
              <span>参数覆盖（JSON，可选）</span>
              <textarea
                className={styles.textarea}
                value={bindingForm.params_override_json}
                onChange={(event) => setBindingForm((prev) => ({ ...prev, params_override_json: event.target.value }))}
                placeholder='{"adx_threshold":24,"pullback_touch_tolerance":0.0025,"exit_channel_lookback_bars":12}'
              />
            </label>

            <div className={styles.formActions}>
              <button className="button" type="submit" disabled={savingBinding}>
                {savingBinding ? '保存中...' : bindingForm.code ? '更新基金绑定' : '创建基金绑定'}
              </button>
              {bindingForm.code ? (
                <button className="button secondary" type="button" onClick={resetBindingForm} disabled={savingBinding}>
                  取消编辑
                </button>
              ) : null}
            </div>
          </form>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>目标基金</th>
                  <th>驱动 ETF</th>
                  <th>策略模板</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((item) => (
                  <tr key={item.target_fund_code}>
                    <td>{item.target_fund_name} ({item.target_fund_code})</td>
                    <td>{item.benchmark_fund_name} ({item.benchmark_fund_code})</td>
                    <td>{item.strategy_profile_name || '默认趋势参数'}</td>
                    <td>{item.enabled ? '启用' : '停用'}</td>
                    <td className={styles.actionCell}>
                      <button className="button secondary" type="button" onClick={() => setBindingForm(bindingToForm(item))}>编辑</button>
                      <button className="button secondary" type="button" onClick={() => deleteBinding(item.target_fund_code)}>删除</button>
                    </td>
                  </tr>
                ))}
                {!bindings.length ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>暂无基金绑定</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
