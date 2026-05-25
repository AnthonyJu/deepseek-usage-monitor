const {
  app,
  Tray,
  BrowserWindow,
  ipcMain,
  nativeImage,
  safeStorage,
  Menu,
  Notification,
  shell,
  nativeTheme,
  clipboard,
} = require('electron')
const path = require('path')
const Store = require('electron-store')
const fs = require('fs')

// ---------------------------------------------------------------------------
// 持久化存储
// ---------------------------------------------------------------------------
const store = new Store({
  defaults: {
    autoRefreshInterval: 2,
    balanceThreshold: 10,
    dailyCostLow: 2,
    dailyCostMed: 5,
    dailyCostHigh: 8,
    autoLaunch: false,
    colorScheme: 'system',
  },
})

// ---------------------------------------------------------------------------
// 全局引用
// ---------------------------------------------------------------------------
const appIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'public', 'logo.png'))

function showNotification(title, body) {
  new Notification({ title, body, icon: appIcon }).show()
}

let tray = null
let trayWindow = null
let settingsWindow = null
let refreshTimer = null
let isQuitting = false
let hasAlertedLowBalance = false
let hasAlertedDailyLow = false
let hasAlertedDailyMed = false
let hasAlertedDailyHigh = false

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
function getDecryptedField(name) {
  try {
    const hex = store.get(name)
    if (!hex) return null
    return safeStorage.decryptString(Buffer.from(hex, 'hex'))
  } catch {
    return null
  }
}

function saveEncryptedField(name, value) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage 不可用')
  }
  const encrypted = safeStorage.encryptString(value)
  store.set(name, encrypted.toString('hex'))
}

function getWebToken() {
  return getDecryptedField('encryptedWebToken')
}

function applyColorScheme() {
  const scheme = store.get('colorScheme', 'system')
  nativeTheme.themeSource = scheme
  broadcastTheme()
}

function getEffectiveTheme() {
  const scheme = store.get('colorScheme', 'system')
  if (scheme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return scheme
}

function broadcastTheme() {
  const theme = getEffectiveTheme()
  for (const win of [trayWindow, settingsWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send('theme-changed', theme)
  }
}

// ---------------------------------------------------------------------------
// 平台 API 请求通用函数
// ---------------------------------------------------------------------------
const PLATFORM = 'https://platform.deepseek.com'
const WEB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

async function platformGet(path, webToken) {
  const res = await fetch(PLATFORM + path, {
    headers: {
      'Authorization': 'Bearer ' + webToken,
      'User-Agent': WEB_UA,
      'Referer': PLATFORM + '/usage',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 200))
  }
  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.msg || 'API error code ' + json.code)
  }
  return json.data?.biz_data || json.data
}

// ---------------------------------------------------------------------------
// 调用平台 API 获取余额 (platform.deepseek.com)
// ---------------------------------------------------------------------------
async function fetchBalance() {
  const webToken = getWebToken()
  if (!webToken) return { error: '网页 Token 未设置' }

  console.log('[Balance] 查询中 (platform API)...')

  try {
    const summary = await platformGet('/api/v0/users/get_user_summary', webToken)
    const normalBal = (summary?.normal_wallets || []).reduce(
      (s, w) => s + (parseFloat(w.balance) || 0),
      0,
    )
    const bonusBal = (summary?.bonus_wallets || []).reduce(
      (s, w) => s + (parseFloat(w.balance) || 0),
      0,
    )
    const total = normalBal + bonusBal
    console.log('[Balance] 成功, ¥' + total.toFixed(2))
    return {
      is_available: true,
      balance_infos: [{ total_balance: String(total), granted_balance: String(bonusBal) }],
    }
  } catch (err) {
    console.error('[Balance] 错误:', err.message)
    return { error: '余额查询失败: ' + err.message }
  }
}

// ---------------------------------------------------------------------------
// 调用平台用量 API (platform.deepseek.com)
// ---------------------------------------------------------------------------
async function fetchUsageData(year, month) {
  const webToken = getWebToken()
  if (!webToken) return { error: '网页 Token 未设置' }

  console.log('[Usage] 查询平台用量...')

  try {
    const now = new Date()
    const m = month || now.getMonth() + 1
    const y = year || now.getFullYear()

    const [summary, costData, amountData] = await Promise.all([
      platformGet('/api/v0/users/get_user_summary', webToken),
      platformGet('/api/v0/usage/cost?month=' + m + '&year=' + y, webToken),
      platformGet('/api/v0/usage/amount?month=' + m + '&year=' + y, webToken),
    ])

    // cost API → 花费 (CNY); amount API → token 数
    const costDays = (costData?.[0]?.days || costData?.days || []).map((d) => {
      const byModel = {}
      let total = 0
      for (const m of d.data || []) {
        const v = m.usage.reduce((s, u) => s + (parseFloat(u.amount) || 0), 0)
        byModel[m.model] = Math.round(v * 100) / 100 // 精确到分
        total += v
      }
      return { date: d.date, total: Math.round(total * 100) / 100, byModel }
    })

    const amountDays = amountData?.[0]?.days || amountData?.days || []

    function usageVal(usage, type) {
      const u = usage.find((u) => u.type === type)
      return u ? parseInt(u.amount) || 0 : 0
    }

    const tokenDays = amountDays.map((d) => {
      const byModel = {}
      for (const m of d.data || []) {
        if (m.model === 'deepseek-v4-pro' || m.model === 'deepseek-v4-flash') {
          byModel[m.model] = {
            cacheHit: usageVal(m.usage, 'PROMPT_CACHE_HIT_TOKEN'),
            cacheMiss: usageVal(m.usage, 'PROMPT_CACHE_MISS_TOKEN'),
            output: usageVal(m.usage, 'RESPONSE_TOKEN'),
          }
        }
      }
      return { date: d.date, byModel }
    })

    console.log('[Usage] 平台数据获取成功, ' + costDays.length + ' 天')
    return { summary, costDays, tokenDays }
  } catch (err) {
    console.error('[Usage] 错误:', err.message)
    return { error: '平台数据获取失败: ' + err.message }
  }
}

// ---------------------------------------------------------------------------
// 验证凭证
// ---------------------------------------------------------------------------
async function validateWebToken(token) {
  try {
    await platformGet('/api/v0/users/get_user_summary', token)
    return { valid: true }
  } catch (err) {
    return { valid: false, message: err.message }
  }
}

// ---------------------------------------------------------------------------
// 余额预警
// ---------------------------------------------------------------------------
function checkBalanceAlert(data) {
  const threshold = store.get('balanceThreshold')
  if (!threshold) {
    hasAlertedLowBalance = false
    return
  }

  const info = data?.balance_infos?.[0]
  if (!info) return

  const total = parseFloat(info.total_balance) || 0

  if (total < threshold && !hasAlertedLowBalance) {
    hasAlertedLowBalance = true
    showNotification(
      'DeepSeek Usage Monitor',
      '余额不足！当前 ¥' + total.toFixed(2) + '，低于阈值 ¥' + threshold.toFixed(2),
    )
    console.log('[Alert] ¥' + total.toFixed(2) + ' < ¥' + threshold.toFixed(2))
  } else if (total >= threshold) {
    hasAlertedLowBalance = false
  }
}

function checkDailyCostAlert(usageData) {
  const low = store.get('dailyCostLow', 2)
  const med = store.get('dailyCostMed', 5)
  const high = store.get('dailyCostHigh', 8)
  if (usageData?.error) return

  const today = new Date().toISOString().slice(0, 10)
  const todayData = usageData?.costDays?.find((d) => d.date === today)
  const cost = todayData?.total || 0

  const tiers = [
    {
      key: 'hasAlertedDailyLow',
      flag: hasAlertedDailyLow,
      set: (v) => (hasAlertedDailyLow = v),
      threshold: low,
      label: '低档',
    },
    {
      key: 'hasAlertedDailyMed',
      flag: hasAlertedDailyMed,
      set: (v) => (hasAlertedDailyMed = v),
      threshold: med,
      label: '中档',
    },
    {
      key: 'hasAlertedDailyHigh',
      flag: hasAlertedDailyHigh,
      set: (v) => (hasAlertedDailyHigh = v),
      threshold: high,
      label: '高档',
    },
  ]

  for (const t of tiers) {
    if (cost > t.threshold && !t.flag) {
      t.set(true)
      showNotification(
        'DeepSeek Usage Monitor',
        '当日花费已达 ¥' + cost.toFixed(2) + '，超过' + t.label + '阈值 ¥' + t.threshold.toFixed(2),
      )
      console.log(
        '[Alert] daily cost ¥' +
        cost.toFixed(2) +
        ' > ¥' +
        t.threshold.toFixed(2) +
        ' (' +
        t.label +
        ')',
      )
    }
  }

  // 如果花费回落到低档以下，重建所有警戒
  if (cost <= low) {
    hasAlertedDailyLow = false
    hasAlertedDailyMed = false
    hasAlertedDailyHigh = false
  } else if (cost <= med) {
    hasAlertedDailyMed = false
    hasAlertedDailyHigh = false
  } else if (cost <= high) {
    hasAlertedDailyHigh = false
  }
}

// ---------------------------------------------------------------------------
// 自动刷新
// ---------------------------------------------------------------------------
function startAutoRefresh() {
  stopAutoRefresh()
  const minutes = store.get('autoRefreshInterval', 5)
  if (!minutes || minutes <= 0) return

  refreshTimer = setInterval(
    async () => {
      if (!trayWindow || trayWindow.isDestroyed()) return
      const balanceData = await fetchBalance()
      checkBalanceAlert(balanceData)
      const usageData = await fetchUsageData()
      checkDailyCostAlert(usageData)
      if (trayWindow && !trayWindow.isDestroyed()) {
        trayWindow.webContents.send('data-update', { balance: balanceData, usage: usageData })
      }
    },
    minutes * 60 * 1000,
  )
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// ---------------------------------------------------------------------------
// 面板窗口
// ---------------------------------------------------------------------------
function createTrayWindow() {
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

  trayWindow = new BrowserWindow({
    width: 340,
    height: 535,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    trayWindow.loadURL('http://localhost:5173/index.html')
  } else {
    trayWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  trayWindow.on('blur', () => {
    if (trayWindow && !trayWindow.isDestroyed()) trayWindow.hide()
  })

  trayWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      trayWindow.hide()
    }
  })

  trayWindow.webContents.on('console-message', (_event, level, message) => {
    const prefix = ['', 'WARN', 'ERR', ''][level] || 'LOG'
    console.log('[Renderer ' + prefix + '] ' + message)
  })
}

function positionTrayWindow() {
  if (!tray || !trayWindow) return
  const tb = tray.getBounds()
  const wb = trayWindow.getBounds()
  trayWindow.setPosition(
    Math.round(tb.x + tb.width / 2 - wb.width / 2),
    Math.round(tb.y + tb.height),
  )
}

function toggleTrayWindow() {
  if (!trayWindow) return
  if (trayWindow.isVisible()) {
    trayWindow.hide()
  } else {
    positionTrayWindow()
    trayWindow.show()
    trayWindow.focus()
  }
}

// ---------------------------------------------------------------------------
// 设置窗口
// ---------------------------------------------------------------------------
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
  const settingsPath = isDev
    ? path.join(__dirname, '..', 'src', 'settings.html')
    : path.join(__dirname, '..', 'dist', 'settings.html')

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 452,
    title: 'DeepSeek Usage Monitor - 设置',
    resizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    transparent: true,
    vibrancy: 'window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  settingsWindow.setMenuBarVisibility(false)
  settingsWindow.loadFile(settingsPath)

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------
function registerIpcHandlers() {
  // 余额
  ipcMain.handle('get-balance', async () => {
    const data = await fetchBalance()
    checkBalanceAlert(data)
    return data
  })

  // 平台用量
  ipcMain.handle('get-usage', async () => {
    const data = await fetchUsageData()
    checkDailyCostAlert(data)
    return data
  })
  ipcMain.handle('get-usage-for-month', (_e, year, month) => fetchUsageData(year, month))

  // 设置
  ipcMain.handle('get-settings', () => ({
    hasWebToken: !!store.get('encryptedWebToken'),
    autoRefreshInterval: store.get('autoRefreshInterval', 2),
    balanceThreshold: store.get('balanceThreshold'),
    dailyCostLow: store.get('dailyCostLow', 2),
    dailyCostMed: store.get('dailyCostMed', 5),
    dailyCostHigh: store.get('dailyCostHigh', 8),
    autoLaunch: store.get('autoLaunch', false),
    colorScheme: store.get('colorScheme', 'system'),
  }))

  // Web Token
  ipcMain.handle('save-web-token', async (_e, token) => {
    if (!token || !token.trim()) return { success: false, message: '网页 Token 不能为空' }
    const validation = await validateWebToken(token.trim())
    if (!validation.valid) return { success: false, message: '验证失败: ' + validation.message }
    saveEncryptedField('encryptedWebToken', token.trim())
    console.log('[Store] Web Token 已保存')
    startAutoRefresh()
    return { success: true, message: '网页 Token 已保存并验证通过' }
  })

  ipcMain.handle('remove-web-token', () => {
    store.delete('encryptedWebToken')
    console.log('[Store] Web Token 已删除')
    return { success: true }
  })

  // 开机自启
  ipcMain.handle('toggle-auto-launch', (_e, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled })
    store.set('autoLaunch', !!enabled)
    return { success: true, autoLaunch: !!enabled }
  })

  // 自动刷新
  ipcMain.handle('set-auto-refresh-interval', (_e, minutes) => {
    store.set('autoRefreshInterval', minutes)
    startAutoRefresh()
    return { success: true }
  })

  // 预警阈值
  ipcMain.handle('set-balance-threshold', (_e, val) => {
    const v = val === null || val === '' ? null : Number(val)
    store.set('balanceThreshold', v)
    hasAlertedLowBalance = false
    return { success: true }
  })

  ipcMain.handle('set-daily-cost-thresholds', (_e, { low, med, high }) => {
    store.set('dailyCostLow', Number(low) || 2)
    store.set('dailyCostMed', Number(med) || 5)
    store.set('dailyCostHigh', Number(high) || 8)
    hasAlertedDailyLow = false
    hasAlertedDailyMed = false
    hasAlertedDailyHigh = false
    return { success: true }
  })

  ipcMain.handle('set-color-scheme', (_e, scheme) => {
    store.set('colorScheme', scheme)
    applyColorScheme()
    return { success: true }
  })

  ipcMain.handle('get-effective-theme', () => getEffectiveTheme())

  ipcMain.handle('open-settings', () => createSettingsWindow())
  ipcMain.handle('quit-app', () => {
    isQuitting = true
    app.quit()
  })
  ipcMain.handle('read-clipboard', () => clipboard.readText())

  ipcMain.handle('open-external', (_e, url) => shell.openExternal(url))
}

// ---------------------------------------------------------------------------
// App 生命周期
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  registerIpcHandlers()
  applyColorScheme()

  const iconPath = path.join(__dirname, '..', 'public', 'icon.png')
  const icon = fs.existsSync(iconPath) ? iconPath : path.join(__dirname, '..', 'dist', 'icon.png')

  let trayImage
  if (fs.existsSync(icon)) {
    trayImage = nativeImage.createFromPath(icon).resize({ width: 22, height: 22 })
    trayImage.setTemplateImage(true)
  } else {
    console.warn('[Tray] 图标未找到')
    trayImage = nativeImage.createEmpty()
  }
  tray = new Tray(trayImage)

  tray.setToolTip('DeepSeek Usage Monitor · 单击面板 / 双击跳转 Chat')
  tray.setIgnoreDoubleClickEvents(true)

  let clickTimer = null
  tray.on('click', () => {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
      shell.openExternal('https://chat.deepseek.com/')
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null
        toggleTrayWindow()
      }, 200)
    }
  })

  const contextMenu = Menu.buildFromTemplate([
    { label: '设置', click: createSettingsWindow },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu)
  })

  createTrayWindow()
  if (process.platform === 'darwin') app.dock.setIcon(appIcon)
  startAutoRefresh()

    // 启动时立即检查余额和花费预警
    ; (async () => {
      const balanceData = await fetchBalance()
      checkBalanceAlert(balanceData)
      const usageData = await fetchUsageData()
      checkDailyCostAlert(usageData)
    })()

  if (process.platform === 'darwin') app.dock.hide()
})

app.on('window-all-closed', (e) => {
  e.preventDefault()
})

app.on('before-quit', stopAutoRefresh)

nativeTheme.on('updated', broadcastTheme)

app.on('activate', () => {
  if (!trayWindow || trayWindow.isDestroyed()) createTrayWindow()
  toggleTrayWindow()
})
