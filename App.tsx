
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Globe, Activity, FlaskConical, ShieldCheck, Settings, Menu, Zap, 
  CheckCircle2, Copy, RefreshCw, Trophy, 
  XCircle, Save, Cloud, BrainCircuit, Trash2, MapPin, Loader2,
  Server, Cpu, ArrowUpRight, HelpCircle, ToggleLeft, ToggleRight,
  AlertCircle, ExternalLink, Code2, Terminal, Info, Link2, Wifi, WifiOff, CloudDownload, Box
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

// 终极修复版 Worker 源码：增强了对请求体和 CORS 的处理
const WORKER_PROXY_CODE = `
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-target-url",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const targetUrl = request.headers.get("x-target-url");
    if (!targetUrl) {
      return new Response(JSON.stringify({ success: true, message: "CloudVista Proxy Ready" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const newHeaders = new Headers();
      ['authorization', 'content-type', 'accept'].forEach(h => {
        const v = request.headers.get(h);
        if (v) newHeaders.set(h, v);
      });

      // 关键：克隆请求以读取 Body
      const body = request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.arrayBuffer() 
        : null;

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: body,
        redirect: 'follow'
      });

      const respBody = await response.arrayBuffer();
      const finalHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach(k => finalHeaders.set(k, corsHeaders[k]));

      return new Response(respBody, {
        status: response.status,
        headers: finalHeaders
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
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
  const [isFetchingCloud, setIsFetchingCloud] = useState(false);

  const [cfConfig, setCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    return saved ? JSON.parse(saved) : { apiToken: '', zoneId: '', domain: '', proxyUrl: '', useProxy: true };
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

  const fetchCloudNodes = async () => {
    if (!cfConfig.apiToken || !cfConfig.zoneId) return alert("请先完成系统配置");
    setIsFetchingCloud(true);
    try {
      const cloudNodes = await cloudflareApi.listDnsRecords(cfConfig);
      setNodes(cloudNodes);
    } catch (e: any) {
      alert(`同步失败: ${e.message}`);
    } finally {
      setIsFetchingCloud(false);
    }
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [newNodeData, setNewNodeData] = useState({ id: '', name: '', mode: 'dns' });
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [optimalIPs, setOptimalIPs] = useState<OptimalIP[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => { localStorage.setItem('cv_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('cv_config', JSON.stringify(cfConfig)); }, [cfConfig]);
  useEffect(() => { fetchUserInfo().then(setUserInfo); }, []);

  const handleConfirmDeploy = async () => {
    const cleanId = newNodeData.id.trim().toLowerCase();
    if (!cleanId) return alert("请输入子域名");
    if (!cfConfig.domain) return alert("请先配置主域名");

    setDeployLogs(["[START] 启动部署流程...", `[CONFIG] 目标子域名: ${cleanId}`]);
    setIsDeploying(true);

    try {
      // 1. 尝试获取优选 IP
      let targetIP = optimalIPs[0]?.ip;
      if (!targetIP) {
        setDeployLogs(p => [...p, "[WARN] 未发现测速结果，将使用官方默认 Anycast IP"]);
        targetIP = "104.16.0.1";
      } else {
        setDeployLogs(p => [...p, `[INFO] 选用最优 IP: ${targetIP} (${optimalIPs[0].latency}ms)`]);
      }

      // 2. 调用 API 创建 DNS
      setDeployLogs(p => [...p, "[API] 正在通过代理提交 Cloudflare DNS 记录..."]);
      const res = await cloudflareApi.createDnsRecord(cfConfig, {
        id: cleanId,
        location: targetIP,
        proxied: true
      });

      setDeployLogs(p => [...p, "[SUCCESS] DNS 记录创建成功！"]);
      
      const newNode: CFNode = {
        id: cleanId,
        name: `${cleanId}.${cfConfig.domain}`,
        location: targetIP,
        coords: [110 + Math.random() * 10, 20 + Math.random() * 10],
        status: 'online',
        latency: optimalIPs[0]?.latency || 50,
        uptime: 100,
        requests: 0,
        lastUpdate: new Date().toISOString(),
        source: 'api'
      };

      setNodes(prev => [newNode, ...prev.filter(n => n.id !== cleanId)]);
      setTimeout(() => setIsCreateModalOpen(false), 2000);
    } catch (e: any) {
      setDeployLogs(p => [...p, `[ERROR] 部署失败: ${e.message}`]);
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
              <StatCard label="解析节点" value={nodes.length} icon={<Server size={20} />} />
              <StatCard label="最优延迟" value={`${optimalIPs[0]?.latency || '--'}ms`} icon={<Zap size={20} />} trendPositive />
              <StatCard label="出口 IP" value={userInfo?.ip || '...'} icon={<Globe size={20} />} />
              <div className="bg-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
                 <p className="text-indigo-200 text-[10px] font-bold uppercase mb-1">Worker 状态</p>
                 <h4 className="text-xl font-black">{proxyStatus === 'online' ? '代理已就绪' : '等待连接'}</h4>
                 <ArrowUpRight size={60} className="absolute -bottom-2 -right-2 text-white/10" />
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
              <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800">已解析节点</h2>
              <button onClick={fetchCloudNodes} disabled={isFetchingCloud} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black hover:bg-slate-50 shadow-sm">
                {isFetchingCloud ? <Loader2 className="animate-spin" size={16} /> : <CloudDownload size={16} />}
                刷新云端记录
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nodes.map(node => (
                <div key={`${node.id}-${node.location}`} onClick={() => setSelectedNode(node)} className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-indigo-500 cursor-pointer transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600"><Server size={28} /></div>
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">ACTIVE</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 truncate">{node.name}</h4>
                  <div className="mt-4 text-xs font-mono text-slate-400 bg-slate-50 p-3 rounded-xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div> {node.location}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'lab':
        return (
          <div className="space-y-8">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
               <div className="relative z-10">
                  <Trophy size={48} className="text-amber-400 mb-6" />
                  <h2 className="text-4xl font-black mb-4">优选实验室</h2>
                  <p className="text-slate-400 max-w-md mb-8">实时探测全球 Cloudflare 节点延迟，为你找出最适合当前宽带环境的接入点。</p>
                  <button 
                    onClick={async () => {
                      setIsOptimizing(true);
                      const results = await testAndRankIPs(() => {});
                      setOptimalIPs(results);
                      setIsOptimizing(false);
                    }} 
                    disabled={isOptimizing}
                    className="px-12 py-5 bg-indigo-600 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-xl shadow-indigo-500/20"
                  >
                    {isOptimizing ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                    {isOptimizing ? '正在进行全球探测...' : '立即开始优选'}
                  </button>
               </div>
               <BrainCircuit size={300} className="absolute -right-20 -bottom-20 text-white/5" />
            </div>

            {optimalIPs.length > 0 && (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">优选 IP 排行榜</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {optimalIPs.map((ip, i) => (
                    <div key={ip.ip} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                        <div>
                          <p className="font-mono font-bold text-slate-700">{ip.ip}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">Cloudflare Anycast</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-indigo-600">{ip.latency}ms</p>
                        <p className="text-[10px] text-emerald-500 font-bold">丢包率: {ip.packetLoss}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 'settings':
        return (
          <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm">
                  <h3 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-2"><ShieldCheck className="text-indigo-600" /> API 认证凭据</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Global API Token</label>
                      <input type="password" value={cfConfig.apiToken} onChange={e => setCfConfig({...cfConfig, apiToken: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Zone ID</label>
                      <input type="text" value={cfConfig.zoneId} onChange={e => setCfConfig({...cfConfig, zoneId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">主域名 (Root Domain)</label>
                      <input type="text" value={cfConfig.domain} onChange={e => setCfConfig({...cfConfig, domain: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="shiye.ggff.net" />
                    </div>
                    <button onClick={() => { localStorage.setItem('cv_config', JSON.stringify(cfConfig)); alert('设置已成功保存！'); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                      保存认证配置
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-black">CORS 代理 Worker</h3>
                      <div className="flex items-center gap-2">
                        {proxyStatus === 'online' ? <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded">已在线</span> : <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-[10px] font-black rounded">未配置</span>}
                        <button onClick={checkProxyStatus} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><RefreshCw size={16} /></button>
                      </div>
                    </div>
                    <div className="mb-8">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">代理端 URL</label>
                      <input type="text" value={cfConfig.proxyUrl} onChange={e => setCfConfig({...cfConfig, proxyUrl: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm font-mono text-indigo-400 outline-none focus:border-indigo-500" placeholder="https://xxx.workers.dev" />
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(WORKER_PROXY_CODE); alert('最新版代理源码已复制'); }} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black flex items-center justify-center gap-2 border border-white/10 transition-all">
                      <Code2 size={20} /> 复制最新版 Worker 源码
                    </button>
                    <p className="mt-6 text-[11px] text-slate-500 leading-relaxed font-medium">注意：如果您在部署节点时遇到 405 错误，请务必更新 Worker 源码到最新版本，并确保代理 URL 不包含结尾的斜杠。</p>
                  </div>
                  <Terminal size={120} className="absolute -bottom-8 -right-8 text-white/5" />
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
        <header className="h-24 bg-white/50 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><Menu size={24} /></button>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex flex-col items-end">
                <p className="text-[10px] font-black text-slate-400 uppercase">当前区域</p>
                <p className="text-xs font-bold text-indigo-600">{userInfo?.city || '定位中'}</p>
             </div>
             <button onClick={() => setIsCreateModalOpen(true)} className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2">
               <Zap size={18} /> 同步解析节点
             </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {renderContentView()}
        </div>
      </main>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl p-10 animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800">节点部署中心</h3>
                <button onClick={() => setIsCreateModalOpen(false)}><XCircle size={28} className="text-slate-200 hover:text-rose-500 transition-colors" /></button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">子域名 (Subdomain)</label>
                     <div className="relative">
                       <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={newNodeData.id} onChange={e => setNewNodeData({...newNodeData, id: e.target.value.replace(/[^a-zA-Z0-9-]/g, '')})} placeholder="例如: gj" />
                       <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">.{cfConfig.domain || 'domain'}</div>
                     </div>
                   </div>
                   
                   <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-[2rem] space-y-3">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-600 text-white rounded-lg"><Zap size={16} /></div>
                         <p className="text-xs font-black text-indigo-900">将采用当前最优 IP</p>
                      </div>
                      <p className="text-[10px] text-indigo-600/70 font-medium leading-relaxed">系统将自动为您在 Cloudflare DNS 中创建 A 记录，指向延迟最低的 Anycast 接入点。</p>
                   </div>

                   <button onClick={handleConfirmDeploy} disabled={isDeploying} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                     {isDeploying ? <Loader2 className="animate-spin" /> : <Box size={20} />}
                     {isDeploying ? '正在同步至 Cloudflare...' : '立即同步至云端'}
                   </button>
                </div>
                <div className="bg-slate-900 rounded-[2.5rem] p-6 flex flex-col relative overflow-hidden">
                   <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-3 custom-scrollbar pr-2 leading-relaxed relative z-10">
                      {deployLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center opacity-50">
                           <Terminal size={32} className="mb-2" />
                           <p>等待操作...</p>
                        </div>
                      ) : deployLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                           <span className="text-slate-700 shrink-0">[{i+1}]</span>
                           <p className={log.includes('[ERROR]') ? 'text-rose-400 font-bold' : log.includes('[SUCCESS]') ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{log}</p>
                        </div>
                      ))}
                   </div>
                   <div className="absolute bottom-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Code2 size={120} className="text-white" />
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-10 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black text-slate-800">配置详情</h3>
              <button onClick={() => setSelectedNode(null)}><XCircle size={28} className="text-slate-200 hover:text-rose-500" /></button>
            </div>
            
            <div className="bg-slate-900 p-10 rounded-[3rem] flex flex-col items-center text-center text-white mb-10 shadow-2xl relative overflow-hidden">
               <div className="bg-white p-6 rounded-[2.5rem] mb-8 relative z-10 shadow-xl">
                 <QRCodeSVG value={`vless://${selectedNode.id}@${selectedNode.location}:443?encryption=none&security=tls&sni=${selectedNode.name}&type=ws&host=${selectedNode.name}&path=%2F#${selectedNode.id}`} size={200} />
               </div>
               <div className="w-full space-y-4 relative z-10">
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                    <p className="text-[10px] text-slate-500 font-black mb-1 uppercase tracking-widest">节点域名</p>
                    <p className="font-mono text-sm break-all font-bold">{selectedNode.name}</p>
                 </div>
                 <button onClick={() => { navigator.clipboard.writeText(`vless://${selectedNode.id}@${selectedNode.location}:443?encryption=none&security=tls&sni=${selectedNode.name}&type=ws&host=${selectedNode.name}&path=%2F#${selectedNode.id}`); alert('已复制到剪贴板'); }} className="w-full py-4 bg-indigo-600 rounded-2xl text-xs font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
                    复制 VLESS 订阅链接
                 </button>
               </div>
               <BrainCircuit size={150} className="absolute -left-10 -bottom-10 text-white/5" />
            </div>

            <div className="space-y-4">
               <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">技术参数</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                     <p className="text-[10px] text-slate-400 font-black mb-1">传输协议</p>
                     <p className="text-xs font-bold">WebSocket + TLS</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                     <p className="text-[10px] text-slate-400 font-black mb-1">SNI/HOST</p>
                     <p className="text-xs font-bold truncate">{selectedNode.name}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{icon: any, label: string, active?: boolean, sidebarOpen: boolean, onClick: () => void}> = ({ icon, label, active, sidebarOpen, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'}`}>
    <div className={`${active ? 'scale-110' : ''} transition-transform`}>{icon}</div> 
    {sidebarOpen && <span className="text-sm tracking-tight">{label}</span>}
  </button>
);

export default App;
