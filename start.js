// ==================== 初始化 ====================
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 在 ES 模块中定义 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== 动态导入依赖（在依赖检查完成后）====================
// 使用动态导入，避免在模块解析时检查依赖
const expressModule = await import("express");
const express = expressModule.default;
const wsModule = await import("ws");
const WebSocket = wsModule.default || wsModule;
const axiosModule = await import("axios");
const axios = axiosModule.default || axiosModule;
const maxmindModule = await import("maxmind");
const maxmind = maxmindModule.default || maxmindModule;

// Node.js 内置模块可以静态导入
import https from "https";
import tls from "tls";
import dns from "dns";

const dnsLookup = promisify(dns.lookup);
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolveCname = promisify(dns.resolveCname);
const dnsResolve = promisify(dns.resolve);

// 异步文件操作
const readFile = promisify(fs.readFile);
const access = promisify(fs.access);

// 检查文件是否存在（异步）
async function fileExists(filePath) {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ==================== 配置参数 ====================
// 服务器配置
const PORT = parseInt(process.env.PORT) || 8888;

// 缓存和速率限制配置
const CACHE_DURATION = 30000; // 缓存持续时间（毫秒）- 30秒
const MAX_REQUESTS_PER_IP = 60; // 每个IP每分钟最大请求数
const RATE_LIMIT_WINDOW = 60000; // 速率限制时间窗口（毫秒）- 1分钟

// 检测超时配置
const TLS_TIMEOUT = 3000; // TLS/HTTPS 连接超时（毫秒）
const WEBSOCKET_TIMEOUT = 3000; // WebSocket 连接超时（毫秒）
const CDN_TRACE_TIMEOUT = 3000; // CDN Trace 请求超时（毫秒）

// 功能开关配置
const DISABLE_WEBSOCKET = process.env.DISABLE_WEBSOCKET === 'false'; // 禁用 WebSocket 检测（用于云平台）
const DISABLE_CDN_TRACE = process.env.DISABLE_CDN_TRACE === 'false'; // 禁用 CDN Trace 检测

// DNS 解析配置
const DNS_MAX_RECURSION_DEPTH = 10; // CNAME 递归解析最大深度

// 默认值配置
const DEFAULT_PORT = 443; // 默认端口
const DEFAULT_HOST = "n.ccv.cc.cd"; // 默认 Host (SNI)
const DEFAULT_WS_PATH = "/"; // 默认 WebSocket 路径

// 内存管理配置
const MEMORY_CHECK_INTERVAL = 300000; // 内存检查间隔（毫秒）- 5分钟
const MEMORY_CLEANUP_THRESHOLD = 200; // 内存清理阈值（MB）- 堆内存使用超过此值时触发清理
const MEMORY_CRITICAL_THRESHOLD = 280; // 内存严重阈值（MB）- 堆内存使用超过此值时强制清理
const MEMORY_CLEANUP_INTERVAL = 60000; // 内存清理间隔（毫秒）- 1分钟

// 日志配置（仅输出到控制台，不保存文件）
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO'; // 日志级别: DEBUG, INFO, WARN, ERROR
const LOG_ENABLE_COLOR = process.platform !== 'win32' || process.env.CI !== 'true'; // 日志颜色支持
// 检测过程的详细日志（设置为false可减少日志输出）
const ENABLE_DETECTION_DEBUG = process.env.ENABLE_DETECTION_DEBUG === 'true'; // 是否显示检测过程的DEBUG日志
// 静默模式（不输出任何检测内容，只输出启动信息和严重错误）
const QUIET_MODE = process.env.QUIET_MODE === 'true'; // 静默模式：不输出检测相关日志

// ==================== 配置参数结束 ====================

// ------------------- 日志系统（仅输出到控制台，不保存文件）-------------------
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLogLevel = LOG_LEVELS[LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO;

// 颜色代码（仅用于控制台输出）
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function getColor(colorName) {
  return LOG_ENABLE_COLOR ? colors[colorName] || '' : '';
}

function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
}

function formatData(data) {
  if (data === null || data === undefined) return '';
  if (typeof data !== 'object') return String(data);

  // 格式化对象数据，使其更易读
  const entries = Object.entries(data);
  if (entries.length === 0) return '';

  // 对于单行显示，使用简洁格式
  const formatted = entries.map(([key, value]) => {
    if (value === null || value === undefined) return `${key}=null`;
    if (typeof value === 'object') return `${key}=${JSON.stringify(value)}`;
    return `${key}=${value}`;
  }).join(', ');

  return `{ ${formatted} }`;
}

function log(level, message, data = null) {
  const levelNum = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  if (levelNum < currentLogLevel) return;

  const timestamp = formatTimestamp();
  let color = '';
  let prefix = '';

  switch (level) {
    case 'DEBUG':
      color = getColor('dim');
      prefix = 'DEBUG';
      break;
    case 'INFO':
      color = getColor('cyan');
      prefix = 'INFO ';
      break;
    case 'WARN':
      color = getColor('yellow');
      prefix = 'WARN ';
      break;
    case 'ERROR':
      color = getColor('red');
      prefix = 'ERROR';
      break;
  }

  const resetColor = getColor('reset');
  let logMessage = `${color}[${timestamp}] [${prefix}]${resetColor} ${message}`;

  if (data !== null && data !== undefined) {
    const formattedData = formatData(data);
    if (formattedData) {
      logMessage += ` ${formattedData}`;
    }
  }

  // 根据日志级别选择输出方法
  if (level === 'ERROR') {
    console.error(logMessage);
  } else if (level === 'WARN') {
    console.warn(logMessage);
  } else {
    console.log(logMessage);
  }
}

// 日志快捷方法
const logger = {
  debug: (msg, data) => log('DEBUG', msg, data),
  info: (msg, data) => log('INFO', msg, data),
  warn: (msg, data) => log('WARN', msg, data),
  error: (msg, data) => log('ERROR', msg, data)
};

// ------------------- 内存管理模块 --------------------
let memoryStats = {
  lastCheck: Date.now(),
  cleanupCount: 0,
  lastCleanup: Date.now(),
  peakHeapUsed: 0,
  peakRss: 0
};

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024)
  };
}

function logMemoryUsage(context = '') {
  const mem = getMemoryUsage();
  const contextText = context ? ` ${context}` : '';
  logger.info(`内存使用${contextText}`, {
    heap: `${mem.heapUsed}/${mem.heapTotal} MB`,
    rss: `${mem.rss} MB`,
    cache: requestCache.size,
    rateLimit: rateLimitMap.size
  });

  // 更新峰值记录
  if (mem.heapUsed > memoryStats.peakHeapUsed) {
    memoryStats.peakHeapUsed = mem.heapUsed;
  }
  if (mem.rss > memoryStats.peakRss) {
    memoryStats.peakRss = mem.rss;
  }
}

function performMemoryCleanup(force = false) {
  const mem = getMemoryUsage();
  const now = Date.now();

  logger.info('开始内存清理', {
    heapUsed: `${mem.heapUsed} MB`,
    cacheSize: requestCache.size,
    rateLimitSize: rateLimitMap.size,
    force
  });

  let cleanedCount = 0;
  const startTime = Date.now();

  // 1. 清理过期缓存
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      requestCache.delete(key);
      cleanedCount++;
    }
  }

  // 2. 清理过期的速率限制记录
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.firstRequest > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key);
      cleanedCount++;
    }
  }

  // 3. 强制清理：如果内存使用过高，清理更多缓存
  if (force || mem.heapUsed > MEMORY_CLEANUP_THRESHOLD) {
    // 清理最旧的一半缓存
    if (requestCache.size > 500) {
      const entries = Array.from(requestCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, Math.floor(entries.length / 2));
      toDelete.forEach(([key]) => {
        requestCache.delete(key);
        cleanedCount++;
      });
    }

    // 清理最旧的速率限制记录
    if (rateLimitMap.size > 2500) {
      const entries = Array.from(rateLimitMap.entries())
        .sort((a, b) => a[1].firstRequest - b[1].firstRequest);
      const toDelete = entries.slice(0, Math.floor(entries.length / 2));
      toDelete.forEach(([key]) => {
        rateLimitMap.delete(key);
        cleanedCount++;
      });
    }
  }

  // 4. 严重内存压力：强制垃圾回收（如果可用）
  if (mem.heapUsed > MEMORY_CRITICAL_THRESHOLD && global.gc) {
    logger.warn('内存使用过高，执行强制垃圾回收', { heapUsed: `${mem.heapUsed} MB` });
    try {
      global.gc();
    } catch (err) {
      logger.error('垃圾回收失败', err.message);
    }
  }

  const duration = Date.now() - startTime;
  memoryStats.cleanupCount++;
  memoryStats.lastCleanup = now;

  const memAfter = getMemoryUsage();
  logger.info('内存清理完成', {
    cleaned: cleanedCount,
    duration: `${duration}ms`,
    heapUsedBefore: `${mem.heapUsed} MB`,
    heapUsedAfter: `${memAfter.heapUsed} MB`,
    cacheSize: requestCache.size,
    rateLimitSize: rateLimitMap.size
  });

  return cleanedCount;
}

// 定期内存检查和清理
let memoryCheckCounter = 0;
setInterval(() => {
  const mem = getMemoryUsage();
  memoryStats.lastCheck = Date.now();
  memoryCheckCounter++;

  // 每5分钟输出一次内存使用情况（每5次检查输出一次，静默模式下不输出）
  if (memoryCheckCounter % 5 === 0 && !QUIET_MODE) {
    logMemoryUsage('定期检查');
  }

  // 如果内存使用超过阈值，触发清理
  if (mem.heapUsed > MEMORY_CLEANUP_THRESHOLD) {
    logger.warn('内存使用超过阈值，触发自动清理', {
      heap: `${mem.heapUsed} MB`,
      threshold: `${MEMORY_CLEANUP_THRESHOLD} MB`
    });
    performMemoryCleanup(true);
  }

  // 严重内存压力
  if (mem.heapUsed > MEMORY_CRITICAL_THRESHOLD) {
    logger.error('内存使用严重超标，执行强制清理', {
      heap: `${mem.heapUsed} MB`,
      critical: `${MEMORY_CRITICAL_THRESHOLD} MB`
    });
    performMemoryCleanup(true);
  }
}, MEMORY_CLEANUP_INTERVAL);

const app = express();

// 中间件
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 压缩中间件（如果可用）
try {
  const compression = await import('compression');
  app.use(compression.default());
} catch (e) {
  // compression 模块不可用，跳过
}

// 静态资源缓存和性能优化
app.use((req, res, next) => {
  // 为HTML设置缓存控制
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // 为API设置缓存
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'public, max-age=30');
  }
  next();
});

// CORS 支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// ------------------- HTML 前端（完整修复版）-------------------
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>CF IP 远程检测</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☁️</text></svg>">
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<style>
/* ===========================
   优雅配色方案 - 清新绿蓝色
   =========================== */
:root {
  --primary: #10b981;
  --primary-hover: #059669;
  --primary-light: #34d399;
  --accent: #14b8a6;
  --accent-hover: #0d9488;
  --success: #22c55e;
  --success-hover: #16a34a;
  --danger: #f43f5e;
  --danger-hover: #e11d48;
  --warning: #f59e0b;
  --info: #06b6d4;
  
  --bg-primary: #fafafa;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.06);
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.12);
  
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  overflow-x: hidden;
  -webkit-text-size-adjust: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.6;
  width: 100%;
  max-width: 100vw;
}

/* ===========================
   通用卡片样式 - 修复圆角
   =========================== */
.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  transition: var(--transition);
  overflow: hidden;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-card);
  /* 不设置border-radius，让父元素的overflow:hidden处理圆角 */
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-body {
  padding: 24px;
  /* 不设置border-radius，让父元素的overflow:hidden处理圆角 */
}

/* ===========================
   页面布局
   =========================== */
.page-header {
  text-align: center;
  padding: 48px 20px 36px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
  box-shadow: var(--shadow-md);
  margin-bottom: 32px;
}

.page-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px 0;
  letter-spacing: -0.5px;
}

.page-subtitle {
  font-size: 16px;
  opacity: 0.95;
  font-weight: 400;
}

/* 桌面布局：双列 */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px 40px;
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 24px;
  align-items: start;
}

/* ===========================
   表单样式
   =========================== */
.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--text-primary);
}

.optional {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 13px;
}

input, textarea, select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: var(--transition);
  font-family: inherit;
}

input:hover {
  border-color: var(--primary);
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

input::placeholder {
  color: var(--text-muted);
}

/* ===========================
   按钮系统
   =========================== */
.btn {
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  opacity: 0.9;
}

.btn-danger {
  background: var(--danger);
  color: white;
  box-shadow: var(--shadow-sm);
  margin-top: 10px;
}

.btn-danger:hover:not(:disabled) {
  background: var(--danger-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.btn:disabled {
  background: var(--text-muted) !important;
  color: white !important;
  cursor: not-allowed !important;
  opacity: 0.6 !important;
  transform: none !important;
  box-shadow: none !important;
}

/* ===========================
   快速选择区域
   =========================== */
.quick-select {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 2px solid var(--border-light);
}

.quick-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quick-btn {
  width: 100%;
  padding: 12px 16px;
  margin: 8px 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;  /* 改为居中对齐 */
}

.quick-btn::after {
  content: "→";
  opacity: 0;
  transform: translateX(-10px);
  transition: var(--transition);
  margin-left: 8px;  /* 添加左边距 */
}

.quick-btn:hover {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: white;
  border-color: var(--primary);
  transform: translateX(4px);
}

.quick-btn:hover::after {
  opacity: 1;
  transform: translateX(0);
}

/* ===========================
   帮助文本
   =========================== */
.help-box {
  margin-top: 24px;
  padding: 18px;
  background: var(--bg-primary);
  border-radius: var(--radius);
  border-left: 4px solid var(--primary);
}

.help-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.help-text code {
  background: var(--bg-secondary);
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: var(--primary);
  border: 1px solid var(--border);
}

.help-text a {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
}

.help-text a:hover {
  text-decoration: underline;
}

/* ===========================
   地图样式
   =========================== */
.map-container {
  margin-bottom: 24px;
}

#map {
  width: 100%;
  height: 450px;
  overflow: hidden;
}

.card-body.map-body {
  padding: 0 !important;
}

/* ===========================
   表格样式 - 所有内容居中
   =========================== */
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-radius: var(--radius-lg);
}

.table-container {
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
  background: var(--bg-card);
}

thead {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  position: sticky;
  top: 0;
  z-index: 10;
}

th {
  padding: 16px;
  text-align: center;
  vertical-align: middle;
  font-weight: 600;
  font-size: 13px;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
  font-size: 14px;
  color: var(--text-primary);
  text-align: center;
  vertical-align: middle;
}

tbody tr {
  transition: var(--transition);
}

tbody tr:hover {
  background: var(--bg-primary);
}

tbody tr:last-child td {
  border-bottom: none;
}

/* 单IP表格（两列布局） */
#singleResultCard {
  display: none;
}

#singleResultCard.show {
  display: block;
}

#infoTable {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
}

#infoTable th {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-weight: 600;
  width: 180px;
  text-align: center;
  text-transform: none;
  letter-spacing: 0;
  padding: 14px 16px;
}

#infoTable td {
  text-align: center;
  padding: 14px 16px;
}

/* ===========================
   状态标记 - 居中显示
   =========================== */
td.status-success,
td.status-fail {
  text-align: center;
}

td.status-success::before {
  content: "✓";
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: var(--success);
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
}

td.status-fail::before {
  content: "✕";
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: var(--danger);
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
}

/* ===========================
   结果信息栏
   =========================== */
.result-info {
  display: flex;
  gap: 24px;
  padding: 18px 20px;
  background: var(--bg-primary);
  border-radius: var(--radius);
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.result-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-info-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-info-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ===========================
   响应式布局 - 修复竖向布局宽度统一问题
   =========================== */

/* 1200px以下：切换到竖向布局，统一90%宽度 */
@media (max-width: 1200px) {
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 0 5vw 32px;
    width: 100%;
  }
  
  /* 所有卡片统一90%宽度，居中 */
  .form-box,
  .info-box {
    width: 90vw;
    max-width: 90vw;
    margin: 0 auto;
  }

  .card {
    width: 100%;
  }

  /* 地图容器间距 */
  .map-container {
    margin-bottom: 24px;
  }
}

/* 移动端进一步优化 */
@media (max-width: 768px) {
  html, body {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }

  .page-header {
    padding: 32px 16px 24px;
    margin-bottom: 24px;
  }
  
  .page-title {
    font-size: 28px;
  }
  
  .page-subtitle {
    font-size: 14px;
  }
  
  .container {
    gap: 20px;
    padding: 0 5vw 24px;
  }

  .card-body {
    padding: 20px;
  }
  
  .card-header {
    padding: 16px 20px;
  }

  #map {
    height: 320px;
  }
  
  /* 表格外层 - 可横向滚动 */
  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .table-container {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    min-width: 750px;
  }

  /* 单IP表格在移动端不需要横向滚动 */
  #infoTable {
    min-width: 0;
    width: 100%;
  }

  #infoTable th {
    width: 40%;
  }
  
  .result-info {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  
  th, td {
    padding: 12px 10px;
    font-size: 13px;
  }

  input, .btn {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 24px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .card-body {
    padding: 16px;
  }

  th, td {
    padding: 10px 8px;
    font-size: 12px;
  }
}

/* ===========================
   加载动画
   =========================== */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn:disabled::before {
  content: "";
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
}

/* ===========================
   滚动条美化
   =========================== */
.table-wrapper::-webkit-scrollbar,
.table-container::-webkit-scrollbar {
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track,
.table-container::-webkit-scrollbar-track {
  background: var(--bg-primary);
  border-radius: var(--radius);
}

.table-wrapper::-webkit-scrollbar-thumb,
.table-container::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius);
  transition: var(--transition);
}

.table-wrapper::-webkit-scrollbar-thumb:hover,
.table-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: var(--radius);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
</head>
<body>

<div class="page-header">
  <h1 class="page-title">☁️ Cloudflare IP 远程检测工具</h1>
  <p class="page-subtitle">快速检测 Cloudflare IP的连通性、延迟和地理位置</p>
</div>

<div class="container">
  <div class="form-box">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">🔍 检测配置</h3>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label>域名 / IP:端口</label>
          <input type="text" id="ipPort" placeholder="1.164.110.203:10029" />
        </div>

        <div class="form-group">
          <label>Host (SNI) <span class="optional">可选</span></label>
          <input type="text" id="host" placeholder="填写你的 CF 节点域名" />
        </div>

        <button class="btn btn-primary" onclick="detectIP()" id="submitBtn">
          开始检测
        </button>
        
        <button class="btn btn-danger" onclick="clearPanel()" id="clearBtn">
          清空结果
        </button>

        <div class="quick-select">
          <div class="quick-label">快速选择节点</div>
          <button class="quick-btn" onclick="selectQuickOption('ProxyIP.KR.CMLiussss.net')">
            <span>🇰🇷 韩国节点</span>
          </button>
          <button class="quick-btn" onclick="selectQuickOption('ProxyIP.JP.CMLiussss.net')">
            <span>🇯🇵 日本节点</span>
          </button>
          <button class="quick-btn" onclick="selectQuickOption('ProxyIP.SG.CMLiussss.net')">
            <span>🇸🇬 新加坡节点</span>
          </button>
        </div>

        <div class="help-box">
          <div class="help-text">
            <strong>💡 使用说明：</strong><br>
            • 支持格式：<code>域名/IP:端口</code><br>
            • 端口默认为 <code>443</code>（可省略）<br>
            • Host 字段填写你的 CF 节点域名<br>
            • 使用 <a href="https://t.me/cmliu" target="_blank">@cmliu</a> 
            的 <a href="https://t.me/CMLiussss" target="_blank">ProxyIP</a> 公益服务，在此感谢！<br>
            • 使用 <a href="https://github.com/mountain787/cf-proxyip-test" target="_blank">cf-proxyip-test</a> 项目二次修改，在此感谢！
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="info-box">
    <div class="card map-container">
      <div class="card-header">
        <h3 class="card-title">🗺️ 地理位置</h3>
      </div>
      <div class="card-body map-body">
        <div id="map"></div>
      </div>
    </div>

    <div class="card" id="singleResultCard">
      <div class="card-header">
        <h3 class="card-title">📊 检测结果</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="table-container">
          <table id="infoTable">
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>

<div class="card" id="multiResultPanel" style="display: none;">
  <div class="card-header">
    <h3 class="card-title">📊 批量检测结果</h3>
  </div>
  <div class="card-body">
    <div class="result-info">
      <div class="result-info-item">
        <span class="result-info-label">检测目标</span>
        <span class="result-info-value" id="inputDomain">-</span>
      </div>
      <div class="result-info-item">
        <span class="result-info-label">解析IP数</span>
        <span class="result-info-value" id="resolvedCount">-</span>
      </div>
    </div>
    
    <div class="table-wrapper">
      <table id="resultsTable">
        <thead>
          <tr>
            <th>IP 地址</th>
            <th>端口</th>
            <th>TLS</th>
            <th>CDN</th>
            <th>WebSocket</th>
            <th>Warp</th>
            <th>TLS 延迟</th>
            <th>WS 延迟</th>
            <th>位置</th>
            <th>组织 / ASN</th>
          </tr>
        </thead>
        <tbody id="resultsTableBody"></tbody>
      </table>
    </div>
  </div>
</div>


<script src="https://unpkg.com/leaflet/dist/leaflet.js" defer onerror="console.warn('Leaflet加载失败')"></script>
<script>
// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 全局函数 - 必须在页面加载前定义
function selectQuickOption(domain) {
  const ipPortInput = document.getElementById('ipPort');
  const hostInput = document.getElementById('host');
  if (ipPortInput) {
    ipPortInput.value = domain;
  }
  if (hostInput) {
    hostInput.value = '';
  }
}

// 清理面板内容
function clearPanel() {
  // 清理地图标记
  if (window.map && window.marker) {
    window.map.removeLayer(window.marker);
    window.marker = null;
    // 重置地图视图到默认位置
    window.map.setView([35, 139], 5);
  }

  // 隐藏结果表格
  const singleResultCard = document.getElementById('singleResultCard');
  const multiResultPanel = document.getElementById('multiResultPanel');
  
  if (singleResultCard) {
    singleResultCard.style.display = 'none';
    singleResultCard.classList.remove('show');
    const tbody = document.querySelector('#infoTable tbody');
    if (tbody) {
      tbody.innerHTML = '';
    }
  }

  if (multiResultPanel) {
    multiResultPanel.style.display = 'none';
    const tbody = document.getElementById('resultsTableBody');
    if (tbody) {
      tbody.innerHTML = '';
    }
    // 清空标题信息
    const inputDomain = document.getElementById('inputDomain');
    const resolvedCount = document.getElementById('resolvedCount');
    if (inputDomain) inputDomain.textContent = '-';
    if (resolvedCount) resolvedCount.textContent = '-';
  }

  console.log('面板内容已清理');
}

// 等待 Leaflet 加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 配置 Leaflet 使用 passive 事件监听器以减少警告
  if (typeof L !== 'undefined') {
    (function() {
      const originalAddListener = L.DomEvent.addListener;
      L.DomEvent.addListener = function(obj, type, handler, context) {
        // 为 touch 事件添加 passive 选项
        if (L.Browser.touch && (type === 'touchstart' || type === 'touchmove')) {
          obj.addEventListener(type, handler, { passive: true });
          return handler;
        }
        return originalAddListener.call(this, obj, type, handler, context);
      };
    })();

    let map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true
    }).setView([35, 139], 5);

    // 使用 Esri World Street Map（全球覆盖，免费）
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank">Esri</a> | &copy; OpenStreetMap',
      maxZoom: 19,
      minZoom: 2
    }).addTo(map);

    window.map = map;
    window.marker = null;
  }
});

async function detectIP() {
  const ipPortInput = document.getElementById('ipPort').value.trim();
  let host = document.getElementById('host').value.trim();
  const submitBtn = document.getElementById('submitBtn');

  // 参数验证
  if (!ipPortInput) {
    alert("请填写 域名/IP:端口");
    return;
  }

  // 解析 域名/IP:端口 格式
  let ip, port = 443;
  const ipPortMatch = ipPortInput.match(/^(.+?):(\d+)$/);
  if (ipPortMatch) {
    ip = ipPortMatch[1];
    port = parseInt(ipPortMatch[2]);
  } else {
    ip = ipPortInput;
  }

  // 禁用按钮，防止重复提交
  submitBtn.disabled = true;
  submitBtn.textContent = "检测中...";

  try {
    const params = new URLSearchParams({
      ip,
      port: port.toString(),
      host,
      wsPath: "/"
    });
    
    const resp = await fetch(\`/api?\${params}\`);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || data.message || \`HTTP \${resp.status}\`);
    }

    updateInfo(data);
  } catch(err) {
    alert("检测失败: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "开始检测";
  }
}

// 格式化位置信息
function formatLocation(geoip) {
  if (!geoip) return "-";
  const city = geoip.city || "";
  const country = geoip.countryName || geoip.country || "";
  if (city && country) return \`\${city}, \${country}\`;
  if (city) return city;
  if (country) return country;
  return "-";
}

// 更新地图标记
function updateMapMarker(data) {
  if (!window.map) return;
  
  if (window.marker) {
    window.map.removeLayer(window.marker);
    window.marker = null;
  }
  
  if (data.geoip?.latitude && data.geoip?.longitude) {
    const locationText = formatLocation(data.geoip);
    window.marker = L.marker([data.geoip.latitude, data.geoip.longitude]).addTo(window.map)
      .bindPopup(\`<strong>\${escapeHtml(data.ip)}</strong><br>\${escapeHtml(locationText)}\`).openPopup();
    window.map.setView([data.geoip.latitude, data.geoip.longitude], 10);
  }
}

function updateInfo(data) {
  if (data.results && data.results.length > 1) {
    updateMultiResults(data);
    return;
  }

  const singleData = data.results ? data.results[0] : data;
  
  // 隐藏多结果面板，显示单结果卡片
  document.getElementById('multiResultPanel').style.display = 'none';
  const singleCard = document.getElementById('singleResultCard');
  singleCard.style.display = 'block';
  singleCard.classList.add('show');

  const tbody = document.querySelector('#infoTable tbody');
  tbody.innerHTML = '';

  // 单IP表格 - 竖向顺序调整
  const infoList = [
    ["IP 地址", singleData.ip || "-"],
    ["端口", singleData.port || "-"],
    ["TLS 检测", singleData.checks?.tls_detect ? "✓ 成功" : "✕ 失败"],
    ["CDN Trace", singleData.checks?.cdn_trace ? "✓ 是" : "✕ 否"],
    ["WebSocket 状态", singleData.checks?.ws_real_connect ? "✓ 连接成功" : "✕ 连接失败"],
    ["Warp 状态", singleData.cdn?.warp || "off"],
    ["TLS 延迟", singleData.latency?.tls_handshake_ms ? \`\${singleData.latency.tls_handshake_ms} ms\` : "-"],
    ["WS 连接延迟", singleData.latency?.ws_connect_ms ? \`\${singleData.latency.ws_connect_ms} ms\` : "-"],
    ["地理位置", formatLocation(singleData.geoip)],
    ["组织 / ASN", singleData.geoip ? \`\${singleData.geoip.organization || "-"} / \${singleData.geoip.asn ? "AS" + singleData.geoip.asn : "-"}\` : "-"]
  ];

  infoList.forEach(([key, value]) => {
    const row = document.createElement('tr');
    const th = document.createElement('th');
    const td = document.createElement('td');
    th.textContent = key;
    td.textContent = value;
    row.appendChild(th);
    row.appendChild(td);
    tbody.appendChild(row);
  });

  updateMapMarker(singleData);
}

function updateMultiResults(data) {
  // 显示多结果面板，隐藏单结果表格
  var singleResultCard = document.getElementById('singleResultCard');
  if (singleResultCard) {
    singleResultCard.style.display = 'none';
    singleResultCard.classList.remove('show');
  }
  
  var multiPanel = document.getElementById('multiResultPanel');
  if (multiPanel) multiPanel.style.display = 'block';

  // 更新标题信息（域名/输入）
  var inputDomainEl = document.getElementById('inputDomain');
  if (inputDomainEl) inputDomainEl.textContent = data.input || '-';

  // 清空并填充表格
  var tbody = document.getElementById('resultsTableBody');
  if (!tbody) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

  if (!data.results || data.results.length === 0) {
    var rc0 = document.getElementById('resolvedCount');
    if (rc0) rc0.textContent = '0';
    return;
  }

  // 过滤掉所有检测都失败的IP
  var validResults = data.results.filter(function (result) {
    var tlsFailed = !result.checks || !result.checks.tls_detect;
    var wsFailed = !result.checks || !result.checks.ws_real_connect;
    var cdnFailed = !result.checks || !result.checks.cdn_trace;
    return !(tlsFailed && wsFailed && cdnFailed);
  });

  // 更新显示的有效IP数量
  var totalResolved = (data.resolvedIPs && data.resolvedIPs.length) || (data.results && data.results.length) || 0;
  var validCount = validResults.length;
  var resolvedCountEl = document.getElementById('resolvedCount');
  if (resolvedCountEl) resolvedCountEl.textContent = \`\${totalResolved} 个（\${validCount} 个有效）\`;

  // 逐行创建 DOM - 多IP表格横向顺序调整
  validResults.forEach(function (result) {
    var row = document.createElement('tr');

    // 1. IP 地址
    var tdIp = document.createElement('td');
    var strongIp = document.createElement('strong');
    strongIp.textContent = result.ip || '-';
    strongIp.style.color = 'var(--primary)';
    tdIp.appendChild(strongIp);
    row.appendChild(tdIp);

    // 2. 端口（新增 - 从result.port获取）
    var tdPort = document.createElement('td');
    tdPort.textContent = result.port || '443';
    row.appendChild(tdPort);

    // 3. TLS
    var tdTls = document.createElement('td');
    if (result.checks && result.checks.tls_detect) {
      tdTls.className = 'status-success';
      tdTls.textContent = '';
    } else {
      tdTls.className = 'status-fail';
      tdTls.textContent = '';
    }
    row.appendChild(tdTls);

    // 4. CDN
    var tdCdn = document.createElement('td');
    if (result.checks && result.checks.cdn_trace) {
      tdCdn.className = 'status-success';
      tdCdn.textContent = '';
    } else {
      tdCdn.className = 'status-fail';
      tdCdn.textContent = '';
    }
    row.appendChild(tdCdn);

    // 5. WebSocket
    var tdWs = document.createElement('td');
    if (result.checks && result.checks.ws_real_connect) {
      tdWs.className = 'status-success';
      tdWs.textContent = '';
    } else {
      tdWs.className = 'status-fail';
      tdWs.textContent = '';
    }
    row.appendChild(tdWs);

    // 6. Warp
    var tdWarp = document.createElement('td');
    var warpStatus = (result.cdn && result.cdn.warp) || 'off';
    tdWarp.textContent = warpStatus;
    if (warpStatus === 'on') {
      tdWarp.style.color = 'var(--success)';
      tdWarp.style.fontWeight = '600';
    } else {
      tdWarp.style.color = 'var(--text-muted)';
    }
    row.appendChild(tdWarp);

    // 7. TLS 延迟
    var tdTlsMs = document.createElement('td');
    if (result.latency && result.latency.tls_handshake_ms) {
      tdTlsMs.textContent = result.latency.tls_handshake_ms + ' ms';
      var latency = result.latency.tls_handshake_ms;
      if (latency < 100) {
        tdTlsMs.style.color = 'var(--success)';
        tdTlsMs.style.fontWeight = '600';
      } else if (latency < 200) {
        tdTlsMs.style.color = 'var(--warning)';
        tdTlsMs.style.fontWeight = '600';
      } else {
        tdTlsMs.style.color = 'var(--danger)';
        tdTlsMs.style.fontWeight = '600';
      }
    } else {
      tdTlsMs.textContent = '-';
      tdTlsMs.style.color = 'var(--text-muted)';
    }
    row.appendChild(tdTlsMs);

    // 8. WS 延迟
    var tdWsMs = document.createElement('td');
    if (result.latency && result.latency.ws_connect_ms) {
      tdWsMs.textContent = result.latency.ws_connect_ms + ' ms';
      var wsLatency = result.latency.ws_connect_ms;
      if (wsLatency < 100) {
        tdWsMs.style.color = 'var(--success)';
        tdWsMs.style.fontWeight = '600';
      } else if (wsLatency < 200) {
        tdWsMs.style.color = 'var(--warning)';
        tdWsMs.style.fontWeight = '600';
      } else {
        tdWsMs.style.color = 'var(--danger)';
        tdWsMs.style.fontWeight = '600';
      }
    } else {
      tdWsMs.textContent = '-';
      tdWsMs.style.color = 'var(--text-muted)';
    }
    row.appendChild(tdWsMs);

    // 9. 地理位置
    var tdLoc = document.createElement('td');
    tdLoc.textContent = formatLocation(result.geoip);
    row.appendChild(tdLoc);

    // 10. 组织/ASN
    var tdOrg = document.createElement('td');
    tdOrg.style.fontSize = '12px';
    var orgAsn = '-';
    if (result.geoip) {
      var org = result.geoip.organization || '-';
      var asn = result.geoip.asn ? 'AS' + result.geoip.asn : '-';
      orgAsn = org + ' / ' + asn;
    }
    tdOrg.textContent = orgAsn;
    row.appendChild(tdOrg);

    // 将行追加到 tbody
    tbody.appendChild(row);
  });

  // 更新地图 - 优先选择可用的 geoip
  if (window.marker && window.map) {
    try { window.map.removeLayer(window.marker); } catch (e) {}
    window.marker = null;
  }

  var firstSuccessIP = validResults.find(function (r) { 
    return r.checks && r.checks.tls_detect && r.geoip && r.geoip.latitude && r.geoip.longitude; 
  });
  if (!firstSuccessIP) {
    firstSuccessIP = validResults.find(function (r) { 
      return r.checks && r.checks.ws_real_connect && r.geoip && r.geoip.latitude && r.geoip.longitude; 
    });
  }
  if (!firstSuccessIP) {
    firstSuccessIP = validResults.find(function (r) { 
      return r.geoip && r.geoip.latitude && r.geoip.longitude; 
    });
  }

  if (firstSuccessIP) updateMapMarker(firstSuccessIP);
}

</script>
</body>
</html>`;


// 根路径返回 HTML
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.send(HTML_TEMPLATE);
});

// 处理 favicon.ico 请求（避免 404 错误）
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// 健康检查端点
app.get("/health", (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB"
    },
    cache: {
      size: requestCache.size,
      rateLimitSize: rateLimitMap.size
    },
    geoip: {
      asn: asnReader !== null,
      city: cityReader !== null
    },
    features: {
      websocket: !DISABLE_WEBSOCKET,
      cdnTrace: !DISABLE_CDN_TRACE
    }
  });
});

// 统计信息端点
app.get("/stats", (req, res) => {
  const memoryUsage = process.memoryUsage();
  const cacheEntries = Array.from(requestCache.entries());
  const recentRequests = cacheEntries
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 10)
    .map(([key, value]) => ({
      key,
      timestamp: new Date(value.timestamp).toISOString(),
      age: Math.round((Date.now() - value.timestamp) / 1000) + "s"
    }));

  res.json({
    server: {
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform
    },
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    },
    cache: {
      size: requestCache.size,
      rateLimitSize: rateLimitMap.size,
      recentRequests
    },
    geoip: {
      asnLoaded: asnReader !== null,
      cityLoaded: cityReader !== null
    },
    config: {
      port: PORT,
      cacheDuration: CACHE_DURATION / 1000 + "s",
      maxRequestsPerIP: MAX_REQUESTS_PER_IP,
      rateLimitWindow: RATE_LIMIT_WINDOW / 1000 + "s",
      tlsTimeout: TLS_TIMEOUT,
      wsTimeout: WEBSOCKET_TIMEOUT,
      cdnTraceTimeout: CDN_TRACE_TIMEOUT,
      disableWebSocket: DISABLE_WEBSOCKET,
      disableCdnTrace: DISABLE_CDN_TRACE
    }
  });
});

// 格式化运行时间
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// ------------------- 初始化 GeoIP 数据库 -------------------
let cityReader = null;
let asnReader = null;

async function downloadGeoIPDatabase(dbPath, dbName) {
  const downloadUrls = [
    'https://raw.gitmirror.com/adysec/IP_database/main/geolite/' + dbName,
    'https://raw.githubusercontent.com/adysec/IP_database/main/geolite/' + dbName
  ];

  for (const downloadUrl of downloadUrls) {
    try {
      logger.info(`尝试下载 GeoIP 数据库`, { url: downloadUrl, dbName });
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024 // 最大 100MB
      });

      await fs.promises.writeFile(dbPath, response.data);
      const fileSize = (response.data.length / 1024 / 1024).toFixed(2);
      logger.info(`${dbName} 下载成功`, { path: dbPath, size: `${fileSize} MB` });
      return true;
    } catch (urlError) {
      logger.warn(`下载失败`, { url: downloadUrl, error: urlError.message });
    }
  }

  return false;
}

async function initGeoIP() {
  try {
    // 加载 ASN 数据库（使用 maxmind.Reader 方式）
    const asnDbPath = path.join(__dirname, "GeoLite2-ASN.mmdb");
    if (await fileExists(asnDbPath)) {
      try {
        const buffer = await readFile(asnDbPath);
        asnReader = new maxmind.Reader(buffer, { watch: false });
        logger.info("GeoIP ASN 数据库加载成功");
      } catch (err) {
        logger.warn("GeoIP ASN 数据库加载失败", { error: err.message });
      }
    } else {
      logger.warn("GeoIP ASN 数据库文件不存在", { path: asnDbPath });
      // 尝试自动下载
      logger.info("尝试自动下载 GeoLite2-ASN.mmdb");
      const downloadSuccess = await downloadGeoIPDatabase(asnDbPath, "GeoLite2-ASN.mmdb");
      if (downloadSuccess) {
        try {
          const buffer = await readFile(asnDbPath);
          asnReader = new maxmind.Reader(buffer, { watch: false });
          logger.info("GeoIP ASN 数据库加载成功（自动下载）");
        } catch (err) {
          logger.warn("下载后的 ASN 数据库加载失败", { error: err.message });
        }
      } else {
        logger.error("GeoLite2-ASN.mmdb 自动下载失败，请手动下载");
      }
    }

    // 加载 City 数据库（包含详细位置信息，使用 maxmind.Reader 方式）
    const cityDbPath = path.join(__dirname, "GeoLite2-City.mmdb");
    if (await fileExists(cityDbPath)) {
      try {
        const buffer = await readFile(cityDbPath);
        cityReader = new maxmind.Reader(buffer, { watch: false });
        logger.info("GeoIP City 数据库加载成功");
      } catch (err) {
        logger.warn("GeoIP City 数据库加载失败", { error: err.message });
      }
    } else {
      logger.warn("GeoIP City 数据库文件不存在", { path: cityDbPath });
      // 尝试自动下载
      logger.info("尝试自动下载 GeoLite2-City.mmdb");
      const downloadSuccess = await downloadGeoIPDatabase(cityDbPath, "GeoLite2-City.mmdb");
      if (downloadSuccess) {
        try {
          const buffer = await readFile(cityDbPath);
          cityReader = new maxmind.Reader(buffer, { watch: false });
          logger.info("GeoIP City 数据库加载成功（自动下载）");
        } catch (err) {
          logger.warn("下载后的 City 数据库加载失败", { error: err.message });
        }
      } else {
        logger.error("GeoLite2-City.mmdb 自动下载失败，请手动下载");
      }
    }

  } catch (err) {
    logger.error("GeoIP 数据库初始化失败", { error: err.message, message: "将跳过地理位置查询功能" });
  }
}

// 在后台异步加载 GeoIP 数据库，不阻塞服务器启动
initGeoIP().catch(err => {
  logger.warn('GeoIP 数据库加载失败，将在后台重试', { error: err.message });
});

// ------------------- 请求频率限制和缓存 -------------------
const requestCache = new Map(); // 用于缓存 API 响应
const rateLimitMap = new Map(); // 用于速率限制

// 获取客户端真实IP（支持代理）
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown';
}

// 请求日志中间件（记录 API 请求）- 放在 getClientIP 定义之后
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    const startTime = Date.now();
    const originalSend = res.send;
    const clientIp = getClientIP(req);

    // 记录请求开始（静默模式下不输出）
    // 不输出查询参数和客户端IP（避免泄露敏感信息）
    if (!QUIET_MODE) {
      logger.debug(`API 请求开始`, {
        method: req.method,
        path: req.path
      });
    }

    res.send = function (data) {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 500 ? 'error' :
        res.statusCode >= 400 ? 'warn' : 'info';

      // 静默模式下只输出错误和警告，不输出成功的API请求
      // 不输出客户端IP（避免泄露敏感信息）
      if (!QUIET_MODE || res.statusCode >= 400) {
        logger[logLevel](`API 请求完成`, {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`
        });
      }

      return originalSend.call(this, data);
    };
  }

  next();
});

function checkRateLimit(ip) {
  const now = Date.now();
  const key = `rate_${ip}`;
  const record = rateLimitMap.get(key);

  if (!record || now - record.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { firstRequest: now, count: 1 });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_IP) {
    // 不输出IP地址（避免泄露敏感信息）
    logger.warn('速率限制触发', { count: record.count, limit: MAX_REQUESTS_PER_IP });
    return false;
  }

  record.count++;
  // 不输出IP地址（避免泄露敏感信息）
  if (!QUIET_MODE) {
    logger.debug(`速率限制计数`, { count: record.count, limit: MAX_REQUESTS_PER_IP });
  }
  return true;
}

// 定期清理过期缓存和速率限制记录（已集成到内存管理模块，保留此作为备用）
// 注意：主要的内存清理已由上面的内存管理模块处理
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  // 清理过期缓存
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      requestCache.delete(key);
      cleaned++;
    }
  }

  // 清理过期的速率限制记录
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.firstRequest > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug(`定期清理完成，清理了 ${cleaned} 条过期记录`);
  }
}, 60000); // 每分钟清理一次

// ------------------- 工具函数 -------------------
// IP 格式验证函数
function isIPAddress(str) {
  if (!str || typeof str !== 'string') return false;

  // IPv4 验证（检查每个段是否在 0-255 范围内）
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (ipv4Regex.test(str)) {
    const parts = str.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 验证（简化版本）
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^::/;
  return ipv6Regex.test(str);
}

function isDomain(str) {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  return domainRegex.test(str);
}

// ------------------- DNS 解析（支持 CNAME 递归解析，获取所有IP）-------------------
async function resolveDomain(domain, visited = new Set(), depth = 0) {
  if (depth > DNS_MAX_RECURSION_DEPTH) {
    throw new Error(`CNAME 递归深度超过限制（${DNS_MAX_RECURSION_DEPTH}层）`);
  }
  if (visited.has(domain)) {
    throw new Error("检测到 CNAME 循环引用");
  }
  visited.add(domain);

  // 如果是IP地址，直接返回，不进行DNS查询
  if (isIPAddress(domain)) {
    return [domain];
  }

  // 收集所有可能的IP地址
  const allIPs = new Set();

  try {
    // 方法1: 尝试直接解析 A 记录
    try {
      const addresses = await dnsResolve4(domain);
      if (Array.isArray(addresses) && addresses.length > 0) {
        addresses.forEach(ip => allIPs.add(ip));
      }
    } catch (err) {
      // 继续尝试其他方法
    }

    // 方法2: 检查 CNAME 记录
    try {
      const cnameRecords = await dnsResolveCname(domain);
      if (Array.isArray(cnameRecords) && cnameRecords.length > 0) {
        for (const cname of cnameRecords) {
          const resolvedIPs = await resolveDomain(cname, visited, depth + 1);
          resolvedIPs.forEach(ip => allIPs.add(ip));
        }
      }
    } catch (err) {
      // 继续尝试其他方法
    }

    // 方法3: 通用解析
    try {
      const records = await dnsResolve(domain, 'A');
      if (Array.isArray(records) && records.length > 0) {
        records.forEach(ip => allIPs.add(ip));
      }
    } catch (err) {
      // 继续尝试其他方法
    }

    // 方法4: lookup
    try {
      const result = await dnsLookup(domain, { all: true, family: 4 });
      if (Array.isArray(result)) {
        result.forEach(r => allIPs.add(r.address));
      } else {
        allIPs.add(result.address);
      }
    } catch (err) {
      try {
        const result = await dnsLookup(domain, { family: 4 });
        allIPs.add(result.address);
      } catch (err2) {
        // 忽略
      }
    }

    if (allIPs.size > 0) {
      const uniqueIPs = Array.from(allIPs);
      // 静默模式下不输出DNS解析成功信息
      // 即使不在静默模式，也不输出具体域名和IP地址，只输出数量（避免泄露敏感信息）
      if (depth === 0 && !QUIET_MODE) {
        logger.info(`DNS 解析成功`, { count: uniqueIPs.length });
      }
      return uniqueIPs;
    }

    throw new Error(`未找到 ${domain} 的 A 记录或 CNAME 记录`);
  } catch (err) {
    if (err.message.includes('ENOTFOUND') || err.message.includes('ENODATA')) {
      throw new Error(`域名 ${domain} 不存在或无法解析`);
    }
    throw err;
  }
}

// ------------------- API -------------------
app.get("/api", async (req, res) => {
  let { ip, port = DEFAULT_PORT, host, wsPath = DEFAULT_WS_PATH } = req.query;

  // 参数验证
  if (!ip) {
    return res.status(400).json({
      error: "缺少必需参数",
      message: "需要提供 ip 参数"
    });
  }


  // 检测并解析 域名/IP:端口:端口 格式（例如 1.164.110.203:10029）
  const ipPortMatch = ip.match(/^(.+?):(\d+)$/);
  if (ipPortMatch) {
    ip = ipPortMatch[1];
    port = ipPortMatch[2];
  }

  // 如果 Host 为空，使用默认值
  if (!host || host.trim() === "") {
    host = DEFAULT_HOST;
  }

  // 如果端口为空或未指定，使用默认端口
  if (!port || port === "" || port === String(DEFAULT_PORT)) {
    port = DEFAULT_PORT;
  }

  // IP 格式验证
  const isIP = isIPAddress(ip);
  const isDomainName = isDomain(ip);

  if (!isIP && !isDomainName) {
    return res.status(400).json({
      error: "无效的 IP 地址或域名",
      message: "请提供有效的 IP 地址或域名（支持 IPv4、IPv6 或域名，也可使用 域名/IP:端口:端口 格式）"
    });
  }

  // 如果是域名，解析为多个 IP
  let targetIPs = [];
  if (isDomainName) {
    try {
      // 静默模式下不输出DNS解析信息
      // 即使不在静默模式，也不输出具体域名（避免泄露敏感信息）
      if (!QUIET_MODE) {
        logger.info(`开始 DNS 解析`, { count: '...' });
      }
      targetIPs = await resolveDomain(ip);
      if (!targetIPs || targetIPs.length === 0) {
        return res.status(400).json({
          error: "DNS 解析失败",
          message: "域名解析未返回任何 IP 地址"
        });
      }
    } catch (err) {
      return res.status(400).json({
        error: "DNS 解析失败",
        message: err.message
      });
    }
  } else {
    // 单个 IP
    targetIPs = [ip];
  }

  // 限制最大检测 IP 数量，防止资源耗尽
  const MAX_IP_COUNT = 50;
  if (targetIPs.length > MAX_IP_COUNT) {
    return res.status(400).json({
      error: "IP 数量过多",
      message: `检测 IP 数量不能超过 ${MAX_IP_COUNT} 个，当前为 ${targetIPs.length} 个`
    });
  }

  // 速率限制（使用真实IP）
  const clientIp = getClientIP(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: "请求过于频繁",
      message: "请稍后再试"
    });
  }

  const targetPort = parseInt(port);
  if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) {
    return res.status(400).json({
      error: "无效的端口号",
      message: "端口号必须在 1-65535 之间"
    });
  }

  // 检查缓存
  // 对于域名，使用原始输入作为缓存键；对于IP，直接使用IP
  let cacheKey;
  if (isDomainName) {
    // 域名检测：使用原始输入作为缓存键
    cacheKey = `domain_${ip}_${targetPort}_${host}`;
  } else {
    // 单个IP：直接使用IP作为缓存键
    cacheKey = `ip_${ip}_${targetPort}_${host}`;
  }

  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // 静默模式下不输出缓存使用信息
    if (!QUIET_MODE) {
      logger.debug(`使用缓存`, { key: cacheKey, age: `${Math.round((Date.now() - cached.timestamp) / 1000)}s` });
    }
    return res.json(cached.data);
  }

  // 检测单个 IP 的函数（完全独立，不共享状态）
  async function detectSingleIP(targetIP, index, total) {
    // 每个检测都有独立的结果对象，避免数据混淆
    const result = {
      ip: targetIP,  // 明确标记IP，确保结果对应正确
      checks: {
        tls_detect: false,
        ws_real_connect: false,
        cdn_trace: false
      },
      latency: {},
      geoip: null,
      cdn: { warp: "off" }
    };

    try {
      // 只在启用检测DEBUG日志时输出详细信息（不输出IP地址和host，避免泄露）
      if (ENABLE_DETECTION_DEBUG) {
        logger.debug(`开始检测 IP`, { index: index + 1, total });
      }

      // ----- GeoIP 查询 -----
      try {
        const geoipData = await lookupGeoIP(targetIP);
        if (geoipData && Object.keys(geoipData).length > 0) {
          result.geoip = geoipData;
          // 只在启用检测DEBUG日志时输出（不输出IP地址，避免泄露）
          if (ENABLE_DETECTION_DEBUG) {
            logger.debug(`GeoIP 查询成功`, {
              location: `${geoipData.city || ''}${geoipData.city ? ', ' : ''}${geoipData.countryName || geoipData.country || ''}`,
              organization: geoipData.organization
            });
          }
        }
      } catch (err) {
        // 错误日志也不输出IP地址（避免泄露）
        logger.warn(`GeoIP 查询失败`, { error: err.message });
      }

      // ----- TLS 检测 -----
      const tlsStart = Date.now();
      try {
        await testTLS(targetIP, targetPort, host);
        result.checks.tls_detect = true;
        result.latency.tls_handshake_ms = Date.now() - tlsStart;
        // 只在启用检测DEBUG日志时输出成功信息（不输出IP地址，避免泄露）
        if (ENABLE_DETECTION_DEBUG) {
          logger.debug(`TLS 检测成功`, { latency: `${result.latency.tls_handshake_ms}ms` });
        }
      } catch (err) {
        result.checks.tls_detect = false;
        result.latency.tls_handshake_ms = Date.now() - tlsStart;
        // 错误日志也不输出IP地址（避免泄露）
        logger.warn(`TLS 检测失败`, { error: err.message });
      }

      // ----- WebSocket 检测 -----
      const wsStart = Date.now();
      if (DISABLE_WEBSOCKET) {
        // 云平台环境：跳过 WebSocket 检测
        result.checks.ws_real_connect = false;
        result.latency.ws_connect_ms = 0;
        // 只在启用检测DEBUG日志时输出（不输出IP地址，避免泄露）
        if (ENABLE_DETECTION_DEBUG) {
          logger.debug(`WebSocket 已禁用`, { reason: '云平台优化' });
        }
      } else {
        try {
          const wsInfo = await testWebSocket(targetIP, targetPort, host, wsPath);
          result.checks.ws_real_connect = true;
          result.latency.ws_connect_ms = Date.now() - wsStart;
          if (wsInfo) result.websocket = wsInfo;
          // 只在启用检测DEBUG日志时输出成功信息（不输出IP地址，避免泄露）
          if (ENABLE_DETECTION_DEBUG) {
            logger.debug(`WebSocket 检测成功`, { latency: `${result.latency.ws_connect_ms}ms` });
          }
        } catch (err) {
          result.checks.ws_real_connect = false;
          result.latency.ws_connect_ms = Date.now() - wsStart;
          // 错误日志也不输出IP地址（避免泄露）
          logger.warn(`WebSocket 检测失败`, { error: err.message });
        }
      }

      // ----- CDN Trace 检测 -----
      if (DISABLE_CDN_TRACE) {
        // 云平台环境：跳过 CDN Trace 检测
        result.checks.cdn_trace = false;
        if (ENABLE_DETECTION_DEBUG) {
          logger.debug(`CDN Trace 已禁用`, { reason: '云平台优化' });
        }
      } else {
        try {
          const cdnResult = await testCDNTrace(targetIP, targetPort, host);
          // 成功字段布尔化
          result.checks.cdn_trace = !!cdnResult.success;

          // 保留 warp 状态（如存在）
          if (cdnResult.warp) result.cdn.warp = cdnResult.warp;

        } catch (err) {
          // 出错则标记为 false，但不中断整体检测
          result.checks.cdn_trace = false;
          logger.warn(`CDN Trace 检测失败`, { error: err.message });
        }
      }

      // 兜底，确保字段存在
      if (!result.cdn) result.cdn = { warp: 'off' };

      return result;
    } catch (err) {
      // 即使检测过程中出现意外错误，也返回部分结果，不影响其他IP
      // 错误日志也不输出IP地址（避免泄露）
      logger.error(`IP 检测异常`, { error: err.message });
      result.error = err.message;
      return result;
    }
  }

  // 并行检测所有 IP（每个IP完全独立，使用 Promise.all 避免一个失败影响全部）
  // 添加并发控制：如果IP数量过多，分批检测
  const MAX_CONCURRENT = 10; // 最大并发数

  // 静默模式下不输出检测开始信息
  // 即使不在静默模式，也不输出具体IP数量（避免泄露敏感信息）
  if (!QUIET_MODE) {
    logger.info(`开始检测`, { maxConcurrent: MAX_CONCURRENT });
  }

  const results = [];
  for (let i = 0; i < targetIPs.length; i += MAX_CONCURRENT) {
    const batch = targetIPs.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map((targetIP, batchIndex) =>
        detectSingleIP(targetIP, i + batchIndex, targetIPs.length)
      )
    );
    results.push(...batchResults);
  }

  // 验证结果完整性（仅在开发环境或结果异常时输出警告）
  if (results.length !== targetIPs.length) {
    logger.warn(`检测结果数量不匹配`, {
      resultsCount: results.length,
      ipsCount: targetIPs.length
    });
  }

  // 清理和精简结果数据
  const cleanedResults = results.map(r => {
    const cleaned = {
      ip: r.ip,
      checks: r.checks,
      latency: r.latency
    };

    // 保留geoip信息（位置和组织/ASN）- 即使部分字段为空也要保留对象
    if (r.geoip) {
      cleaned.geoip = {
        city: r.geoip.city || null,
        country: r.geoip.country || null,
        countryName: r.geoip.countryName || null,
        latitude: r.geoip.latitude || null,
        longitude: r.geoip.longitude || null,
        asn: r.geoip.asn || null,
        organization: r.geoip.organization || null
      };
    }

    // 保留cdn信息（包括warp状态）
    if (r.cdn) {
      cleaned.cdn = {
        warp: r.cdn.warp || "off",
      };
    }

    // 仅在有WebSocket连接时才添加websocket信息，并精简字段
    if (r.websocket && r.websocket.connected) {
      cleaned.websocket = {
        connected: true,
        protocol: r.websocket.protocol || null
      };
    }

    return cleaned;
  });

  // 判断是否使用默认host（避免泄露默认配置）
  const isDefaultHost = host === DEFAULT_HOST;

  // 构建响应
  let response;

  if (targetIPs.length === 1) {
    // 单个IP：直接在顶层返回，不包含results数组（避免重复）
    response = {
      input: ip,
      isDomain: isDomainName,
      port: targetPort,  // 添加port字段，前端需要显示
      ...cleanedResults[0],  // 直接展开单个结果的所有字段
      timestamp: new Date().toISOString()
    };
    // 仅在使用非默认host时才返回host字段
    if (!isDefaultHost) {
      response.host = host;
    }
  } else {
    // 多个IP：使用results数组
    response = {
      input: ip,
      isDomain: isDomainName,
      resolvedIPs: targetIPs,
      port: targetPort,
      results: cleanedResults,
      timestamp: new Date().toISOString()
    };
    // 仅在使用非默认host时才返回host字段
    if (!isDefaultHost) {
      response.host = host;
    }
  }

  // 缓存结果
  requestCache.set(cacheKey, { data: response, timestamp: Date.now() });

  // 输出汇总（静默模式下不输出）
  // 不输出具体数量，只输出统计信息（避免泄露敏感信息）
  if (!QUIET_MODE) {
    const tlsSuccess = results.filter(r => r.checks.tls_detect).length;
    const wsSuccess = results.filter(r => r.checks.ws_real_connect).length;
    const cdnSuccess = results.filter(r => r.checks.cdn_trace).length;

    logger.info(`检测完成`, {
      tls: `${tlsSuccess}/${results.length}`,
      websocket: `${wsSuccess}/${results.length}`,
      cdnTrace: `${cdnSuccess}/${results.length}`
    });
  }

  res.json(response);
});

// ------------------- GeoIP 查询 -------------------
async function lookupGeoIP(ip) {
  if (!cityReader && !asnReader) {
    return null;
  }

  try {
    const cityData = cityReader ? cityReader.get(ip) : null;
    const asnData = asnReader ? asnReader.get(ip) : null;

    if (!cityData && !asnData) {
      return null;
    }

    const result = {};

    if (cityData) {
      result.city = cityData.city?.names?.en || cityData.city?.names?.zh || "";
      result.country = cityData.country?.iso_code || "";
      result.countryName = cityData.country?.names?.en || cityData.country?.names?.zh || "";
      if (cityData.location) {
        result.latitude = cityData.location.latitude || null;
        result.longitude = cityData.location.longitude || null;
      }
    }

    if (asnData) {
      result.asn = asnData.autonomous_system_number || null;
      result.organization = asnData.autonomous_system_organization || "";
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    // 错误日志也不输出IP地址（避免泄露敏感信息）
    logger.warn(`GeoIP 查询异常`, { error: err.message });
    return null;
  }
}

// ------------------- TLS 检测（通过 HTTPS）-------------------
async function testTLS(ip, port = DEFAULT_PORT, host) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ip,
      port: port,
      path: '/',
      method: 'HEAD',
      rejectUnauthorized: false,
      timeout: TLS_TIMEOUT,
      servername: host, // 设置 SNI（Server Name Indication）
      headers: {
        'Host': host
      }
    };

    const req = https.request(options, (res) => {
      resolve(true);
    });

    req.on('error', (err) => {
      reject(new Error(err.message || "TLS 连接失败"));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`TLS 连接超时（${TLS_TIMEOUT / 1000}秒）`));
    });

    req.end();
  });
}

// ------------------- WebSocket 检测 -------------------
async function testWebSocket(ip, port = DEFAULT_PORT, host, wsPath = DEFAULT_WS_PATH) {
  return new Promise((resolve, reject) => {
    // 使用 IP 地址连接，但在 Host 头中使用 host
    const url = `wss://${ip}:${port}${wsPath}`;
    let timeout = null;
    let isResolved = false;

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const safeReject = (error) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(error);
      }
    };

    const safeResolve = (value) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    try {
      // WebSocket 连接配置
      const wsOptions = {
        rejectUnauthorized: false, // 允许自签名证书（用于测试）
        handshakeTimeout: WEBSOCKET_TIMEOUT,
        perMessageDeflate: false,
        headers: {
          'Host': host || ip // 在 Host 头中指定原始 host
        }
      };

      // 使用 createConnection 自定义底层 TLS 连接以设置 SNI（仅在有 host 时）
      if (host) {
        wsOptions.createConnection = (options, callback) => {
          // 直接使用 tls.connect，设置正确的 host 和 servername
          const socket = tls.connect({
            host: ip,              // 连接到实际 IP
            port: port,            // 连接到实际端口
            servername: host,      // SNI 使用 host 域名
            rejectUnauthorized: false,
            ...options
          }, callback);
          return socket;
        };
      }

      const ws = new WebSocket(url, wsOptions);

      timeout = setTimeout(() => {
        if (!isResolved) {
          // 添加错误监听器来捕获 terminate 可能引发的错误
          ws.on("error", () => { }); // 忽略错误
          try {
            // WebSocket 状态: CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3
            if (ws.readyState === 0 || ws.readyState === 1) {
              ws.terminate();
            }
          } catch (err) {
            // 忽略 terminate 错误
          }
          safeReject(new Error(`连接超时（${WEBSOCKET_TIMEOUT / 1000}秒）`));
        }
      }, WEBSOCKET_TIMEOUT);

      ws.on("open", () => {
        // 仅返回关键信息，精简响应
        const wsInfo = {
          connected: true,
          protocol: ws.protocol || null
        };

        ws.close();
        safeResolve(wsInfo);
      });

      ws.on("error", (err) => {
        // 处理各种 WebSocket 连接错误
        const errorMsg = err.message || "";
        const errorCode = err.code || "";

        if (errorMsg.includes("EACCES") ||
          errorMsg.includes("permission denied") ||
          errorMsg.includes("EPERM")) {
          safeReject(new Error("当前环境不支持 WebSocket 检测（权限限制）"));
        } else if (errorMsg.includes("ECONNREFUSED") ||
          errorCode === "ECONNREFUSED") {
          safeReject(new Error("WebSocket 连接被拒绝（目标服务器未开放该端口或服务）"));
        } else if (errorMsg.includes("ETIMEDOUT") ||
          errorMsg.includes("timeout")) {
          safeReject(new Error("WebSocket 连接超时"));
        } else if (errorMsg.includes("ENOTFOUND") ||
          errorMsg.includes("getaddrinfo")) {
          safeReject(new Error("无法解析目标地址"));
        } else {
          safeReject(new Error(errorMsg || "WebSocket 连接失败"));
        }
      });

      ws.on("close", () => {
        // close 事件不触发 reject，因为可能是正常关闭
      });
    } catch (err) {
      safeReject(new Error(`创建 WebSocket 连接失败: ${err.message}`));
    }
  });
}

// ------------------- CDN Trace 检测（修正版）-------------------
async function testCDNTrace(ip, port = DEFAULT_PORT, host) {
  return new Promise((resolve) => {
    const options = {
      hostname: ip, // 用传入的 IP 建立连接
      port: port,
      path: '/cdn-cgi/trace',
      method: 'GET',
      rejectUnauthorized: false,
      timeout: CDN_TRACE_TIMEOUT,
      servername: host, // SNI 设置
      headers: {
        'Host': host
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => (data += chunk));

      res.on('end', () => {
        if (res.statusCode !== 200 || !data?.trim()) {
          resolve({
            success: false,
            warp: 'off',
            reason: `HTTP ${res.statusCode}`
          });
          return;
        }

        // 提取 warp 状态（修正正则）
        const warpMatch = data.match(/warp=(\w+)/);
        const warp = warpMatch ? warpMatch[1] : 'off';



        resolve({
          success: true,
          warp: warp === 'on' ? 'on' : 'off'
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        warp: 'off',
        reason: err.message || '连接失败'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        warp: 'off',
        reason: `请求超时（${CDN_TRACE_TIMEOUT / 1000}秒）`
      });
    });

    req.end();
  });
}

// ------------------- 404 处理 -------------------
app.use((req, res) => {
  // 对于静态资源请求返回 204，避免产生错误日志
  if (req.path.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/i)) {
    res.status(204).end();
    return;
  }
  res.status(404).json({
    error: "未找到资源",
    message: `路径 ${req.path} 不存在`
  });
});

// ------------------- 错误处理中间件（必须在所有路由之后）-------------------
app.use((err, req, res, next) => {
  logger.error("服务器错误", { error: err.message, stack: err.stack });
  res.status(500).json({
    error: "服务器内部错误",
    message: err.message
  });
});

// ------------------- 启动服务 -------------------
function startServer() {
  try {
    // 先启动服务器，不等待 GeoIP 加载
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      logger.info('CF IP 检测服务已启动');
      console.log(`  端口: ${PORT}`);
      console.log(`  API: http://localhost:${PORT}/api`);
      console.log(`  Web: http://localhost:${PORT}/`);
      console.log('\n功能配置:');
      console.log(`  WebSocket: ${DISABLE_WEBSOCKET ? '⏭️ 已禁用' : '✅ 已启用'}`);
      console.log(`  CDN Trace: ${DISABLE_CDN_TRACE ? '⏭️ 已禁用' : '✅ 已启用'}`);
      console.log(`  GeoIP: ✅ 自动加载（后台）`);
      console.log(`  日志级别: ${LOG_LEVEL}`);
      console.log(`  检测DEBUG日志: ${ENABLE_DETECTION_DEBUG ? '✅ 已启用' : '⏭️ 已禁用（减少日志输出）'}`);
      console.log(`  静默模式: ${QUIET_MODE ? '✅ 已启用（不输出检测内容）' : '⏭️ 已禁用'}`);
      console.log(`  内存清理阈值: ${MEMORY_CLEANUP_THRESHOLD} MB`);
      console.log('='.repeat(60) + '\n');

      // 输出内存使用情况
      logMemoryUsage('启动时');
    });

    // 处理优雅关闭
    process.on('SIGTERM', () => {
      logger.info('收到 SIGTERM 信号，正在关闭服务器...');
      logMemoryUsage('关闭前');
      server.close(() => {
        logger.info('服务器已关闭');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('收到 SIGINT 信号，正在关闭服务器...');
      logMemoryUsage('关闭前');
      server.close(() => {
        logger.info('服务器已关闭');
        process.exit(0);
      });
    });

  } catch (err) {
    logger.error('启动服务器失败', { error: err.message });
    process.exit(1);
  }
}


startServer();
