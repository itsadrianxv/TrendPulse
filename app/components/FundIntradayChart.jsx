'use client';

import { useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { isNumber } from 'lodash';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

const CHART_COLORS = {
  dark: {
    danger: '#f18a82',
    success: '#66c39a',
    primary: '#9082f4',
    muted: '#a6aecf',
    border: '#2d3552',
    text: '#eef1ff',
    crosshairText: '#151827',
  },
  light: {
    danger: '#d35e58',
    success: '#2f9369',
    primary: '#5b63d8',
    muted: '#6c7392',
    border: '#dde2f2',
    text: '#1f2540',
    crosshairText: '#ffffff',
  }
};

const DEFAULT_TITLE = '\u5b9e\u65f6\u4f30\u503c\u5206\u65f6\uff08\u6309\u5237\u65b0\u8bb0\u5f55\uff09';
const DEFAULT_DATE_LABEL = '\u4f30\u503c\u65e5\u671f';
const DATASET_LABEL = '\u6da8\u8dcc\u5e45';
const BETA_TITLE = '\u6b63\u5728\u6d4b\u8bd5\u4e2d\u7684\u529f\u80fd';

function getChartThemeColors(theme) {
  return CHART_COLORS[theme] || CHART_COLORS.dark;
}

export default function FundIntradayChart({
  series = [],
  referenceNav,
  theme = 'dark',
  title = DEFAULT_TITLE,
  showBeta = true,
  dateLabel = DEFAULT_DATE_LABEL
}) {
  const chartRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const chartColors = useMemo(() => getChartThemeColors(theme), [theme]);

  const chartData = useMemo(() => {
    if (!series.length) return { labels: [], datasets: [] };
    const labels = series.map((d) => d.time);
    const values = series.map((d) => d.value);
    const ref = referenceNav != null && Number.isFinite(Number(referenceNav))
      ? Number(referenceNav)
      : values[0];
    const percentages = values.map((v) => (ref ? ((v - ref) / ref) * 100 : 0));
    const lastPct = percentages[percentages.length - 1];
    const riseColor = chartColors.danger;
    const fallColor = chartColors.success;
    const lineColor = lastPct != null && lastPct >= 0 ? riseColor : fallColor;

    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: DATASET_LABEL,
          data: percentages,
          borderColor: lineColor,
          backgroundColor: (ctx) => {
            if (!ctx.chart.ctx) return lineColor + '33';
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 120);
            gradient.addColorStop(0, lineColor + '33');
            gradient.addColorStop(1, lineColor + '00');
            return gradient;
          },
          borderWidth: 2,
          pointRadius: series.length <= 2 ? 3 : 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.2
        }
      ]
    };
  }, [series, referenceNav, chartColors.danger, chartColors.success]);

  const options = useMemo(() => {
    const colors = getChartThemeColors(theme);
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          mode: 'index',
          intersect: false,
          external: () => {}
        }
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: {
            color: colors.muted,
            font: { size: 10 },
            maxTicksLimit: 6
          }
        },
        y: {
          display: true,
          position: 'left',
          grid: { color: colors.border, drawBorder: false },
          ticks: {
            color: colors.muted,
            font: { size: 10 },
            callback: (v) => (isNumber(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : v)
          }
        }
      },
      onHover: (event, chartElement, chart) => {
        const target = event?.native?.target;
        const currentChart = chart || chartRef.current;
        if (!currentChart) return;

        const tooltipActive = currentChart.tooltip?._active ?? [];
        const activeElements = currentChart.getActiveElements
          ? currentChart.getActiveElements()
          : [];
        const hasActive =
          (chartElement && chartElement.length > 0) ||
          (tooltipActive && tooltipActive.length > 0) ||
          (activeElements && activeElements.length > 0);

        if (target) {
          target.style.cursor = hasActive ? 'crosshair' : 'default';
        }

        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        if (hasActive) {
          hoverTimeoutRef.current = setTimeout(() => {
            const c = chartRef.current || currentChart;
            if (!c) return;
            c.setActiveElements([]);
            if (c.tooltip) {
              c.tooltip.setActiveElements([], { x: 0, y: 0 });
            }
            c.update();
            if (target) {
              target.style.cursor = 'default';
            }
          }, 2000);
        }
      }
    };
  }, [theme]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const plugins = useMemo(() => {
    const colors = getChartThemeColors(theme);
    return [{
      id: 'crosshair',
      afterDraw: (chart) => {
        const ctx = chart.ctx;
        const activeElements = chart.tooltip?._active?.length
          ? chart.tooltip._active
          : chart.getActiveElements();
        if (!activeElements?.length) return;

        const activePoint = activeElements[0];
        const x = activePoint.element.x;
        const y = activePoint.element.y;
        const topY = chart.scales.y.top;
        const bottomY = chart.scales.y.bottom;
        const leftX = chart.scales.x.left;
        const rightX = chart.scales.x.right;
        const index = activePoint.index;
        const labels = chart.data.labels;
        const data = chart.data.datasets[0]?.data;

        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.muted;
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.moveTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.stroke();

        const prim = colors.primary;
        const textCol = colors.crosshairText;

        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (labels && index in labels) {
          const timeStr = String(labels[index]);
          const tw = ctx.measureText(timeStr).width + 8;
          const chartLeft = chart.scales.x.left;
          const chartRight = chart.scales.x.right;
          let labelLeft = x - tw / 2;
          if (labelLeft < chartLeft) labelLeft = chartLeft;
          if (labelLeft + tw > chartRight) labelLeft = chartRight - tw;
          const labelCenterX = labelLeft + tw / 2;
          ctx.fillStyle = prim;
          ctx.fillRect(labelLeft, bottomY, tw, 16);
          ctx.fillStyle = textCol;
          ctx.fillText(timeStr, labelCenterX, bottomY + 8);
        }
        if (data && index in data) {
          const val = data[index];
          const valueStr = isNumber(val) ? `${val >= 0 ? '+' : ''}${val.toFixed(2)}%` : String(val);
          const vw = ctx.measureText(valueStr).width + 8;
          ctx.fillStyle = prim;
          ctx.fillRect(leftX, y - 8, vw, 16);
          ctx.fillStyle = textCol;
          ctx.fillText(valueStr, leftX + vw / 2, y);
        }
        ctx.restore();
      }
    }];
  }, [theme]);

  if (series.length < 2) return null;

  const displayDate = series[0]?.date || series[series.length - 1]?.date;

  return (
    <div style={{ marginTop: 12, marginBottom: 4 }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          {showBeta && (
            <span
              style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                ...(theme === 'light'
                  ? {
                      border: '1px solid',
                      borderColor: chartColors.primary,
                      color: chartColors.primary,
                      background: 'transparent',
                    }
                  : {
                      background: 'var(--primary)',
                      color: '#0f172a',
                    }),
                fontWeight: 600,
              }}
              title={BETA_TITLE}
            >
              Beta
            </span>
          )}
        </span>
        {displayDate && <span style={{ fontSize: 11 }}>{`${dateLabel}: ${displayDate}`}</span>}
      </div>
      <div style={{ position: 'relative', height: 100, width: '100%', touchAction: 'pan-y' }}>
        <Line ref={chartRef} data={chartData} options={options} plugins={plugins} />
      </div>
    </div>
  );
}
