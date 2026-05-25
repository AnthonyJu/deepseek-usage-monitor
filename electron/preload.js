const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 余额 (API Key)
  getBalance: () => ipcRenderer.invoke('get-balance'),

  // 平台用量 (Web Token)
  getUsage: () => ipcRenderer.invoke('get-usage'),
  getUsageForMonth: (year, month) => ipcRenderer.invoke('get-usage-for-month', year, month),

  // 主进程推送数据更新
  onDataUpdate: (cb) => {
    ipcRenderer.on('data-update', (_e, data) => cb(data));
  },
  removeDataUpdateListener: () => {
    ipcRenderer.removeAllListeners('data-update');
  },

  // 设置
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // Web Token 管理
  saveWebToken: (token) => ipcRenderer.invoke('save-web-token', token),
  removeWebToken: () => ipcRenderer.invoke('remove-web-token'),

  // 开机自启
  toggleAutoLaunch: (enabled) => ipcRenderer.invoke('toggle-auto-launch', enabled),

  // 自动刷新
  setAutoRefreshInterval: (minutes) => ipcRenderer.invoke('set-auto-refresh-interval', minutes),

  // 预警阈值
  setBalanceThreshold: (val) => ipcRenderer.invoke('set-balance-threshold', val),
  setDailyCostThresholds: ({ low, med, high }) => ipcRenderer.invoke('set-daily-cost-thresholds', { low, med, high }),

  // 主题
  getEffectiveTheme: () => ipcRenderer.invoke('get-effective-theme'),
  setColorScheme: (scheme) => ipcRenderer.invoke('set-color-scheme', scheme),
  onThemeChange: (cb) => ipcRenderer.on('theme-changed', (_e, theme) => cb(theme)),

  // 剪贴板
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),

  // 窗口操作
  openSettings: () => ipcRenderer.invoke('open-settings'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
