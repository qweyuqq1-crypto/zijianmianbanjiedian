
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Globe, Activity, ShieldCheck, Settings, Menu, Zap, 
  BarChart3, ShieldAlert, CheckCircle2, Copy, RefreshCw, Trophy, 
  XCircle, Save, Cloud, BrainCircuit, Search, Database, Shield, Lock, 
  ExternalLink, Share2, Trash2, QrCode, MapPin, AlertCircle, Loader2, Key
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { MOCK_NODES, generateMetricHistory } from './constants';
import { CFNode, DiagnosticResult, UserInfo, OptimalIP, CFConfig } from './types';
import StatCard from './components/StatCard';
import GlobalMap from './components/GlobalMap';
import { fetchUserInfo } from './services/ipService';
import { testAndRankIPs } from './services/diagnosticService';
import { analyzeNodesWithAI } from './services/geminiService';
import { cloudflareApi } from './services/cloudflareService';

type ViewType = 'dashboard' | 'network' | 'lab' | 'security' | 'settings';

const App: React.FC = () => {
  // 环境变量探测
  const envConfig = useMemo(() => ({
    apiToken: process.env.CF_API_TOKEN || '',
    zoneId: process.env.CF_ZONE_ID || '',
    domain: process.env.CF_DOMAIN || ''
  }), []);

  // 只要有核心 Token 和 ZoneID 就认为受系统管理
  const isSystemManaged = !!(envConfig.apiToken && envConfig.zoneId);

  // 调试信息：仅在开发模式显示，帮助确认变量是否注入成功
  useEffect(() => {
    if (isSystemManaged) {
      console.log("CloudVista: 检测到系统机密配置已生效 (Managed by Environment Variables)");
    } else {
      console.warn("CloudVista: 未检测到环境变量，将回退至手动配置模式");
    }
  }, [isSystemManaged]);

  // 状态管理
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [nodes, setNodes] = useState<CFNode[]>(() => {
    const saved = localStorage.getItem('cv_nodes');
    return saved ? JSON.parse(saved) : MOCK_NODES;
  });
  
  const [selectedNode, setSelectedNode] = useState<CFNode | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // IP 优选相关
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [optimalIPs, setOptimalIPs] = useState<OptimalIP[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [probeProgress, setProbeProgress] = useState({ currentIP: '', percent: 0 });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // 本地配置（仅当环境变量缺失时作为补充）
  const [localCfConfig, setLocalCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    return saved ? JSON.parse(saved) : { apiToken: '', zoneId: '', domain: '' };
  });

  // 最终生效配置（环境变量优先级最高）
  const activeCfConfig = useMemo(() => ({
    apiToken: envConfig.apiToken || localCfConfig.apiToken,
    zoneId: envConfig.zoneId || localCfConfig.zoneId,
    domain: envConfig.domain || localCfConfig.domain
  }), [localCfConfig, envConfig]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [newNodeData, setNewNodeData] = useState({ id: '', name: '' });

  useEffect(() => { localStorage.setItem('cv_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('cv_config', JSON.stringify(localCfConfig)); }, [localCfConfig]);

  const stats = useMemo(() => {
    const validNodes = nodes.filter(n => n.status === 'online');
    return {
      totalRequests: nodes.reduce((acc, n) => acc + n.requests, 0),
      avgLatency: validNodes.length > 0 ? validNodes.reduce((acc, n) => acc + n.latency, 0) / validNodes.length : 0,
      onlineCount: validNodes.length
    };
  }, [nodes]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(text);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) { console.error(err); }
  };

  const handleAIDiagnose = async () => {
    setIsAnalyzing(true);
    const result = await analyzeNodesWithAI(nodes);
    if (result) setDiagnostic(result);
    setIsAnalyzing(false);
  };

  const handleOptimizeIP = async () => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    try {
      const suggestions = await testAndRankIPs((ip, progress) => {
        setProbeProgress({ currentIP: ip, percent: progress });
      }, 5);
      setOptimalIPs(suggestions);
    } catch (error) { console.error(error); } finally { setIsOptimizing(false); }
  };

  const handleConfirmDeploy = async () => {
    if (!newNodeData.id || !newNodeData.name) {
      alert("请填写节点 ID 和名称");
      return;
    }

    // 严格检查配置是否可用
    if (!activeCfConfig.apiToken || !activeCfConfig.zoneId || !activeCfConfig.domain) {
      const missing = [];
      if (!activeCfConfig.apiToken) missing.push("API Token");
      if (!activeCfConfig.zoneId) missing.push("Zone ID");
      if (!activeCfConfig.domain) missing.push("根域名");
      
      alert(`配置不完整，缺少: ${missing.join(', ')}。\n\n提示：如果您已经在 Cloudflare 后台设置了机密，请确保已重新执行项目部署。`);
      setActiveView('settings');
      setIsCreateModalOpen(false);
      return;
    }

    setIsDeploying(true);
    try {
      const targetIP = optimalIPs[0]?.ip || "104.16.0.1";
      const newNode: CFNode = {
        id: newNodeData.id.toLowerCase(),
        name: newNodeData.name,
        location: targetIP,
        coords: [110 + Math.random() * 20, 20 + Math.random() * 10],
        status: 'online',
        latency: optimalIPs[0]?.latency || 45,
        uptime: 100,
        requests: 0,
        lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
        source: 'manual',
        proxied: true,
        type: 'A'
      };

      await cloudflareApi.createDnsRecord(activeCfConfig, newNode, false);

      setNodes([newNode, ...nodes]);
      setIsCreateModalOpen(false);
      setNewNodeData({ id: '', name: '' });
      setSelectedNode(newNode);
      alert("🎉 节点已成功部署至 Cloudflare 网络！");
    } catch (error: any) {
      alert(`部署失败: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeleteNode = (id: string) => {
    if (confirm('确定要移除此节点吗？(这不会删除 Cloudflare 上的 DNS 记录)')) {
      setNodes(nodes.filter(n => n.id !== id));
      setSelectedNode(null);
    }
  };

  const generateConfigLink = (node: CFNode) => {
    const uuid = "de305d54-75b4-431b-adb2-eb6b9e546014"; 
    const fullHost = node.source === 'mock' ? 'cloudvista.xyz' : `${node.id}.${activeCfConfig.domain}`;
    const serverAddress = node.location;
    return `vless://${uuid}@${serverAddress}:443?encryption=none&security=tls&sni=${fullHost}&fp=chrome&type=ws&host=${fullHost}&path=%2F%3Fed%3D2048#CloudVista-${node.id}`;
  };

  useEffect(() => {
    fetchUserInfo().then(setUserInfo);
    const interval = setInterval(() => {
      setNodes(prev => prev.map(n => ({
        ...n,
        requests: n.status !== 'offline' ? n.requests + Math.floor(Math.random() * 8) : 0,
        latency: n.status !== 'offline' ? Math.max(10, n.latency + (Math.random() * 4 - 2)) : 0
      })));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const renderContentView = () => {
    switch(activeView) {
      case 'dashboard':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="24h 数据吞吐" value={`${(stats.totalRequests / 1024).toFixed(1)} GB`} icon={<BarChart3 size={20} />} trend="+12%" trendPositive />
              <StatCard label="系统平均延迟" value={`${stats.avgLatency.toFixed(0)}ms`} icon={<Zap size={20} />} trend="-4ms" trendPositive />
              <StatCard label="活动边缘节点" value={`${stats.onlineCount}/${nodes.length}`} icon={<Globe size={20} />} />
              <div className="bg-slate-900 rounded-3xl p-6 shadow-xl flex flex-col justify-between group overflow-hidden relative">
                 <div className="relative z-10">
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">AI 智能评分</p>
                   <h4 className="text-4xl font-black text-white">{diagnostic?.healthScore || '92'}</h4>
                 </div>
                 <button onClick={handleAIDiagnose} disabled={isAnalyzing} className="mt-4 relative z-10 w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-50 transition-all">
                   {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                   {isAnalyzing ? '分析中...' : '启动 AI 诊断'}
                 </button>
                 <BrainCircuit size={100} className="absolute -bottom-4 -right-4 text-white/5 group-hover:scale-110 transition-transform duration-700" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-8">
                      <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                      全球节点流量分布
                    </h3>
                    <GlobalMap nodes={nodes} onNodeSelect={(n) => setSelectedNode(n)} />
                 </div>
              </div>
              <div className="space-y-8">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6"><Trophy className="text-indigo-500" /> IP 优选概览</h3>
                   <div className="space-y-3">
                     {optimalIPs.length > 0 ? optimalIPs.slice(0, 3).map((ip, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <span className="text-xs font-mono font-bold">{ip.ip}</span>
                         <span className="text-xs font-black text-indigo-600">{ip.latency}ms</span>
                       </div>
                     )) : <p className="text-xs text-slate-400 text-center py-4">暂无数据，请前往实验室测速</p>}
                     <button onClick={() => setActiveView('lab')} className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">进入优选实验室</button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">全球节点管理</h2>
                  <p className="text-slate-500 text-sm">管理和监控分布在全球的边缘加速节点</p>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" placeholder="搜索节点名称或 ID..." 
                    className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
            </div>
          </div>
        );
      case 'lab':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                   <div className="relative z-10">
                      <Trophy size={48} className="text-indigo-400 mb-6" />
                      <h2 className="text-3xl font-black mb-4">Anycast IP 优选实验室</h2>
                      <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md">
                        通过对全球 Cloudflare Anycast 地址段进行实时毫秒级探测，为您自动筛选出当前网络环境下延迟最低、丢包最少的加速 IP。
                      </p>
                      <button 
                        onClick={handleOptimizeIP} 
                        disabled={isOptimizing}
                        className="px-8 py-4 bg-indigo-600 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20"
                      >
                        {isOptimizing ? <RefreshCw className="animate-spin" /> : <Zap size={20} />}
                        {isOptimizing ? `测速中 ${probeProgress.percent}%` : '开始深度探测'}
                      </button>
                   </div>
                   <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                     <Activity size={300} strokeWidth={1} />
                   </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                   <h3 className="text-xl font-bold mb-6 flex items-center gap-2">本地网络环境</h3>
                   {userInfo ? (
                     <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="p-3 bg-white rounded-xl shadow-sm"><Globe className="text-indigo-600" /></div>
                           <div>
                              <p className="text-xs text-slate-400 font-bold">公网 IP</p>
                              <p className="text-lg font-mono font-black text-slate-800">{userInfo.ip}</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">地理位置</p>
                              <p className="text-sm font-bold text-slate-700">{userInfo.city}, {userInfo.country}</p>
                           </div>
                           <div className="p-4 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">运营商 (ISP)</p>
                              <p className="text-sm font-bold text-slate-700 truncate">{userInfo.org}</p>
                           </div>
                        </div>
                     </div>
                   ) : <div className="animate-pulse space-y-4"><div className="h-16 bg-slate-100 rounded-2xl"></div><div className="h-16 bg-slate-100 rounded-2xl"></div></div>}
                </div>
             </div>

             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-bold">测速结果排名</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                   {optimalIPs.map((ip, i) => (
                     <div key={i} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:shadow-lg hover:border-indigo-200 transition-all group">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[10px] font-black text-slate-300">#{i+1}</span>
                           <button onClick={() => copyToClipboard(ip.ip)} className="text-slate-300 group-hover:text-indigo-600">
                             {copyStatus === ip.ip ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                           </button>
                        </div>
                        <p className="text-sm font-mono font-bold text-slate-800 mb-1">{ip.ip}</p>
                        <div className="flex items-center justify-between mt-4">
                           <div className="text-indigo-600 font-black text-lg">{ip.latency}ms</div>
                           <div className="px-2 py-0.5 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700">优</div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        );
      case 'settings':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-2xl">
             <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                   <div>
                      <h2 className="text-2xl font-black text-slate-800">系统全局配置</h2>
                      <p className="text-slate-500 text-sm mt-1">配置 Cloudflare API 以启用云端同步功能</p>
                   </div>
                   {isSystemManaged && (
                     <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 border border-emerald-100 shadow-sm">
                        <ShieldCheck size={12} /> 机密已托管
                     </div>
                   )}
                </div>
                
                <div className="space-y-8">
                   <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1 flex items-center justify-between">
                        <span>Cloudflare API 令牌</span>
                        {envConfig.apiToken && <span className="text-[10px] text-emerald-500">环境变量注入</span>}
                      </label>
                      <div className="relative">
                        <input 
                          type="password" placeholder={envConfig.apiToken ? "******** (系统安全托管)" : "请输入您的 CF_API_TOKEN"}
                          disabled={!!envConfig.apiToken}
                          className={`w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono ${envConfig.apiToken ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                          value={localCfConfig.apiToken} onChange={e => setLocalCfConfig({...localCfConfig, apiToken: e.target.value})}
                        />
                        <Key className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-xs font-black text-slate-400 uppercase ml-1 flex items-center justify-between">
                           <span>区域 ID (Zone ID)</span>
                           {envConfig.zoneId && <span className="text-emerald-500">托管</span>}
                        </label>
                        <input 
                          type="text" placeholder={envConfig.zoneId ? "由系统自动提供" : "CF 域名面板获取"}
                          disabled={!!envConfig.zoneId}
                          className={`w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono ${envConfig.zoneId ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                          value={localCfConfig.zoneId} onChange={e => setLocalCfConfig({...localCfConfig, zoneId: e.target.value})}
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-xs font-black text-slate-400 uppercase ml-1 flex items-center justify-between">
                           <span>加速根域名</span>
                           {envConfig.domain && <span className="text-emerald-500">托管</span>}
                        </label>
                        <input 
                          type="text" placeholder={envConfig.domain ? envConfig.domain : "例如: myproxy.com"}
                          disabled={!!envConfig.domain}
                          className={`w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono ${envConfig.domain ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                          value={localCfConfig.domain} onChange={e => setLocalCfConfig({...localCfConfig, domain: e.target.value})}
                        />
                      </div>
                   </div>

                   {!isSystemManaged ? (
                     <button onClick={() => alert('设置已保存至本地存储')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                       <Save size={18} /> 保存本地手动配置
                     </button>
                   ) : (
                     <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                        <Shield size={18} className="text-indigo-600 mt-1 shrink-0" />
                        <div>
                           <p className="text-xs font-bold text-indigo-900">安全提示</p>
                           <p className="text-[10px] text-indigo-700 leading-relaxed mt-1">
                             当前正在使用系统级机密配置。如果您需要修改这些值，请前往 Cloudflare Pages 控制台的环境变量设置中更新，并点击“保存并重新部署”。
                           </p>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          </div>
        );
      default:
        return <div>页面开发中...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden selection:bg-indigo-100">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0">
            <Cloud size={24} />
          </div>
          {sidebarOpen && <h1 className="text-xl font-black tracking-tight text-slate-800">CloudVista</h1>}
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={20} />} label="主面板" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<Globe size={20} />} label="全球网络" active={activeView === 'network'} onClick={() => setActiveView('network')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<Trophy size={20} />} label="优选实验室" active={activeView === 'lab'} onClick={() => setActiveView('lab')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<ShieldCheck size={20} />} label="安全防御" active={activeView === 'security'} onClick={() => setActiveView('security')} sidebarOpen={sidebarOpen} />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem icon={<Settings size={20} />} label="系统配置" active={activeView === 'settings'} onClick={() => setActiveView('settings')} sidebarOpen={sidebarOpen} />
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-8 z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors">
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg"
            >
              <Zap size={18} /> 创建节点
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
           {renderContentView()}
        </div>
      </main>

      {/* 部署 Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800">部署边缘节点</h3>
                <button onClick={() => setIsCreateModalOpen(false)}><XCircle size={24} className="text-slate-300" /></button>
             </div>
             <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">节点 ID (子域前缀)</label>
                  <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.id} onChange={e => setNewNodeData({...newNodeData, id: e.target.value})} placeholder="例如: hk-01" />
                  <p className="text-[10px] text-slate-400 mt-1">目标: {newNodeData.id || 'node'}.{activeCfConfig.domain || 'domain.com'}</p>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">名称</label>
                  <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.name} onChange={e => setNewNodeData({...newNodeData, name: e.target.value})} placeholder="例如: 香港 PCCW 加速" />
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">自动绑定优选 IP</p>
                  <p className="text-sm font-mono font-bold flex items-center gap-2">
                    <MapPin size={12} /> {optimalIPs[0]?.ip || '104.16.0.1'}
                  </p>
                </div>
                <button 
                  onClick={handleConfirmDeploy} 
                  disabled={isDeploying}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200"
                >
                  {isDeploying ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                  {isDeploying ? '正在同步 Cloudflare...' : '立即部署'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* 节点详情 Drawer */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Globe className="text-indigo-600" /> 节点参数</h3>
              <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={24} className="text-slate-300" /></button>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase">状态</p>
                   <p className={`font-bold flex items-center gap-1 ${selectedNode.status === 'online' ? 'text-emerald-600' : 'text-rose-600'}`}>
                     <CheckCircle2 size={12} /> {selectedNode.status === 'online' ? '运行中' : '异常'}
                   </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase">延迟</p>
                   <p className="text-slate-800 font-bold">{selectedNode.latency.toFixed(0)}ms</p>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-2xl">
                 <div className="bg-white p-4 rounded-3xl mb-6">
                    <QRCodeSVG value={generateConfigLink(selectedNode)} size={180} level="H" />
                 </div>
                 <h4 className="text-white font-black text-lg mb-1">{selectedNode.name}</h4>
                 <p className="text-slate-400 text-[10px] mb-6 truncate max-w-xs">{generateConfigLink(selectedNode).substring(0, 40)}...</p>
                 <button 
                   onClick={() => copyToClipboard(generateConfigLink(selectedNode))}
                   className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all"
                 >
                   {copyStatus === generateConfigLink(selectedNode) ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                   {copyStatus === generateConfigLink(selectedNode) ? '已复制到剪贴板' : '复制 VLESS 链接'}
                 </button>
              </div>

              <div className="space-y-4">
                 <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">核心连接参数</h5>
                 <div className="space-y-3">
                    <ParamItem label="Anycast IP" value={selectedNode.location} />
                    <ParamItem label="SNI / Host" value={selectedNode.source === 'mock' ? 'cloudvista.xyz' : `${selectedNode.id}.${activeCfConfig.domain}`} />
                    <ParamItem label="端口" value="443" />
                    <ParamItem label="加密/传输" value="TLS / WS" />
                 </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                 <button 
                   onClick={() => handleDeleteNode(selectedNode.id)}
                   className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
                 >
                   <Trash2 size={16} /> 从面板移除此节点
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ParamItem: React.FC<{label: string, value: string}> = ({ label, value }) => (
  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <span className="text-xs text-slate-400 font-bold">{label}</span>
    <span className="text-xs font-mono font-black text-slate-700 truncate max-w-[180px]">{value}</span>
  </div>
);

const NavItem: React.FC<{icon: any, label: string, active?: boolean, sidebarOpen: boolean, onClick: () => void}> = ({ icon, label, active, sidebarOpen, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
  >
    <span className={`${active ? 'text-white' : 'text-slate-400'}`}>{icon}</span>
    {sidebarOpen && <span className="text-sm tracking-wide">{label}</span>}
  </button>
);

export default App;
