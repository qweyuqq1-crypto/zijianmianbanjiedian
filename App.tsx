
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Globe, Activity, FlaskConical, ShieldCheck, Settings, Menu, Zap, 
  BarChart3, CheckCircle2, Copy, RefreshCw, Trophy, 
  XCircle, Save, Cloud, BrainCircuit, Search, Trash2, QrCode, MapPin, AlertCircle, Loader2, Key,
  Server, Cpu, ArrowUpRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MOCK_NODES } from './constants';
import { CFNode, UserInfo, OptimalIP, CFConfig } from './types';
import StatCard from './components/StatCard';
import GlobalMap from './components/GlobalMap';
import { fetchUserInfo } from './services/ipService';
import { testAndRankIPs } from './services/diagnosticService';
import { analyzeNodesWithAI } from './services/geminiService';
import { cloudflareApi } from './services/cloudflareService';

type ViewType = 'dashboard' | 'network' | 'lab' | 'settings';

const App: React.FC = () => {
  // --- 状态管理 ---
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [nodes, setNodes] = useState<CFNode[]>(() => {
    const saved = localStorage.getItem('cv_nodes');
    return saved ? JSON.parse(saved) : MOCK_NODES;
  });
  
  const [selectedNode, setSelectedNode] = useState<CFNode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- IP 优选相关 ---
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [optimalIPs, setOptimalIPs] = useState<OptimalIP[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [probeProgress, setProbeProgress] = useState({ currentIP: '', percent: 0 });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // --- 配置相关 ---
  const [cfConfig, setCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    // 优先读取环境变量，其次本地存储
    return saved ? JSON.parse(saved) : { 
      apiToken: process.env.CF_API_TOKEN || '', 
      zoneId: process.env.CF_ZONE_ID || '', 
      domain: process.env.CF_DOMAIN || '' 
    };
  });

  // --- 节点创建相关 ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [newNodeData, setNewNodeData] = useState({ id: '', name: '' });

  // --- 自动保存 ---
  useEffect(() => { localStorage.setItem('cv_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('cv_config', JSON.stringify(cfConfig)); }, [cfConfig]);

  // --- 数据统计 ---
  const stats = useMemo(() => {
    const online = nodes.filter(n => n.status === 'online');
    return {
      avgLatency: online.length ? Math.round(online.reduce((a, b) => a + b.latency, 0) / online.length) : 0,
      onlineCount: online.length,
      totalRequests: nodes.reduce((a, b) => a + b.requests, 0)
    };
  }, [nodes]);

  useEffect(() => {
    fetchUserInfo().then(setUserInfo);
    // 模拟数据波动
    const interval = setInterval(() => {
      setNodes(prev => prev.map(n => ({
        ...n,
        requests: n.status === 'online' ? n.requests + Math.floor(Math.random() * 5) : n.requests,
        latency: n.status === 'online' ? Math.max(20, n.latency + (Math.random() * 2 - 1)) : 0
      })));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // --- 操作函数 ---
  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopyStatus(text);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleOptimizeIP = async () => {
    setIsOptimizing(true);
    try {
      const results = await testAndRankIPs((ip, percent) => {
        setProbeProgress({ currentIP: ip, percent });
      });
      setOptimalIPs(results);
    } catch (err) { console.error(err); } finally { setIsOptimizing(false); }
  };

  const handleConfirmDeploy = async () => {
    if (!newNodeData.id || !newNodeData.name) return alert("请填写完整信息");
    if (!cfConfig.apiToken || !cfConfig.zoneId) return alert("请先在设置中配置 Cloudflare API 凭据");

    setIsDeploying(true);
    try {
      // 默认使用优选列表中第一名 IP，若无则使用 CF 默认
      const targetIP = optimalIPs[0]?.ip || "104.16.0.1";
      const newNode: CFNode = {
        id: newNodeData.id.toLowerCase(),
        name: newNodeData.name,
        location: targetIP,
        coords: [110 + Math.random() * 20, 20 + Math.random() * 10], // 随机位置模拟
        status: 'online',
        latency: optimalIPs[0]?.latency || 45,
        uptime: 100,
        requests: 0,
        lastUpdate: new Date().toISOString(),
        source: 'manual',
        proxied: true,
        type: 'A'
      };

      await cloudflareApi.createDnsRecord(cfConfig, newNode, false);
      setNodes([newNode, ...nodes]);
      setIsCreateModalOpen(false);
      setNewNodeData({ id: '', name: '' });
      alert("🎉 节点已同步至 Cloudflare 并添加至面板！");
    } catch (error: any) {
      alert(`部署失败: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const generateConfigLink = (node: CFNode) => {
    const uuid = "de305d54-75b4-431b-adb2-eb6b9e546014"; // 示例 UUID
    const host = `${node.id}.${cfConfig.domain || 'example.com'}`;
    const server = node.location;
    return `vless://${uuid}@${server}:443?encryption=none&security=tls&sni=${host}&fp=chrome&type=ws&host=${host}&path=%2F%3Fed%3D2048#CloudVista-${node.name}`;
  };

  const renderContentView = () => {
    switch(activeView) {
      case 'dashboard':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard label="系统平均延迟" value={`${stats.avgLatency}ms`} icon={<Zap size={20} />} trend="-4ms" trendPositive />
              <StatCard label="活动节点" value={`${stats.onlineCount}/${nodes.length}`} icon={<Server size={20} />} />
              <StatCard label="当前总负载" value={`${(stats.totalRequests / 100).toFixed(1)}%`} icon={<Cpu size={20} />} trend="+0.2%" />
              <div className="bg-slate-900 rounded-3xl p-6 shadow-xl flex flex-col justify-between group overflow-hidden relative">
                 <div className="relative z-10 text-white">
                   <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">AI 安全评分</p>
                   <h4 className="text-4xl font-black">98</h4>
                 </div>
                 <BrainCircuit size={80} className="absolute -bottom-4 -right-4 text-white/5 group-hover:scale-110 transition-transform duration-700" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>全球分布实时预览
                </h3>
                <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Trophy className="text-amber-500" size={18} /> 实验室速递</h3>
                   <div className="space-y-3">
                     {optimalIPs.slice(0, 3).map((ip, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <span className="text-xs font-mono font-bold text-slate-600">{ip.ip}</span>
                         <span className="text-xs font-black text-indigo-600">{ip.latency}ms</span>
                       </div>
                     ))}
                     {optimalIPs.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">暂无数据，请前往实验室测速</p>}
                     <button onClick={() => setActiveView('lab')} className="w-full py-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">前往优选实验室</button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black text-slate-800">所有节点列表</h2>
              <div className="text-xs text-slate-400 font-bold uppercase">共计 {nodes.length} 个节点</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {nodes.map(node => (
                <div key={node.id} onClick={() => setSelectedNode(node)} className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-indigo-500 cursor-pointer transition-all hover:shadow-xl group">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${node.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      <Server size={24} />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${node.status === 'online' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{node.status}</span>
                      <span className="text-xs font-bold text-slate-400 mt-1">{node.latency}ms</span>
                    </div>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{node.name}</h4>
                  <p className="text-xs font-mono text-slate-400 mt-1">{node.location}</p>
                  <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                    <div className="flex gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                    </div>
                    <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'lab':
        // 此处保留之前优化后的 Lab 视图
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                   <div className="relative z-10">
                      <Trophy size={48} className="text-indigo-400 mb-6" />
                      <h2 className="text-3xl font-black mb-4">Anycast IP 优选实验室</h2>
                      <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-md">
                        通过对全球 Cloudflare 节点进行 HTTP 往返探测（RTT），为您筛选当前环境下最优加速 IP。
                        <br/><span className="text-amber-400/80 text-[10px]">* 提示：由于浏览器沙箱限制，测速结果可能略高于原生工具。</span>
                      </p>
                      <button 
                        onClick={handleOptimizeIP} 
                        disabled={isOptimizing}
                        className="px-8 py-4 bg-indigo-600 rounded-2xl font-bold flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20"
                      >
                        {isOptimizing ? <RefreshCw className="animate-spin" /> : <Zap size={20} />}
                        {isOptimizing ? `探测中 ${probeProgress.percent}%` : '开始深度探测'}
                      </button>
                   </div>
                   <Activity size={300} strokeWidth={1} className="absolute right-0 bottom-0 opacity-10 pointer-events-none" />
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                   <h3 className="text-xl font-bold mb-6 flex items-center gap-2">本地网络环境</h3>
                   {userInfo ? (
                     <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="p-3 bg-white rounded-xl shadow-sm"><Globe className="text-indigo-600" /></div>
                           <div>
                              <p className="text-xs text-slate-400 font-bold">出口 IP</p>
                              <p className="text-lg font-mono font-black text-slate-800">{userInfo.ip}</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">ISP / 运营商</p>
                              <p className="text-sm font-bold text-slate-700 truncate">{userInfo.org}</p>
                           </div>
                           <div className="p-4 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">连接状态</p>
                              <p className="text-sm font-bold text-emerald-600">正常接入</p>
                           </div>
                        </div>
                     </div>
                   ) : <div className="animate-pulse space-y-4"><div className="h-16 bg-slate-100 rounded-2xl"></div></div>}
                </div>
             </div>

             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-bold">优选结果 (延迟 & 丢包)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                   {optimalIPs.map((ip, i) => (
                     <div key={i} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-300 transition-all group relative">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[10px] font-black text-slate-300">#0{i+1}</span>
                           <button onClick={() => copyToClipboard(ip.ip)} className="text-slate-300 group-hover:text-indigo-600">
                             {copyStatus === ip.ip ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                           </button>
                        </div>
                        <p className="text-sm font-mono font-bold text-slate-800">{ip.ip}</p>
                        <div className="mt-4">
                           <div className="text-indigo-600 font-black text-xl">{ip.latency}ms</div>
                           <div className={`text-[9px] font-bold ${ip.packetLoss > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>丢包: {ip.packetLoss}%</div>
                        </div>
                     </div>
                   ))}
                   {!isOptimizing && optimalIPs.length === 0 && (
                     <div className="col-span-full py-12 text-center text-slate-400 text-sm">点击上方按钮开始探测优选 IP</div>
                   )}
                </div>
             </div>
          </div>
        );
      case 'settings':
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-2xl">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-black text-slate-800 mb-2">Cloudflare API 凭据</h2>
              <p className="text-slate-500 text-sm mb-8">配置后即可直接从面板管理你的 DNS 解析并一键创建节点</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">API Token</label>
                  <input type="password" value={cfConfig.apiToken} onChange={e => setCfConfig({...cfConfig, apiToken: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="可在 CF 用户中心生成" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Zone ID</label>
                  <input type="text" value={cfConfig.zoneId} onChange={e => setCfConfig({...cfConfig, zoneId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="域名的区域 ID" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">解析主域名</label>
                  <input type="text" value={cfConfig.domain} onChange={e => setCfConfig({...cfConfig, domain: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" placeholder="如: mynode.com" />
                </div>
                <button onClick={() => alert('配置已成功保存')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                   <Save size={18} /> 保存系统配置
                </button>
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-24'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100">
            <Cloud size={24} />
          </div>
          {sidebarOpen && <h1 className="text-xl font-black text-slate-800">CloudVista</h1>}
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="控制中心" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} sidebarOpen={sidebarOpen} />
          <NavItem icon={<Globe size={20} />} label="节点管理" active={activeView === 'network'} onClick={() => setActiveView('network')} sidebarOpen={sidebarOpen} />
          {/* Fixed missing FlaskConical icon reference */}
          <NavItem icon={<FlaskConical size={20} />} label="优选实验室" active={activeView === 'lab'} onClick={() => setActiveView('lab')} sidebarOpen={sidebarOpen} />
          <div className="pt-4 border-t border-slate-100">
            <NavItem icon={<Settings size={20} />} label="系统配置" active={activeView === 'settings'} onClick={() => setActiveView('settings')} sidebarOpen={sidebarOpen} />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl">
            <Menu size={20} />
          </button>
          
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
          >
            <Zap size={18} /> 部署新节点
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {renderContentView()}
        </div>
      </main>

      {/* Create Node Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-10 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800">部署边缘解析</h3>
                <button onClick={() => setIsCreateModalOpen(false)}><XCircle size={24} className="text-slate-300" /></button>
             </div>
             <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">子域名 (Prefix)</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                    <input className="flex-1 bg-transparent p-4 text-sm outline-none" value={newNodeData.id} onChange={e => setNewNodeData({...newNodeData, id: e.target.value})} placeholder="hk-pro-01" />
                    <span className="px-4 text-xs font-bold text-slate-300">.{cfConfig.domain || 'domain.com'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">节点名称</label>
                  <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.name} onChange={e => setNewNodeData({...newNodeData, name: e.target.value})} placeholder="香港高级加速节点" />
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">自动优选绑定</p>
                  <p className="text-sm font-mono font-bold flex items-center gap-2">
                    <MapPin size={12} /> {optimalIPs[0]?.ip || '104.16.0.1'} (最快)
                  </p>
                </div>
                <button 
                  onClick={handleConfirmDeploy} 
                  disabled={isDeploying}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
                >
                  {isDeploying ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                  {isDeploying ? '同步至 Cloudflare...' : '立即同步部署'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Node Details Drawer */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800">节点参数配置</h3>
              <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle size={24} className="text-slate-300" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-2xl">
                 <div className="bg-white p-4 rounded-3xl mb-6 shadow-inner">
                    <QRCodeSVG value={generateConfigLink(selectedNode)} size={200} level="H" />
                 </div>
                 <h4 className="text-white font-black text-lg mb-1">{selectedNode.name}</h4>
                 <p className="text-slate-500 text-[10px] truncate w-full px-4">{generateConfigLink(selectedNode)}</p>
                 <button 
                   onClick={() => copyToClipboard(generateConfigLink(selectedNode))}
                   className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all"
                 >
                   {copyStatus === generateConfigLink(selectedNode) ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                   {copyStatus === generateConfigLink(selectedNode) ? '配置已复制' : '复制 VLESS 配置'}
                 </button>
              </div>

              <div className="space-y-4">
                 <h5 className="text-[10px] font-black text-slate-400 uppercase px-1">核心连接参数</h5>
                 <div className="space-y-2">
                    <ParamItem label="Anycast IP" value={selectedNode.location} />
                    <ParamItem label="伪装域名 (SNI)" value={`${selectedNode.id}.${cfConfig.domain || 'example.com'}`} />
                    <ParamItem label="连接端口" value="443" />
                    <ParamItem label="传输方式" value="WebSocket (TLS)" />
                 </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                 <button 
                   onClick={() => {
                     setNodes(nodes.filter(n => n.id !== selectedNode.id));
                     setSelectedNode(null);
                   }}
                   className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
                 >
                   <Trash2 size={16} /> 从本地列表移除节点
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
    <span className="text-[11px] text-slate-400 font-bold">{label}</span>
    <span className="text-xs font-mono font-black text-slate-700 truncate max-w-[180px]">{value}</span>
  </div>
);

const NavItem: React.FC<{icon: any, label: string, active?: boolean, sidebarOpen: boolean, onClick: () => void}> = ({ icon, label, active, sidebarOpen, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 font-bold' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'}`}
  >
    {icon}
    {sidebarOpen && <span className="text-sm tracking-tight">{label}</span>}
  </button>
);

export default App;
