import { ALERT_EVENT_TYPES } from './defaults.mjs';

const titleMap = {
  [ALERT_EVENT_TYPES.ENTRY]: {
    INITIAL: '趋势入场',
    ADD: '趋势加仓'
  },
  [ALERT_EVENT_TYPES.EXIT]: '趋势退出',
  [ALERT_EVENT_TYPES.SETUP_INVALIDATED]: '趋势条件失效'
};

const nowTs = () => new Date().toISOString();

const resolveTitle = (payload) => {
  if (payload?.eventType === ALERT_EVENT_TYPES.ENTRY) {
    return titleMap[ALERT_EVENT_TYPES.ENTRY][payload?.entryMode || 'INITIAL'] || '趋势入场';
  }

  return titleMap[payload?.eventType] || payload?.eventType || '基金趋势提醒';
};

export const buildFeishuMessageText = ({ binding, payload }) => {
  const lines = [
    `基金趋势提醒｜${resolveTitle(payload)}`,
    `交易基金：${binding.targetFundName}(${binding.targetFundCode})`,
    `驱动标的：${binding.benchmarkFundName}(${binding.benchmarkFundCode})`,
    `K线级别：${payload?.barTimeframe || '60m'}`,
    `收线时间：${payload?.barEndTime || '--'}`,
    `最新收盘：${payload?.indicators?.close ?? '--'}`,
    `EMA20：${payload?.indicators?.emaFast ?? '--'}`,
    `EMA60：${payload?.indicators?.emaSlow ?? '--'}`,
    `ADX：${payload?.indicators?.adx ?? '--'}`,
    `触发锚点：${payload?.triggerAnchorTime || '--'}`,
    `原因：${payload?.reason || '--'}`,
    `时间：${nowTs()}`
  ];

  return lines.join('\n');
};

export const sendFeishuTextMessage = async ({ webhookUrl, text }) => {
  if (!webhookUrl) {
    throw new Error('FEISHU_WEBHOOK_URL is empty');
  }

  const requestBody = {
    msg_type: 'text',
    content: {
      text
    }
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  let responseJson = null;

  try {
    responseJson = JSON.parse(responseText);
  } catch (_error) {
    responseJson = { raw: responseText };
  }

  const success = response.ok
    && (responseJson?.StatusCode === 0 || responseJson?.code === 0 || responseJson?.msg === 'success');

  return {
    success,
    status: response.status,
    requestBody,
    responseBody: responseJson
  };
};
