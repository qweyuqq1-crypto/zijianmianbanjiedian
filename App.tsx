
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Globe, Activity, FlaskConical, ShieldCheck, Settings, Menu, Zap, 
  CheckCircle2, Copy, RefreshCw, Trophy, 
  XCircle, Save, Cloud, BrainCircuit, Trash2, MapPin, Loader2,
  Server, Cpu, ArrowUpRight, HelpCircle, ToggleLeft, ToggleRight,
  AlertCircle, ExternalLink, Code2, Terminal, Info, Link2, Wifi, WifiOff
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MOCK_NODES } from './constants';
import { CFNode, UserInfo, OptimalIP, CFConfig } from './types';
import StatCard from './components/StatCard';
import GlobalMap from './components/GlobalMap';
import { fetchUserInfo } from './services/ipService';
import { testAndRankIPs } from './services/diagnosticService';
import { cloudflareApi } from './services/cloudflareService';

type ViewType = 'dashboard' | 'network' | 'lab' | 'settings';

// 终极稳定版 Worker 源码（Header 转发版）
const WORKER_PROXY_CODE = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. 提取目标 URL：优先从 Header 提取，其次从 Query 提取
    let targetUrl = request.headers.get("x-target-url");
    if (!targetUrl) {
      targetUrl = decodeURIComponent(url.search.slice(1));
    }
    
    // 2. 处理跨域预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, x-target-url",
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    if (!targetUrl || !targetUrl.startsWith('http')) {
      return new Response(JSON.stringify({
        success: false, 
        message: "Proxy Ready. Use 'x-target-url' header to specify destination."
      }), { 
        status: 200, 
        headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"} 
      });
    }
    
    try {
      // 3. 构建转发请求头
      const newHeaders = new Headers();
      const allowedHeaders = ['authorization', 'content-type', 'accept', 'user-agent'];
      for (const [key, value] of request.headers.entries()) {
        if (allowedHeaders.includes(key.toLowerCase())) {
          newHeaders.set(key, value);
        }
      }

      // 4. 执行转发
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: (request.method !== 'GET' && request.method !== 'HEAD') ? await request.arrayBuffer() : null,
        redirect: 'follow'
      });
      
      const responseData = await response.arrayBuffer();
      
      return new Response(responseData, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "*"
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ 
        success: false, 
        errors: [{ message: "Proxy Error: " + e.message }] 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};`;

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [nodes, setNodes] = useState<CFNode[]>(() => {
    const saved = localStorage.getItem('cv_nodes');
    return saved ? JSON.parse(saved) : MOCK_NODES;
  });
  
  const [selectedNode, setSelectedNode] = useState<CFNode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [cfConfig, setCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    const envDefaults = {
      apiToken: '', zoneId: '', domain: '', proxyUrl: '', useProxy: true
    };
    return saved ? JSON.parse(saved) : envDefaults;
  });

  const [proxyStatus, setProxyStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');

  const checkProxyStatus = async () => {
    if (!cfConfig.proxyUrl) return;
    setProxyStatus('checking');
    try {
      const res = await fetch(cfConfig.proxyUrl);
      setProxyStatus(res.ok ? 'online' : 'offline');
    } catch (e) {
      setProxyStatus('offline');
    }
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [newNodeData, setNewNodeData] = useState({ id: '', name: '' });
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [optimalIPs, setOptimalIPs] = useState<OptimalIP[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [probeProgress, setProbeProgress] = useState({ currentIP: '', percent: 0 });

  useEffect(() => { localStorage.setItem('cv_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('cv_config', JSON.stringify(cfConfig)); }, [cfConfig]);
  useEffect(() => { fetchUserInfo().then(setUserInfo); }, []);

  const stats = useMemo(() => {
    const online = nodes.filter(n => n.status === 'online');
    return {
      avgLatency: online.length ? Math.round(online.reduce((a, b) => a + b.latency, 0) / online.length) : 0,
      onlineCount: online.length,
      totalRequests: nodes.reduce((a, b) => a + b.requests, 0)
    };
  }, [nodes]);

  const handleConfirmDeploy = async () => {
    const cleanId = newNodeData.id.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    if (!cleanId) return alert("子域名不能为空");
    if (!cfConfig.proxyUrl) return alert("请先在设置中部署并填写代理 URL");

    setDeployLogs(["[INFO] 正在启动部署程序...", `[INFO] 目标: ${cleanId}.${cfConfig.domain}`]);
    setIsDeploying(true);

    try {
      const targetIP = optimalIPs[0]?.ip || "104.16.0.1";
      const newNode: CFNode = {
        id: cleanId,
        name: newNodeData.name || cleanId,
        location: targetIP,
        coords: [110 + Math.random() * 10, 20 + Math.random() * 10],
        status: 'online',
        latency: optimalIPs[0]?.latency || 50,
        uptime: 100,
        requests: 0,
        lastUpdate: new Date().toISOString(),
        source: 'api',
        proxied: true,
        type: 'A'
      };

      await cloudflareApi.createDnsRecord(cfConfig, newNode);
      setDeployLogs(prev => [...prev, "[SUCCESS] Cloudflare 解析已成功同步！"]);
      setNodes([newNode, ...nodes]);
      setTimeout(() => setIsCreateModalOpen(false), 1500);
    } catch (error: any) {
      setDeployLogs(prev => [...prev, `[ERROR] ${error.message}`]);
    } finally {
      setIsDeploying(false);
    }
  };

  const renderContentView = () => {
    switch(activeView) {
      case 'dashboard':
        return (
          <div className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="平均延迟" value={`${stats.avgLatency}ms`} icon={<Zap size={20} />} trendPositive />
              <StatCard label="在线节点" value={`${stats.onlineCount}/${nodes.length}`} icon={<Server size={20} />} />
              <StatCard label="今日解析" value={`${stats.totalRequests.toLocaleString()}`} icon={<ArrowUpRight size={20} />} />
              <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                 <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">系统评分</p>
                 <h4 className="text-4xl font-black">9.8</h4>
                 <BrainCircuit size={80} className="absolute -bottom-4 -right-4 text-white/5" />
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
              <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nodes.map(node => (
              <div key={node.id} onClick={() => setSelectedNode(node)} className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-indigo-500 cursor-pointer transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600"><Server size={28} /></div>
                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">ONLINE</span>
                    <p className="text-xs font-bold text-slate-400 mt-2">{node.latency}ms</p>
                  </div>
                </div>
                <h4 className="text-xl font-black text-slate-800">{node.name}</h4>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-50 p-3 rounded-xl">
                  <MapPin size={12} className="text-indigo-400" /> {node.location}
                </div>
              </div>
            ))}
          </div>
        );
      case 'lab':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden">
                <Trophy size={48} className="text-amber-400 mb-6" />
                <h2 className="text-3xl font-black mb-4">智能优选 Anycast</h2>
                <button 
                  onClick={async () => {
                    setIsOptimizing(true);
                    const results = await testAndRankIPs((ip, p) => setProbeProgress({currentIP: ip, percent: p}));
                    setOptimalIPs(results);
                    setIsOptimizing(false);
                  }} 
                  className="px-10 py-5 bg-indigo-600 rounded-2xl font-black flex items-center gap-3 mt-8 disabled:opacity-50"
                  disabled={isOptimizing}
                >
                  {isOptimizing ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                  {isOptimizing ? `测速中 ${probeProgress.percent}%` : '开始优选'}
                </button>
              </div>
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200">
                <h3 className="text-xl font-bold mb-6">访问环境</h3>
                <div className="p-6 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 font-black uppercase mb-1">公网出口 IP</p>
                  <p className="text-2xl font-mono font-black">{userInfo?.ip || '检测中...'}</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <h2 className="text-2xl font-black text-slate-800">CF API 配置</h2>
                  <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline">
                    获取 Token <ExternalLink size={12} />
                  </a>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase block mb-2">API Token</label>
                    <input type="password" value={cfConfig.apiToken} onChange={e => setCfConfig({...cfConfig, apiToken: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="生成的 API 令牌" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase block mb-2">Zone ID</label>
                    <input type="text" value={cfConfig.zoneId} onChange={e => setCfConfig({...cfConfig, zoneId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="域名的区域 ID" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase block mb-2">解析主域名</label>
                    <input type="text" value={cfConfig.domain} onChange={e => setCfConfig({...cfConfig, domain: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: example.com" />
                  </div>
                  <button onClick={() => { localStorage.setItem('cv_config', JSON.stringify(cfConfig)); alert('已保存'); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                    <Save size={18} /> 保存配置
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black">CORS 后端 (关键)</h2>
                    <div className="flex items-center gap-2">
                      {proxyStatus === 'online' ? <span className="text-[10px] text-emerald-400 font-bold">已连接</span> : <span className="text-[10px] text-rose-400 font-bold">未就绪</span>}
                      <button onClick={checkProxyStatus} className="p-2 hover:bg-white/10 rounded-lg"><RefreshCw size={14} /></button>
                    </div>
                  </div>
                  <div className="mb-6">
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Worker 代理地址</label>
                    <input type="text" value={cfConfig.proxyUrl} onChange={e => setCfConfig({...cfConfig, proxyUrl: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm font-mono outline-none text-indigo-400 focus:border-indigo-500" placeholder="https://xxx.workers.dev" />
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(WORKER_PROXY_CODE); alert('稳定版源码已复制'); }} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold flex items-center justify-center gap-2 border border-white/10 text-sm">
                    <Code2 size={18} /> 复制 Header 转发版源码 (防 405)
                  </button>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8">
                  <h3 className="text-indigo-900 font-black mb-4 flex items-center gap-2"><HelpCircle size={18} /> 防 405 部署说明</h3>
                  <ul className="space-y-3 text-xs text-indigo-800/80 font-medium">
                    <li>1. 点击上方按钮复制 **Header 转发版** 源码。</li>
                    <li>2. 在 Cloudflare Worker 中替换旧代码并重新部署。</li>
                    <li>3. 这种新机制通过 `x-target-url` 请求头转发，不会因为 URL 包含特殊字符而被防火墙拦截。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-white border-r border-slate-100 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100"><Cloud size={24} /></div>
          {sidebarOpen && <h1 className="text-xl font-black text-slate-800 tracking-tight">CloudVista</h1>}
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="控制中心" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<Globe size={20} />} label="节点解析" active={activeView === 'network'} onClick={() => setActiveView('network')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<FlaskConical size={20} />} label="优选实验室" active={activeView === 'lab'} onClick={() => setActiveView('lab')} sidebarOpen={sidebarOpen} />
          <div className="pt-4 border-t border-slate-50">
            <NavItem icon={<Settings size={20} />} label="系统配置" active={activeView === 'settings'} onClick={() => setActiveView('settings')} sidebarOpen={sidebarOpen} />
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><Menu size={20} /></button>
          <button onClick={() => setIsCreateModalOpen(true)} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95">
            <Zap size={18} /> 同步解析节点
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {renderContentView()}
        </div>
      </main>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl p-10 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800">同步至 Cloudflare</h3>
                <button onClick={() => setIsCreateModalOpen(false)}><XCircle size={24} className="text-slate-200 hover:text-rose-500" /></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">子域名 (英文/数字)</label>
                     <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.id} onChange={e => setNewNodeData({...newNodeData, id: e.target.value.replace(/[^a-zA-Z0-9-]/g, '')})} placeholder="例如: node1" />
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">节点名称</label>
                     <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.name} onChange={e => setNewNodeData({...newNodeData, name: e.target.value})} placeholder="例如: 香港节点" />
                   </div>
                   <button onClick={handleConfirmDeploy} disabled={isDeploying} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 flex items-center justify-center gap-2">
                     {isDeploying ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />} {isDeploying ? '同步中...' : '提交部署'}
                   </button>
                </div>
                <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col overflow-hidden">
                   <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar pr-2">
                      {deployLogs.length === 0 ? <p className="text-slate-600 italic">等待操作...</p> : deployLogs.map((log, i) => (
                        <p key={i} className={log.includes('[ERROR]') ? 'text-rose-400' : log.includes('[SUCCESS]') ? 'text-emerald-400' : 'text-slate-400'}>{log}</p>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-slate-800">节点配置</h3>
              <button onClick={() => setSelectedNode(null)}><XCircle size={24} className="text-slate-200" /></button>
            </div>
            <div className="bg-slate-900 p-10 rounded-[3rem] flex flex-col items-center text-center text-white mb-8">
               <div className="bg-white p-5 rounded-[2rem] mb-6"><QRCodeSVG value={`vless://${selectedNode.id}@${selectedNode.location}:443#${selectedNode.name}`} size={180} /></div>
               <button onClick={() => { navigator.clipboard.writeText(`vless://${selectedNode.id}@${selectedNode.location}:443#${selectedNode.name}`); alert('已复制'); }} className="w-full py-4 bg-indigo-600 rounded-2xl text-xs font-black flex items-center justify-center gap-2">
                  <Copy size={16} /> 复制配置链接
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{icon: any, label: string, active?: boolean, sidebarOpen: boolean, onClick: () => void}> = ({ icon, label, active, sidebarOpen, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-black' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'}`}>
    {icon} {sidebarOpen && <span className="text-sm tracking-tight">{label}</span>}
  </button>
);

export default App;
