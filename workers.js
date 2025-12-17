addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
    const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>☁️ CloudflareIP 批量检测工具 Pro</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
      <style>
          body { background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; color: #334155; padding-bottom: 80px; }
          .glass-card { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border-radius: 1.25rem; border: 1px solid rgba(255, 255, 255, 0.4); display: flex; flex-direction: column; }
          .input-focus { transition: all 0.2s ease; border: 1px solid #e2e8f0; background: rgba(255, 255, 255, 0.5); }
          .input-focus:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); background: #fff; }
          
          /* 调整输入框默认高度，从 300px 降至 160px */
          #targetList { min-height: 160px; resize: vertical; }
          .resizable-textarea { min-height: 350px; resize: vertical; flex-grow: 1; }
          
          .btn-disabled { background-color: #94a3b8 !important; cursor: not-allowed; opacity: 0.7; pointer-events: none; }
          
          .tip-label { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; font-weight: 500; }

          .github-footer {
              margin-top: 50px;
              text-align: center;
              transition: all 0.3s ease;
          }
          .github-link {
              display: inline-flex;
              align-items: center; 
              justify-content: center;
              gap: 8px;
              padding: 10px 24px;
              background: rgba(30, 41, 59, 0.05);
              border-radius: 50px;
              color: #475569;
              text-decoration: none;
              font-weight: 600;
              font-size: 0.9rem;
              line-height: 1; 
              transition: all 0.3s ease;
              border: 1px solid rgba(30, 41, 59, 0.1);
          }
          .github-link:hover {
              background: #1e293b;
              color: white;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .github-link i {
              line-height: 0; 
          }
      </style>
  </head>
  <body class="py-10 px-4">
      <div class="max-w-4xl mx-auto">
          <div class="text-center mb-8">
              <h1 class="text-2xl md:text-4xl font-extrabold text-slate-800 mb-2 md:mb-3 tracking-tight">☁️ CloudflareIP 批量检测工具</h1>
              <p class="text-sm md:text-base text-slate-500 font-medium">轻松高效 · 简约美观 · 并发控制</p>
          </div>
          <div class="glass-card p-8 mb-8 shadow-2xl">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div class="md:col-span-3">
                      <label class="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">
                          节点列表<span class="text-red-400">*</span>
                      </label>
                      <textarea id="targetList" class="w-full p-4 rounded-xl input-focus font-mono text-sm" placeholder="格式：IP/domain:port&#10;无port自动补全为443&#10;1.2.3.4:443&#10;1.1.1.1&#10;example.com"></textarea>
                      <div class="flex justify-end"><span class="tip-label">↘ 拖拽调整区域大小</span></div>
                  </div>
  
                  <div>
                      <label class="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">Host (可选)</label>
                      <input type="text" id="host" class="w-full p-3 rounded-xl input-focus" placeholder="123.com">
                  </div>
                  <div>
                      <label class="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">WS 路径 (可选)</label>
                      <input type="text" id="wsPath" class="w-full p-3 rounded-xl input-focus" placeholder="/">
                  </div>
                  <div>
                      <label class="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">并发限制</label>
                      <select id="concurrency" class="w-full p-3 rounded-xl input-focus bg-white/50">
                          <option value="1">1 线程 (最稳)</option>
                          <option value="3" selected>3 线程 (推荐)</option>
                          <option value="5">5 线程 (加速)</option>
                      </select>
                  </div>
                  <div class="md:col-span-3">
                      <label class="block text-sm font-bold text-slate-600 mb-2 uppercase tracking-wider">
                          API 域名 <span class="text-red-400">*</span>
                      </label>
                      <input type="text" id="apiDomain" class="w-full p-3 rounded-xl input-focus" placeholder="ipt.ssc.de5.net">
                  </div>
              </div>
  
              <button onclick="startCheck()" id="btnStart" class="w-full mt-8 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 text-lg">
                  <i class="fas fa-play" id="btnIcon"></i> <span id="btnText">开始批量检测</span>
              </button>
          </div>
  
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              <div class="glass-card shadow-lg">
                  <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
                      <h2 class="text-emerald-600 font-bold flex items-center gap-2"><i class="fas fa-check-circle"></i> 成功 (<span id="successCount">0</span>)</h2>
                      <button onclick="copyToClipboard('successOutput')" class="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all">一键复制</button>
                  </div>
                  <div class="flex-grow flex flex-col p-1">
                      <textarea id="successOutput" readonly class="resizable-textarea p-4 bg-transparent text-sm text-emerald-800 outline-none border-none font-mono" placeholder="成功检测到的节点..."></textarea>
                      <div class="flex justify-end px-2"><span class="tip-label">↘ 拖拽调整</span></div>
                  </div>
              </div>
  
              <div class="glass-card shadow-lg">
                  <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
                      <h2 class="text-rose-600 font-bold flex items-center gap-2"><i class="fas fa-circle-xmark"></i> 失败 (<span id="failCount">0</span>)</h2>
                      <button onclick="copyToClipboard('failOutput')" class="text-xs bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all">复制失败</button>
                  </div>
                  <div class="flex-grow flex flex-col p-1">
                      <textarea id="failOutput" readonly class="resizable-textarea p-4 bg-transparent text-sm text-rose-800 outline-none border-none font-mono" placeholder="无效或超时的节点..."></textarea>
                      <div class="flex justify-end px-2"><span class="tip-label">↘ 拖拽调整</span></div>
                  </div>
              </div>
          </div>
  
          <footer class="github-footer">
              <a href="https://github.com/PoemMistyMoon/Cloudflare-CDNTrace-test" target="_blank" class="github-link">
                  <i class="fab fa-github text-xl"></i>
                  <span>GitHub Repository</span>
              </a>
          </footer>
      </div>
  
      <script>
          async function copyToClipboard(id) {
              const area = document.getElementById(id);
              if (!area.value) return;
              await navigator.clipboard.writeText(area.value);
              const btn = event.currentTarget;
              const originalText = btn.innerText;
              btn.innerText = '已复制';
              setTimeout(() => btn.innerText = originalText, 2000);
          }
  
          async function startCheck() {
              const listText = document.getElementById('targetList').value.trim();
              const apiDomain = document.getElementById('apiDomain').value.trim();
              const host = document.getElementById('host').value.trim();
              const wsPath = document.getElementById('wsPath').value.trim() || '/';
              const concurrency = parseInt(document.getElementById('concurrency').value);
  
              if (!listText || !apiDomain) {
                  alert('请填写必填项');
                  return;
              }

              const officialAsns = [132892, 202623, 395747, 394536, 14789, 13335];
  
              const btn = document.getElementById('btnStart');
              const btnIcon = document.getElementById('btnIcon');
              const btnText = document.getElementById('btnText');
              const sOut = document.getElementById('successOutput');
              const fOut = document.getElementById('failOutput');
  
              btn.disabled = true;
              btn.classList.add('btn-disabled');
              btnIcon.className = 'fas fa-circle-notch fa-spin';
              btnText.innerText = '检测中...';
              
              sOut.value = ''; fOut.value = '';
              document.getElementById('successCount').innerText = '0';
              document.getElementById('failCount').innerText = '0';
  
              const lines = listText.split('\\n').map(l => l.trim()).filter(l => l !== '');
              let sCount = 0; let fCount = 0;
              const pool = new Set();
  
              for (const line of lines) {
                  if (pool.size >= concurrency) await Promise.race(pool);
  
                  let [targetIp, targetPort] = line.split(':');
                  targetPort = targetPort || '443';
  
                  const promise = (async () => {
                      try {
                          const url = new URL(`https://${apiDomain}/api`);
                          url.searchParams.set('ip', targetIp);
                          url.searchParams.set('port', targetPort);
                          url.searchParams.set('host', host);
                          url.searchParams.set('wsPath', wsPath);
                          const res = await fetch(url.toString());
                          const data = await res.json();
                          
                          // 适配多 IP 逻辑
                          const resultsArray = data.results && Array.isArray(data.results) ? data.results : [data];

                          resultsArray.forEach(item => {
                              const currentIp = item.ip || targetIp;
                              const isOfficial = item.geoip && officialAsns.includes(item.geoip.asn);

                              if (item.checks?.cdn_trace === true && !isOfficial) {
                                  const country = item.geoip?.countryName || '未知国家';
                                  const city = item.geoip?.city || '';
                                  sOut.value += \`\${currentIp} \${country} \${city}\\n\`;
                                  sCount++;
                              } else if (isOfficial) {
                                  fOut.value += \`\${currentIp} CF官方IP\\n\`;
                                  fCount++;
                              } else {
                                  fOut.value += \`\${currentIp} 无效\\n\`;
                                  fCount++;
                              }
                          });

                      } catch (e) {
                          fOut.value += \`\${targetIp} 超时/错误\\n\`;
                          fCount++;
                      } finally {
                          document.getElementById('successCount').innerText = sCount;
                          document.getElementById('failCount').innerText = fCount;
                      }
                  })();
  
                  pool.add(promise);
                  promise.finally(() => pool.delete(promise));
              }
              
              await Promise.all(pool);
              btn.disabled = false;
              btn.classList.remove('btn-disabled');
              btnIcon.className = 'fas fa-play';
              btnText.innerText = '开始批量检测';
          }
      </script>
  </body>
  </html>
    `
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
}
