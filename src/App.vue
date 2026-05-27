<template>
  <div class="panel" ref="panelRef" @scroll="onScroll">
    <!-- 头部：标题 + 图标按钮 -->
    <div class="header" :class="{ scrolled }">
      <span class="title">DeepSeek Usage</span>
      <div class="header-actions">
        <button class="btn-icon" title="刷新" @click="refresh()" :class="{ spinning: isRefreshing }">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M13.5 8a5.5 5.5 0 0 0-10-3.5M2.5 8a5.5 5.5 0 0 0 10 3.5M13.5 1.5V5h-3.5M2.5 14.5V11h3.5" />
          </svg>
        </button>
        <button class="btn-icon" title="API 用量" @click="openUsage">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        <button class="btn-icon" title="Chat" @click="openChat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button class="btn-icon" title="设置" @click="openSettings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button class="btn-icon" title="退出" @click="quitApp">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="initialLoading" class="status">加载中...</div>
    <div v-else-if="balanceError" class="status error">{{ balanceError }}</div>

    <template v-if="!initialLoading && !balanceError">
      <!-- 余额 -->
      <div class="card balance-card" :class="{ 'refreshing-overlay': isRefreshing }">
        <div class="card-row">
          <span class="label">余额</span>
          <div class="row-right">
            <span v-if="!balanceData.is_available" class="warn">&#9888;</span>
            <select class="month-picker" v-model="selectedMonth" @change="onMonthChange">
              <option v-for="mo in monthOptions" :value="mo.value" :key="mo.value">
                {{ mo.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="balance-main">
          <span class="balance-num">{{ fmt(totalBalance) }}</span>
          <span class="balance-unit">¥</span>
          <span class="balance-cost">今日花费</span><span class="cost-badge"
            :style="{ background: costColor + '22', color: costColor }">{{ fmt(costToday) }} ¥</span>
        </div>
      </div>

      <!-- 消耗 -->
      <div class="card chart-card" :class="{ 'refreshing-overlay': isRefreshing }">
        <div class="flex-bc">
          <span class="label">Usage</span>
          <div class="header-right">
            <span class="hit-rate"><span class="hit-rate-val">{{ cacheHitRate }}%</span> 缓存命中</span>
            <div class="toggle-group">
              <span class="toggle-label" :class="{ active: !isMonthly }">今日</span>
              <label class="toggle-switch-sm">
                <input type="checkbox" v-model="isMonthly" />
                <span class="toggle-slider-sm"></span>
              </label>
              <span class="toggle-label" :class="{ active: isMonthly }">本月</span>
            </div>
          </div>
        </div>
        <template v-if="usageError">
          <p class="placeholder-text">{{ usageError }}</p>
        </template>
        <template v-else-if="!tokenDays.length">
          <p class="placeholder-text">暂无数据</p>
        </template>
        <template v-else>
          <v-chart class="chart-hbar" :option="consumptionChartOption" autoresize />
        </template>
      </div>

      <!-- 每日花费 -->
      <div class="card chart-card" :class="{ 'refreshing-overlay': isRefreshing }">
        <div class="flex-bc">
          <span class="label">Cost </span><span class="label-today">{{ fmt(monthlyCost) }} ¥</span>
        </div>
        <template v-if="usageError">
          <p class="placeholder-text">{{ usageError }}</p>
        </template>
        <template v-else-if="!costDays.length">
          <p class="placeholder-text">暂无数据</p>
        </template>
        <template v-else>
          <v-chart class="chart" :option="costChartOption" autoresize />
        </template>
      </div>

      <!-- Tokens: V4-Pro -->
      <div class="card chart-card" :class="{ 'refreshing-overlay': isRefreshing }">
        <div class="flex-bc">
          <span class="label">Tokens · v4-pro</span>
          <span class="label-today">{{ monthlyV4ProTotal.toLocaleString('en-US') }} tokens ·
            <span class="hit-rate-val">{{ v4ProHitRate }}%</span> 命中</span>
        </div>
        <template v-if="usageError">
          <p class="placeholder-text">{{ usageError }}</p>
        </template>
        <template v-else-if="!tokenDays.length">
          <p class="placeholder-text">暂无数据</p>
        </template>
        <template v-else>
          <v-chart class="chart" :option="tokenProChartOption" autoresize />
        </template>
      </div>

      <!-- Tokens: V4-Flash -->
      <div class="card chart-card" :class="{ 'refreshing-overlay': isRefreshing }">
        <div class="flex-bc">
          <span class="label">Tokens · v4-flash</span>
          <span class="label-today">{{ monthlyV4FlashTotal.toLocaleString('en-US') }} tokens ·
            <span class="hit-rate-val">{{ v4FlashHitRate }}%</span> 命中</span>
        </div>
        <template v-if="usageError">
          <p class="placeholder-text">{{ usageError }}</p>
        </template>
        <template v-else-if="!tokenDays.length">
          <p class="placeholder-text">暂无数据</p>
        </template>
        <template v-else>
          <v-chart class="chart" :option="tokenFlashChartOption" autoresize />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const balanceData = ref({})
const usageData = ref({ summary: null, costDays: [], tokenDays: [] })
const initialLoading = ref(true)
const balanceError = ref('')
const usageError = ref('')
const isLight = ref(false)
const isMonthly = ref(false)
const now = new Date()
const selectedMonth = ref(now.getFullYear() + '-' + (now.getMonth() + 1))

const monthOptions = computed(() => {
  const start = new Date(2025, 5, 1) // 2025-06
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  const opts = []
  const cur = new Date(end)
  while (cur >= start) {
    const y = cur.getFullYear()
    const m = cur.getMonth() + 1
    opts.push({ value: y + '-' + m, label: y + '-' + m + '月' })
    cur.setMonth(cur.getMonth() - 1)
  }
  return opts
})
const scrolled = ref(false)
const isRefreshing = ref(false)
const panelRef = ref(null)

const totalBalance = computed(
  () => parseFloat(balanceData.value?.balance_infos?.[0]?.total_balance) || 0,
)
const monthlyCost = computed(() => {
  return (usageData.value?.costDays || []).reduce((sum, d) => sum + (d.total || 0), 0)
})
const costDays = computed(() => usageData.value?.costDays || [])
const tokenDays = computed(() => usageData.value?.tokenDays || [])

const dailyCostThres = ref({ low: 2, med: 5, high: 8 })

const todayDate = ref(new Date().toISOString().slice(0, 10))

const costToday = computed(() => {
  const d = costDays.value.find((d) => d.date === todayDate.value)
  return d ? d.total : 0
})
const tokenProToday = computed(() => {
  const d = tokenDays.value.find((d) => d.date === todayDate.value)
  if (!d?.byModel?.['deepseek-v4-pro']) return 0
  const m = d.byModel['deepseek-v4-pro']
  return (m.cacheHit || 0) + (m.cacheMiss || 0) + (m.output || 0)
})
const tokenFlashToday = computed(() => {
  const d = tokenDays.value.find((d) => d.date === todayDate.value)
  if (!d?.byModel?.['deepseek-v4-flash']) return 0
  const m = d.byModel['deepseek-v4-flash']
  return (m.cacheHit || 0) + (m.cacheMiss || 0) + (m.output || 0)
})

const todayTotalTokens = computed(() => tokenProToday.value + tokenFlashToday.value)

function hitPct(hit, miss) {
  const t = hit + miss
  if (t <= 0) return 0
  if (miss === 0) return 100
  const p = Math.round((hit / t) * 100)
  return p >= 100 ? 99 : p
}

function todaySumByType(type) {
  return computed(() => {
    const d = tokenDays.value.find((dd) => dd.date === todayDate.value)
    if (!d) return 0
    let sum = 0
    for (const m of Object.values(d.byModel || {})) {
      sum += m[type] || 0
    }
    return sum
  })
}
const todayCacheHit = todaySumByType('cacheHit')
const todayCacheMiss = todaySumByType('cacheMiss')
const todayOutput = todaySumByType('output')

const monthlyV4ProTotal = computed(() => {
  const p = monthlyV4ProBreakdown.value
  return p.cacheHit + p.cacheMiss + p.output
})

const monthlyV4FlashTotal = computed(() => {
  const f = monthlyV4FlashBreakdown.value
  return f.cacheHit + f.cacheMiss + f.output
})

const v4ProHitRate = computed(() => {
  const p = monthlyV4ProBreakdown.value
  return hitPct(p.cacheHit, p.cacheMiss)
})

const v4FlashHitRate = computed(() => {
  const f = monthlyV4FlashBreakdown.value
  return hitPct(f.cacheHit, f.cacheMiss)
})

const cacheHitRateMonthly = computed(() => {
  const t = monthlyTotalBreakdown.value
  return hitPct(t.cacheHit, t.cacheMiss)
})

const cacheHitRateDaily = computed(() => {
  return hitPct(todayCacheHit.value, todayCacheMiss.value)
})

const cacheHitRate = computed(() =>
  isMonthly.value ? cacheHitRateMonthly.value : cacheHitRateDaily.value,
)

const costColor = computed(() => {
  const c = costToday.value
  const { low, med, high } = dailyCostThres.value
  if (c >= high) return '#ef4444'
  if (c >= med) return '#f59e0b'
  if (c >= low) return '#eab308'
  return '#22c55e'
})

// ---- ECharts 配置 ----
const grid = { top: 14, right: 8, bottom: 14, left: 8 }
function xAxis(data) {
  const l = isLight.value
  return {
    type: 'category',
    data,
    axisLabel: {
      color: l ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)',
      fontSize: 8,
      interval: 4,
    },
    axisLine: { lineStyle: { color: l ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' } },
    axisTick: { show: false },
  }
}
function yAxisCost() {
  const l = isLight.value
  return {
    type: 'value',
    splitNumber: 3,
    axisLabel: { color: l ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)', fontSize: 8 },
    splitLine: { lineStyle: { color: l ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } },
  }
}
function yAxisTokens() {
  const l = isLight.value
  return {
    type: 'value',
    splitNumber: 3,
    axisLabel: {
      color: l ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)',
      fontSize: 8,
      formatter: (v) =>
        v >= 1e6 ? (v / 1e6).toFixed(0) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v,
    },
    splitLine: { lineStyle: { color: l ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } },
  }
}
function tt() {
  const l = isLight.value
  return {
    backgroundColor: l ? 'rgba(255,255,255,0.92)' : 'rgba(44,44,46,0.9)',
    borderColor: l ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)',
    textStyle: { color: l ? '#1d1d1f' : '#f5f5f7', fontSize: 11 },
  }
}
const costColors = {
  'deepseek-v4-pro': '#8b5cf6',
  'deepseek-v4-flash': '#0ea5e9',
  'deepseek-chat & deepseek-reasoner': '#48484a',
}
const costOrder = ['deepseek-chat & deepseek-reasoner', 'deepseek-v4-flash', 'deepseek-v4-pro']
const costNames = {
  'deepseek-v4-pro': 'v4-pro',
  'deepseek-v4-flash': 'v4-flash',
  'deepseek-chat & deepseek-reasoner': 'chat & reasoner',
}
const tokenColors = { cacheHit: '#22c55e', cacheMiss: '#f59e0b', output: '#3b82f6' }

const costChartOption = computed(() => {
  const dates = costDays.value.map((d) => d.date.slice(5))
  return {
    grid,
    tooltip: {
      trigger: 'axis',
      confine: true,
      ...tt(),
      formatter: (params) => {
        if (!params?.length) return ''
        let sum = 0
        const sorted = [...params].sort((a, b) => {
          const o = {
            'deepseek-v4-pro': 0,
            'deepseek-v4-flash': 1,
            'deepseek-chat & deepseek-reasoner': 2,
          }
          return (o[a.seriesName] ?? 9) - (o[b.seriesName] ?? 9)
        })
        for (const p of sorted) sum += p.value
        let html =
          '<div style="min-width:120px">' +
          '<div style="font-weight:600;margin-bottom:4px;font-size:12px">' +
          params[0].axisValue +
          '</div>'
        for (const p of sorted) {
          if (p.value > 0)
            html +=
              '<div style="display:flex;justify-content:space-between;gap:48px;font-size:11px"><span>' +
              p.marker +
              ' ' +
              (costNames[p.seriesName] || p.seriesName) +
              '</span><span>' +
              p.value.toFixed(2) +
              ' ¥</span></div>'
        }
        html +=
          '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:4px;font-weight:600;font-size:11px;display:flex;justify-content:space-between"><span>总计</span><span>' +
          sum.toFixed(2) +
          ' ¥</span></div>'
        html += '</div>'
        return html
      },
    },
    xAxis: xAxis(dates),
    yAxis: yAxisCost(),
    legend: { show: false },
    series: costOrder.map((m) => ({
      name: m,
      type: 'bar',
      stack: 'cost',
      data: costDays.value.map((d) => d.byModel?.[m] || 0),
      itemStyle: { color: costColors[m] },
      barMaxWidth: 12,
    })),
  }
})

function tokenChartOption(model) {
  return computed(() => ({
    grid,
    tooltip: {
      trigger: 'axis',
      confine: true,
      ...tt(),
      formatter: (params) => {
        if (!params?.length) return ''
        let total = 0,
          hit = 0,
          miss = 0
        for (const p of params) {
          total += p.value
          if (p.seriesName === 'cacheHit') hit = p.value
          if (p.seriesName === 'cacheMiss') miss = p.value
        }
        const hitRate = hitPct(hit, miss)
        let html =
          '<div style="min-width:140px"><div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:4px;font-size:12px"><span>' +
          params[0].axisValue +
          '</span><span style="font-weight:400;font-size:10px;opacity:0.85;color:#4ade80">' +
          hitRate +
          '%缓存命中</span></div>'
        const labels = { cacheHit: '输入(命中)', cacheMiss: '输入(未命中)', output: '输出' }
        for (const p of params) {
          if (p.value > 0) {
            html +=
              '<div style="display:flex;justify-content:space-between;gap:48px;font-size:11px"><span>' +
              p.marker +
              ' ' +
              labels[p.seriesName] +
              '</span><span>' +
              Math.round(p.value).toLocaleString('en-US') +
              '</span></div>'
          }
        }
        html +=
          '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:4px;padding-top:4px;font-weight:600;font-size:11px;display:flex;justify-content:space-between"><span>合计</span><span>' +
          Math.round(total).toLocaleString('en-US') +
          ' tokens</span></div>'
        html += '</div>'
        return html
      },
    },
    xAxis: xAxis(tokenDays.value.map((d) => d.date.slice(5))),
    yAxis: yAxisTokens(),
    legend: { show: false },
    series: ['cacheHit', 'cacheMiss', 'output'].map((type) => ({
      name: type,
      type: 'bar',
      stack: 'tok',
      data: tokenDays.value.map((d) => d.byModel?.[model]?.[type] || 0),
      itemStyle: { color: tokenColors[type] },
      barMaxWidth: 12,
    })),
  }))
}

const tokenProChartOption = tokenChartOption('deepseek-v4-pro')
const tokenFlashChartOption = tokenChartOption('deepseek-v4-flash')

// ---- 月度汇总 - 堆叠柱状图（谁消耗多谁靠上） ----
const monthlyTotalBreakdown = computed(() => {
  return tokenDays.value.reduce(
    (acc, d) => {
      for (const model of Object.values(d.byModel || {})) {
        acc.cacheHit += model.cacheHit || 0
        acc.cacheMiss += model.cacheMiss || 0
        acc.output += model.output || 0
      }
      return acc
    },
    { cacheHit: 0, cacheMiss: 0, output: 0 },
  )
})

const monthlyV4ProBreakdown = computed(() => {
  return tokenDays.value.reduce(
    (acc, d) => {
      const m = d.byModel?.['deepseek-v4-pro']
      if (!m) return acc
      return {
        cacheHit: acc.cacheHit + (m.cacheHit || 0),
        cacheMiss: acc.cacheMiss + (m.cacheMiss || 0),
        output: acc.output + (m.output || 0),
      }
    },
    { cacheHit: 0, cacheMiss: 0, output: 0 },
  )
})

const monthlyV4FlashBreakdown = computed(() => {
  return tokenDays.value.reduce(
    (acc, d) => {
      const m = d.byModel?.['deepseek-v4-flash']
      if (!m) return acc
      return {
        cacheHit: acc.cacheHit + (m.cacheHit || 0),
        cacheMiss: acc.cacheMiss + (m.cacheMiss || 0),
        output: acc.output + (m.output || 0),
      }
    },
    { cacheHit: 0, cacheMiss: 0, output: 0 },
  )
})

const consumptionChartOption = computed(() => {
  const l = isLight.value
  const labels = ['总消耗', 'v4-pro', 'v4-flash']
  const colors = ['#6366f1', '#8b5cf6', '#0ea5e9']

  let values, breakdowns
  if (isMonthly.value) {
    const t = monthlyTotalBreakdown.value
    const p = monthlyV4ProBreakdown.value
    const f = monthlyV4FlashBreakdown.value
    values = [
      t.cacheHit + t.cacheMiss + t.output,
      p.cacheHit + p.cacheMiss + p.output,
      f.cacheHit + f.cacheMiss + f.output,
    ]
    breakdowns = [t, p, f]
  } else {
    const d = tokenDays.value.find((dd) => dd.date === todayDate.value)
    const pm = d?.byModel?.['deepseek-v4-pro'] || {}
    const fm = d?.byModel?.['deepseek-v4-flash'] || {}
    values = [
      tokenProToday.value + tokenFlashToday.value,
      tokenProToday.value,
      tokenFlashToday.value,
    ]
    breakdowns = [
      { cacheHit: todayCacheHit.value, cacheMiss: todayCacheMiss.value, output: todayOutput.value },
      { cacheHit: pm.cacheHit || 0, cacheMiss: pm.cacheMiss || 0, output: pm.output || 0 },
      { cacheHit: fm.cacheHit || 0, cacheMiss: fm.cacheMiss || 0, output: fm.output || 0 },
    ]
  }

  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      ...tt(),
      formatter: (params) => {
        const p = params[0]
        if (!p) return ''
        const b = breakdowns[p.dataIndex]
        const borderColor = l ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'
        const hitRate = hitPct(b.cacheHit, b.cacheMiss)
        const items = [
          ['输入(命中)', b.cacheHit, '#22c55e'],
          ['输入(未命中)', b.cacheMiss, '#f59e0b'],
          ['输出', b.output, '#3b82f6'],
        ]
        let html = `<div style="min-width:150px"><div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:4px;font-size:12px"><span>${p.name}</span><span style="font-weight:400;font-size:10px;opacity:0.85;color:#4ade80">${hitRate}%缓存命中</span></div>`
        for (const [name, val, color] of items) {
          if (val > 0)
            html += `<div style="display:flex;justify-content:space-between;gap:48px;font-size:11px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:4px"></span>${name}</span><span>${Math.round(val).toLocaleString('en-US')}</span></div>`
        }
        html += `<div style="border-top:1px solid ${borderColor};margin-top:4px;padding-top:4px;font-weight:600;font-size:11px;display:flex;justify-content:space-between"><span>合计</span><span>${Math.round(p.value).toLocaleString('en-US')} tokens</span></div>`
        html += '</div>'
        return html
      },
    },
    grid: { top: 8, right: 65, bottom: 0, left: 54 },
    xAxis: {
      type: 'value',
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: l ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel: {
        color: l ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: 600,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 7,
        data: labels.map((_, i) => ({
          value: values[i],
          itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] },
        })),
        label: {
          show: true,
          position: 'right',
          formatter: (p) => Math.round(p.value).toLocaleString('en-US'),
          fontSize: 10,
          color: l ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)',
        },
      },
    ],
  }
})

function fmt(val) {
  if (val === undefined || val === null) return '0.00'
  const n = parseFloat(val)
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

async function onMonthChange() {
  usageError.value = ''
  isRefreshing.value = true
  try {
    const [y, m] = selectedMonth.value.split('-').map(Number)
    const usage = await window.electronAPI.getUsageForMonth(y, m)
    if (usage.error) usageError.value = usage.error
    else usageData.value = usage
  } catch (err) {
    usageError.value = err.message
  } finally {
    setTimeout(() => { isRefreshing.value = false }, 600)
  }
}

function openUsage() {
  window.electronAPI.openExternal('https://platform.deepseek.com/usage')
}
function openChat() {
  window.electronAPI.openExternal('https://chat.deepseek.com/')
}
function openSettings() {
  window.electronAPI.openSettings()
}
function quitApp() {
  window.electronAPI.quitApp()
}

function onScroll() {
  scrolled.value = panelRef.value?.scrollTop > 8
}

// 首次加载用 loading，后续静默更新
const isFirstMount = ref(true)

async function refresh(silent) {
  if (!silent) {
    if (isFirstMount.value) {
      initialLoading.value = true
    } else {
      isRefreshing.value = true
    }
  }
  todayDate.value = new Date().toISOString().slice(0, 10)
  balanceError.value = ''
  usageError.value = ''
  try {
    const [bal, usage] = await Promise.all([
      window.electronAPI.getBalance(),
      window.electronAPI.getUsage(),
    ])
    if (bal.error) {
      balanceError.value = bal.error
    } else {
      balanceData.value = bal
    }
    if (usage.error) {
      usageError.value = usage.error
    } else {
      usageData.value = usage
    }
  } catch (err) {
    balanceError.value = err.message
  } finally {
    if (!silent) {
      initialLoading.value = false
      isFirstMount.value = false
      setTimeout(() => { isRefreshing.value = false }, 600)
    }
  }
}

onMounted(async () => {
  const theme = await window.electronAPI.getEffectiveTheme()
  isLight.value = theme === 'light'
  document.documentElement.setAttribute('data-theme', theme)

  try {
    const s = await window.electronAPI.getSettings()
    if (s.dailyCostLow != null)
      dailyCostThres.value = { low: s.dailyCostLow, med: s.dailyCostMed, high: s.dailyCostHigh }
  } catch (_) { }

  refresh(false)
  window.electronAPI.onDataUpdate(({ balance, usage }) => {
    todayDate.value = new Date().toISOString().slice(0, 10)
    if (balance?.error) {
      balanceError.value = balance.error
    } else if (balance) {
      balanceData.value = balance
      balanceError.value = ''
    }
    const now = new Date()
    const cur = now.getFullYear() + '-' + (now.getMonth() + 1)
    if (selectedMonth.value === cur) {
      if (usage?.error) {
        usageError.value = usage.error
      } else if (usage) {
        usageData.value = usage
        usageError.value = ''
      }
    }
  })
  window.electronAPI.onThemeChange((t) => {
    isLight.value = t === 'light'
    document.documentElement.setAttribute('data-theme', t)
  })
})

onUnmounted(() => {
  window.electronAPI.removeDataUpdateListener()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
  font-size: 13px;
  color: #f5f5f7;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

.flex-bc {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0 12px 4px;
  overflow-y: auto;
  background: rgba(26, 26, 46, 0.58);
}

/* ---- header ---- */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  position: sticky;
  top: 0;
  margin: 0 -12px 0;
  background: transparent;
  border-bottom: 0.5px solid transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  z-index: 10;
  transition:
    background 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    backdrop-filter 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    padding 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.header.scrolled {
  background: rgba(20, 20, 30, 0.72);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.15);
  padding-top: 8px;
  padding-bottom: 6px;
}

.title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: rgba(255, 255, 255, 1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1px;
}

.btn-icon,
.btn-icon-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-icon {
  width: 28px;
  height: 28px;
}

.btn-icon-sm {
  width: 24px;
  height: 24px;
}

.btn-icon.spinning svg {
  animation: spin 0.7s ease-in-out;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.refreshing-overlay {
  pointer-events: none;
  background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.06) 50%, transparent 75%) !important;
  background-size: 200% 100% !important;
  animation: shimmer 0.8s ease-in-out;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.btn-icon:hover,
.btn-icon-sm:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 1);
}

/* ---- cards ---- */
.card {
  background: rgba(255, 255, 255, 0.06);
  border: 0.5px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.12),
    0 4px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}

.card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  /* text-transform: uppercase; */
  letter-spacing: 0.6px;
}

.warn {
  font-size: 12px;
}

.balance-card {
  background: rgba(255, 255, 255, 0.07);
}

.balance-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
}

.balance-num {
  font-size: 30px;
  font-weight: 700;
  color: #2dd4bf;
  letter-spacing: -0.8px;
  line-height: 1;
}

.balance-unit {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.72);
}

.balance-cost {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
  font-weight: 500;
}

.cost-badge {
  display: inline-block;
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  padding: 1px 8px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: -0.1px;
}

.chart-card .label {
  display: block;
  margin-bottom: 4px;
}

.label-today {
  font-weight: 400;
  color: rgba(255, 255, 255, 0.62);
  text-transform: none;
  letter-spacing: 0;
  font-size: 10px;
}

.chart {
  width: 100%;
  height: 90px;
}

.chart-hbar {
  width: 100%;
  height: 80px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hit-rate {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.38);
  white-space: nowrap;
}

.hit-rate-val {
  font-weight: 700;
  color: #22c55e;
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.4px;
  transition: color 0.2s;
}

.toggle-label.active {
  color: rgba(255, 255, 255, 0.85);
}

.toggle-switch-sm {
  position: relative;
  width: 26px;
  height: 15px;
  cursor: pointer;
}

.toggle-switch-sm input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider-sm {
  position: absolute;
  inset: 0;
  background: #22c55e;
  border-radius: 9px;
  transition: background 0.2s;
}

.toggle-slider-sm::before {
  content: '';
  position: absolute;
  width: 11px;
  height: 11px;
  left: 2px;
  top: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.toggle-switch-sm input:checked+.toggle-slider-sm {
  background: #3b82f6;
}

.toggle-switch-sm input:checked+.toggle-slider-sm::before {
  transform: translateX(11px);
}

.year-picker,
.month-picker {
  background: rgba(255, 255, 255, 0.08);
  border: 0.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 11px;
  font-family: inherit;
  padding: 2px 4px;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  text-align: center;
}

.year-picker {
  width: 54px;
}

.month-picker {
  width: 65px;
}

.year-picker:focus,
.month-picker:focus {
  border-color: rgba(100, 160, 255, 0.45);
}

.year-picker option,
.month-picker option {
  background: #1c1c1e;
  color: #f5f5f7;
}

.placeholder-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.58);
  line-height: 1.4;
  margin-top: 2px;
}

.status {
  text-align: center;
  padding: 40px 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.status.error {
  color: #ff453a;
}

.panel::-webkit-scrollbar {
  display: none;
}

/* ---- light theme ---- */
[data-theme='light'] body {
  color: #1d1d1f;
}

[data-theme='light'] .panel {
  background: rgba(250, 250, 249, 0.54);
}

[data-theme='light'] .header {
  background: transparent;
  border-bottom: 0.5px solid transparent;
}

[data-theme='light'] .header.scrolled {
  background: rgba(250, 250, 249, 0.88);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}

[data-theme='light'] .title {
  color: rgba(0, 0, 0, 0.85);
}

[data-theme='light'] .btn-icon,
[data-theme='light'] .btn-icon-sm {
  color: rgba(0, 0, 0, 0.45);
}

[data-theme='light'] .btn-icon:hover,
[data-theme='light'] .btn-icon-sm:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.8);
}

[data-theme='light'] .card {
  background: rgba(255, 255, 255, 0.55);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 2px 8px rgba(0, 0, 0, 0.03);
}

[data-theme='light'] .balance-card {
  background: rgba(255, 255, 255, 0.62);
}

[data-theme='light'] .label {
  color: rgba(0, 0, 0, 0.5);
}

[data-theme='light'] .balance-num {
  color: #0d9488;
}

[data-theme='light'] .balance-unit {
  color: rgba(0, 0, 0, 0.45);
}

[data-theme='light'] .balance-cost {
  color: rgba(0, 0, 0, 0.35);
}

[data-theme='light'] .label-today {
  color: rgba(0, 0, 0, 0.35);
}

[data-theme='light'] .toggle-label {
  color: rgba(0, 0, 0, 0.3);
}

[data-theme='light'] .hit-rate {
  color: rgba(0, 0, 0, 0.3);
}

[data-theme='light'] .toggle-label.active {
  color: rgba(0, 0, 0, 0.7);
}

[data-theme='light'] .toggle-slider-sm {
  background: #22c55e;
}

[data-theme='light'] .placeholder-text {
  color: rgba(0, 0, 0, 0.3);
}

[data-theme='light'] .year-picker,
[data-theme='light'] .month-picker {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.6);
}

[data-theme='light'] .year-picker:focus,
[data-theme='light'] .month-picker:focus {
  border-color: rgba(0, 122, 255, 0.45);
}

[data-theme='light'] .year-picker option,
[data-theme='light'] .month-picker option {
  background: #f5f5f7;
  color: #1d1d1f;
}

[data-theme='light'] .status {
  color: rgba(0, 0, 0, 0.5);
}
</style>
