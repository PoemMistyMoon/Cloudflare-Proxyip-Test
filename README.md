# Cloudflare IP 检测工具

本项目基于 **[cf-proxyip-test](https://github.com/mountain787/cf-proxyip-test)** 二次修改而来，在此感谢！修改部分内容并且美化前端，同时适配竖屏界面，项目为前后端一体的单文件实现，开箱即用。

---

## 项目简介

用于检测 IP / 域名是否为 Cloudflare CDN 节点，并提供基础网络可用性信息，适合节点筛选与简单测试场景。

支持能力：

- TLS 连接检测
- CDN Trace 检测
- WebSocket 实际连接测试
- Warp 状态识别
- GeoIP / ASN 信息查询
- 域名解析后批量检测

---

## 使用方法

确保你的服务器已安装 **Node.js 18.0.0 或更高版本**。

```bash
#拉取项目并且进入项目目录

# 安装依赖
npm install

# 直接启动
node start.js

# 或使用 systemctl / PM2 等方式运行（具体方式自行了解）
```

服务默认运行在：

```
http://localhost:8888
```

---

## API 简述

```
GET /api
```

常用参数：

- `ip`：IP / 域名 / 域名:端口
- `port`：端口（默认 443）
- `host`：SNI Host（可选）
- `wsPath`：WebSocket 路径（可选）

---

## 变量与参数配置（start.js）

以下为项目中常用的核心配置项，可按需修改：

```js
// 服务端口
const PORT = 8888;

// 超时配置（毫秒）
const TLS_TIMEOUT = 3000;        // TLS 连接超时
const CDN_TRACE_TIMEOUT = 3000;  // CDN Trace 请求超时
const WEBSOCKET_TIMEOUT = 3000;  // WebSocket 连接超时

// WebSocket 默认路径
const DEFAULT_WS_PATH = '/';

// Host / SNI 默认值
const DEFAULT_HOST = 'speed.cloudflare.com';

// 缓存与限流（如启用）
const CACHE_TTL = 30000;         // 缓存时间
const RATE_LIMIT_WINDOW = 60000; // 限流窗口
const MAX_REQUESTS_PER_IP = 60;  // 单 IP 请求上限
```

---

## 致谢

- [cf-proxyip-test](https://github.com/mountain787/cf-proxyip-test)
- [GeoLite2](https://www.maxmind.com/en/geoip2-databases)


---

本项目仅用于学习与研究，请勿用于非法用途。

---

## 📄 许可证

本项目遵循 MIT 许可证。
