# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

macOS 菜单栏 Electron 应用，监控 DeepSeek API 余额与用量。单窗口 Tray 面板 + 独立设置窗口，无路由。

## Commands

```bash
pnpm install              # 安装依赖
pnpm electron:dev         # 开发模式（Vite + Electron 并行启动）
pnpm build                # 仅构建前端（Vite build + 复制 settings.html）
pnpm electron:build       # 打包 macOS DMG
```

无测试框架，无 lint 配置。

## Architecture

**Electron 主进程** (`electron/main.js`, ~630 行)
- 所有业务逻辑集中在主进程：API 请求、数据转换、预警检查、自动刷新、持久化存储
- API 调用走 `platform.deepseek.com`，使用用户提供的 Web Token（`safeStorage` 加密存储）
- `electron-store` 持久化设置，`safeStorage` 加密敏感字段
- Tray 单击打开面板，双击跳转 DeepSeek Chat（200ms 延迟区分）

**Preload** (`electron/preload.js`)
- `contextBridge` 暴露 `window.electronAPI`，IPC 通道全在此定义

**渲染进程 - 面板** (`src/App.vue`, ~1166 行)
- 单文件 Vue 3 SFC，`<script setup>` + Composition API
- ECharts 图表（vue-echarts），按需引入组件
- 通过 `window.electronAPI` 与主进程通信，`onDataUpdate` 接收自动刷新推送
- 主题由主进程通过 `theme-changed` 事件下发

**渲染进程 - 设置** (`src/settings.html`, ~757 行)
- 独立 HTML 页面，纯 vanilla JS，不使用 Vue
- 同样通过 `window.electronAPI` 通信
- `build` 时被复制到 `dist/`，生产环境通过 `loadFile` 加载

**关键数据流**
1. 渲染进程调用 `electronAPI.getBalance()` / `electronAPI.getUsage()` → IPC invoke → 主进程请求 DeepSeek API → 返回数据
2. 自动刷新：主进程 `setInterval` → 请求 API → `webContents.send('data-update')` → 渲染进程监听更新
3. 预警：主进程在获取数据后自动检查余额/花费阈值 → `Notification` 弹通知

## Key Conventions

- 包管理器：pnpm（`.npmrc` 配置了 `onlyBuiltDependencies`）
- 前端无构建工具链以外的配置（无 TypeScript、无 ESLint、无测试）
- 设置页是纯 HTML/CSS/JS，不走 Vue/Vite 构建
- 深色/浅色主题：CSS 变量 + `prefers-color-scheme`，主进程通过 `nativeTheme` 控制
- Vite 别名：`@` → `src/`
