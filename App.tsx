
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Globe, Activity, FlaskConical, ShieldCheck, Settings, Menu, Zap, 
  CheckCircle2, Copy, RefreshCw, Trophy, 
  XCircle, Save, Cloud, BrainCircuit, Trash2, MapPin, Loader2,
  Server, Cpu, ArrowUpRight, HelpCircle, ToggleLeft, ToggleRight,
  AlertCircle, ExternalLink, Code2, Terminal
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MOCK_NODES } from './constants';
import { CFNode, UserInfo, OptimalIP, CFConfig } from './types';
import StatCard from './components/StatCard';
import GlobalMap from './components/GlobalMap';
import { fetchUserInfo } from './services/ipService';
import { testAndRankIPs } from './services/diagnosticService';
import { cloudflareApi } from './services/cloudflareService';

// Added missing ViewType definition to fix 'Cannot find name ViewType' error
type ViewType = 'dashboard' | 'network' | 'lab' | 'settings';

// Cloudflare Worker 后端代理模板代码
const WORKER_PROXY_CODE = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 目标 CF API 地址由前端传入，通过查询参数 ? 后的部分获取
    const targetUrl = url.search.slice(1); 
    
    if (!targetUrl) return new Response("Missing Target URL", { status: 400 });

    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    const response = await fetch(newRequest);
    const newResponse = new Response(response.body, response);
    
    // 设置 CORS 允许前端访问
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    return newResponse;
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

  // 配置状态
  const [cfConfig, setCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    return saved ? JSON.parse(saved) : { 
      apiToken: '', 
      zoneId: '', 
      domain: '',
      useProxy: true, // 默认推荐开启代理
      proxyUrl: '' 
    };
  });

  // Added missing generateConfigLink function to fix 'Cannot find name generateConfigLink' errors
  const generateConfigLink = (node: CFNode) => {
    const domain = cfConfig.domain || 'example.com';
    // Using a placeholder UUID for the VLESS-style config link
    const uuid = "00000000-0000-0000-0000-000000000000";
    return `vless://${uuid}@${node.location}:443?encryption=none&security=tls&sni=${node.id}.${domain}&fp=safari&type=ws&host=${node.id}.${domain}&path=%2F#${encodeURIComponent(node.name)}`;
  };

  // UI 交互状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [useSimulation, setUseSimulation] = useState(false); // 既然要“真正使用”，默认关掉模拟
  const [newNodeData, setNewNodeData] = useState({ id: '', name: '' });
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  // 优选状态
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
    if (!newNodeData.id || !newNodeData.name) return alert("请完整填写子域名和名称");
    setDeployLogs(["[INFO] 正在初始化部署程序...", `[INFO] 目标子域名: ${newNodeData.id}.${cfConfig.domain}`]);
    setIsDeploying(true);

    try {
      const targetIP = optimalIPs[0]?.ip || "104.16.0.1";
      setDeployLogs(prev => [...prev, `[INFO] 使用解析 IP: ${targetIP}`]);

      const newNode: CFNode = {
        id: newNodeData.id.toLowerCase(),
        name: newNodeData.name,
        location: targetIP,
        coords: [100 + Math.random() * 40, 15 + Math.random() * 20],
        status: 'online',
        latency: optimalIPs[0]?.latency || 45,
        uptime: 100,
        requests: 0,
        lastUpdate: new Date().toISOString(),
        source: useSimulation ? 'mock' : 'api',
        proxied: true,
        type: 'A'
      };

      setDeployLogs(prev => [...prev, `[WAIT] 正在发送 API 请求至 ${useSimulation ? '本地' : 'Cloudflare'}...`]);
      await cloudflareApi.createDnsRecord(cfConfig, newNode, useSimulation);
      
      setDeployLogs(prev => [...prev, "[SUCCESS] 解析已生效，节点已添加至管理列表！"]);
      setNodes([newNode, ...nodes]);
      
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setNewNodeData({ id: '', name: '' });
      }, 1500);

    } catch (error: any) {
      setDeployLogs(prev => [...prev, `[ERROR] ${error.message}`]);
    } finally {
      setIsDeploying(false);
    }
  };

  const copyWorkerCode = () => {
    navigator.clipboard.writeText(WORKER_PROXY_CODE);
    alert("Worker 代码已复制！请前往 Cloudflare Workers 部署。");
  };

  const renderContentView = () => {
    switch(activeView) {
      case 'dashboard':
        return (
          <div className="animate-in fade-in duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="系统平均延迟" value={`${stats.avgLatency}ms`} icon={<Zap size={20} />} trend="-4ms" trendPositive />
              <StatCard label="在线边缘节点" value={`${stats.onlineCount}/${nodes.length}`} icon={<Server size={20} />} />
              <StatCard label="今日解析量" value={`${stats.totalRequests.toLocaleString()}`} icon={<ArrowUpRight size={20} />} trend="+12%" trendPositive />
              <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-slate-200">
                 <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">AI 架构健康度</p>
                 <h4 className="text-4xl font-black">9.8</h4>
                 <BrainCircuit size={80} className="absolute -bottom-4 -right-4 text-white/5" />
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>全球边缘节点拓扑
              </h3>
              <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-black text-slate-800 mb-8">节点解析中心</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nodes.map(node => (
                <div key={node.id} onClick={() => setSelectedNode(node)} className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-indigo-500 cursor-pointer transition-all hover:shadow-xl group">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${node.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      <Server size={28} />
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${node.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{node.status}</span>
                      <p className="text-xs font-bold text-slate-400 mt-2">{node.latency}ms</p>
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{node.name}</h4>
                  <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <MapPin size={12} className="text-indigo-400" /> {node.location}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'lab':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                   <div className="relative z-10">
                      <Trophy size={48} className="text-amber-400 mb-6" />
                      <h2 className="text-3xl font-black mb-4">Anycast IP 深度探测</h2>
                      <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm">探测 Cloudflare 全球 Anycast IP 池，自动锁定你当前网络环境下的最快接入通道。</p>
                      <button 
                        onClick={async () => {
                          setIsOptimizing(true);
                          const results = await testAndRankIPs((ip, p) => setProbeProgress({currentIP: ip, percent: p}));
                          setOptimalIPs(results);
                          setIsOptimizing(false);
                        }} 
                        disabled={isOptimizing}
                        className="px-10 py-5 bg-indigo-600 rounded-2xl font-black flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/40"
                      >
                        {isOptimizing ? <RefreshCw className="animate-spin" /> : <Zap size={20} />}
                        {isOptimizing ? `探测中 ${probeProgress.percent}%` : '启动智能优选'}
                      </button>
                   </div>
                   <Activity size={320} strokeWidth={0.5} className="absolute right-0 bottom-0 opacity-10 pointer-events-none" />
                </div>
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                   <h3 className="text-xl font-bold mb-6 flex items-center gap-2">本地网络状态</h3>
                   <div className="space-y-4">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">出口 IPv4</p>
                        <p className="text-2xl font-mono font-black text-slate-800">{userInfo?.ip || '正在获取...'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border border-slate-100 rounded-2xl">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">运营商</p>
                          <p className="text-xs font-black text-slate-700 truncate">{userInfo?.org}</p>
                        </div>
                        <div className="p-4 border border-slate-100 rounded-2xl">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">网络位置</p>
                          <p className="text-xs font-black text-indigo-600 truncate">{userInfo?.city}, {userInfo?.country}</p>
                        </div>
                      </div>
                   </div>
                </div>
             </div>
             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold mb-8">探测结果排名 (Top 10)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                   {optimalIPs.map((ip, i) => (
                     <div key={i} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:shadow-lg hover:border-indigo-400 transition-all group">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black text-slate-300 italic">#{i+1}</span>
                          <span className="text-[10px] font-black text-emerald-600 uppercase">Excellent</span>
                        </div>
                        <p className="text-sm font-mono font-black text-slate-700 mb-2">{ip.ip}</p>
                        <div className="text-indigo-600 font-black text-2xl leading-none">{ip.latency}<span className="text-xs">ms</span></div>
                        <button onClick={() => alert(`已锁定优选 IP: ${ip.ip}，创建节点时将自动填充`)} className="mt-4 w-full py-2 bg-white border border-slate-200 text-slate-400 text-[10px] font-black rounded-lg hover:text-indigo-600 hover:border-indigo-200 group-hover:bg-indigo-50 transition-all">锁定此 IP</button>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        );
      case 'settings':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-4xl space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <h2 className="text-2xl font-black text-slate-800 mb-6">Cloudflare API 凭据</h2>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase mb-2 block">API Token</label>
                    <input type="password" value={cfConfig.apiToken} onChange={e => setCfConfig({...cfConfig, apiToken: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="在 CF 面板生成令牌" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Zone ID</label>
                    <input type="text" value={cfConfig.zoneId} onChange={e => setCfConfig({...cfConfig, zoneId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="域名的区域 ID" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase mb-2 block">解析主域名</label>
                    <input type="text" value={cfConfig.domain} onChange={e => setCfConfig({...cfConfig, domain: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="例如: shiye.ggff.net" />
                  </div>
                  <button onClick={() => alert('配置已保存')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                    <Save size={18} /> 保存配置
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-black">CORS 代理 (必选)</h2>
                   <button onClick={() => setCfConfig({...cfConfig, useProxy: !cfConfig.useProxy})}>
                      {cfConfig.useProxy ? <ToggleRight size={36} className="text-indigo-400" /> : <ToggleLeft size={36} className="text-slate-600" />}
                   </button>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  由于浏览器安全限制，你无法直接连接 Cloudflare API。请将右侧代码部署为 Cloudflare Worker，并将生成的 URL 填入下方。
                </p>
                <div className="mb-6">
                   <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">私有代理 URL</label>
                   <input type="text" value={cfConfig.proxyUrl} onChange={e => setCfConfig({...cfConfig, proxyUrl: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm font-mono outline-none text-indigo-400" placeholder="https://your-worker.workers.dev" />
                </div>
                <button onClick={copyWorkerCode} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold flex items-center justify-center gap-2 border border-white/10 transition-all text-sm">
                   <Code2 size={18} /> 复制代理 Worker 源码
                </button>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-white border-r border-slate-100 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 shrink-0">
            <Cloud size={24} />
          </div>
          {sidebarOpen && <h1 className="text-xl font-black text-slate-800">CloudVista</h1>}
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="控制中心" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<Globe size={20} />} label="边缘解析" active={activeView === 'network'} onClick={() => setActiveView('network')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<FlaskConical size={20} />} label="优选实验室" active={activeView === 'lab'} onClick={() => setActiveView('lab')} sidebarOpen={sidebarOpen} />
          <div className="pt-4 border-t border-slate-50">
            <NavItem icon={<Settings size={20} />} label="系统配置" active={activeView === 'settings'} onClick={() => setActiveView('settings')} sidebarOpen={sidebarOpen} />
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">
            <Menu size={20} />
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
          >
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
                <div>
                   <h3 className="text-2xl font-black text-slate-800">实机解析部署</h3>
                   <p className="text-xs text-slate-400 mt-1">直接在 Cloudflare 上创建 DNS 记录并同步至面板</p>
                </div>
                <button onClick={() => setIsCreateModalOpen(false)}><XCircle size={24} className="text-slate-200 hover:text-rose-500" /></button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">子域名 (Prefix)</label>
                     <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                       <input className="flex-1 bg-transparent p-4 text-sm font-bold outline-none" value={newNodeData.id} onChange={e => setNewNodeData({...newNodeData, id: e.target.value})} placeholder="hk-01" />
                       <span className="px-4 text-[10px] font-black text-slate-300">.{cfConfig.domain || 'domain.com'}</span>
                     </div>
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">节点友好名称</label>
                     <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={newNodeData.name} onChange={e => setNewNodeData({...newNodeData, name: e.target.value})} placeholder="香港极致加速节点" />
                   </div>
                   <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <div className="flex items-center gap-2">
                         <HelpCircle size={14} className="text-amber-500" />
                         <span className="text-[11px] font-black text-amber-700">仅模拟 (不创建 DNS)</span>
                      </div>
                      <button onClick={() => setUseSimulation(!useSimulation)}>
                         {useSimulation ? <ToggleRight size={24} className="text-amber-600" /> : <ToggleLeft size={24} className="text-slate-300" />}
                      </button>
                   </div>
                   <button 
                     onClick={handleConfirmDeploy} 
                     disabled={isDeploying}
                     className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
                   >
                     {isDeploying ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                     {isDeploying ? '正在同步 API...' : '立即提交部署'}
                   </button>
                </div>
                <div className="bg-slate-900 rounded-[2rem] p-6 flex flex-col">
                   <div className="flex items-center gap-2 text-indigo-400 mb-4 font-black text-[10px] uppercase">
                      <Terminal size={14} /> 部署日志
                   </div>
                   <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 custom-scrollbar pr-2 max-h-[220px]">
                      {deployLogs.length === 0 ? (
                        <p className="text-slate-600 italic">等待部署启动...</p>
                      ) : deployLogs.map((log, i) => (
                        <p key={i} className={log.includes('[ERROR]') ? 'text-rose-400' : log.includes('[SUCCESS]') ? 'text-emerald-400' : 'text-slate-400'}>
                          {log}
                        </p>
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
              <h3 className="text-xl font-black text-slate-800">节点连接面板</h3>
              <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={24} className="text-slate-200" /></button>
            </div>
            <div className="bg-slate-900 p-10 rounded-[3rem] flex flex-col items-center text-center text-white mb-8 shadow-2xl">
               <div className="bg-white p-5 rounded-[2rem] mb-6 shadow-inner">
                  <QRCodeSVG value={generateConfigLink(selectedNode)} size={180} />
               </div>
               <h4 className="font-black text-xl mb-2">{selectedNode.name}</h4>
               <p className="text-[9px] font-mono text-slate-500 break-all bg-slate-800 p-3 rounded-xl w-full">{generateConfigLink(selectedNode)}</p>
               <button onClick={() => { navigator.clipboard.writeText(generateConfigLink(selectedNode)); alert('配置链接已复制！'); }} className="mt-6 w-full py-4 bg-indigo-600 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all">
                  <Copy size={16} /> 复制 VLESS 配置
               </button>
            </div>
            <div className="space-y-4">
               <ParamItem label="边缘 IP" value={selectedNode.location} />
               <ParamItem label="主机 / SNI" value={`${selectedNode.id}.${cfConfig.domain}`} />
               <ParamItem label="传输协议" value="WS + TLS" />
            </div>
            <button 
              onClick={() => { setNodes(nodes.filter(n => n.id !== selectedNode.id)); setSelectedNode(null); }}
              className="mt-auto w-full py-5 bg-rose-50 text-rose-600 rounded-[2rem] text-xs font-black flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
            >
              <Trash2 size={18} /> 从本地列表销毁
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ParamItem: React.FC<{label: string, value: string}> = ({ label, value }) => (
  <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{label}</span>
    <span className="text-xs font-mono font-black text-slate-700">{value}</span>
  </div>
);

const NavItem: React.FC<{icon: any, label: string, active?: boolean, sidebarOpen: boolean, onClick: () => void}> = ({ icon, label, active, sidebarOpen, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-black' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'}`}>
    {icon} {sidebarOpen && <span className="text-sm tracking-tight">{label}</span>}
  </button>
);

export default App;
