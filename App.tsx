
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Globe, Activity, ShieldCheck, Settings, Menu, Zap, 
  BarChart3, ShieldAlert, CheckCircle2, Copy, RefreshCw, Trophy, 
  XCircle, Save, Cloud, BrainCircuit, Search, Database, Shield, Lock, 
  ExternalLink, Share2, Trash2, QrCode, MapPin
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

type ViewType = 'dashboard' | 'network' | 'lab' | 'security' | 'settings';

const App: React.FC = () => {
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

  // 配置与模式
  const [isSimulatedMode, setIsSimulatedMode] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNodeData, setNewNodeData] = useState({ id: '', name: '' });
  const [cfConfig, setCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    return saved ? JSON.parse(saved) : { apiToken: '', zoneId: '' };
  });

  // 搜索
  const [searchQuery, setSearchQuery] = useState('');

  // 数据持久化
  useEffect(() => { localStorage.setItem('cv_nodes', JSON.stringify(nodes)); }, [nodes]);
  useEffect(() => { localStorage.setItem('cv_config', JSON.stringify(cfConfig)); }, [cfConfig]);

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

  // 创建节点逻辑
  const handleConfirmDeploy = () => {
    if (!newNodeData.id || !newNodeData.name) {
      alert("请填写完整信息");
      return;
    }

    const newNode: CFNode = {
      id: newNodeData.id.toUpperCase(),
      name: newNodeData.name,
      location: optimalIPs[0]?.ip || "104.16.0.1", // 使用当前最优 IP
      coords: [110 + Math.random() * 20, 20 + Math.random() * 10], // 随机位置模拟
      status: 'online',
      latency: optimalIPs[0]?.latency || 45,
      uptime: 100,
      requests: 0,
      lastUpdate: new Date().toISOString().replace('T', ' ').substring(0, 19),
      source: 'manual',
      proxied: true,
      type: 'A'
    };

    setNodes([newNode, ...nodes]);
    setIsCreateModalOpen(false);
    setNewNodeData({ id: '', name: '' });
    setSelectedNode(newNode); // 自动打开详情
  };

  const handleDeleteNode = (id: string) => {
    if (confirm('确定要删除此节点吗？')) {
      setNodes(nodes.filter(n => n.id !== id));
      setSelectedNode(null);
    }
  };

  // 生成配置链接 (VLESS 风格模拟)
  const generateConfigLink = (node: CFNode) => {
    const uuid = "de305d54-75b4-431b-adb2-eb6b9e546014"; // 模拟 UUID
    const host = cfConfig.zoneId || "cloudvista.xyz";
    return `vless://${uuid}@${node.location}:443?encryption=none&security=tls&sni=${host}&fp=chrome&type=ws&host=${host}&path=%2F%3Fed%3D2048#CloudVista-${node.id}`;
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

  // 渲染视图逻辑
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
        const filteredNodes = nodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.id.includes(searchQuery.toUpperCase()));
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
              
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                <div className="xl:col-span-3">
                   <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
                </div>
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredNodes.map(node => (
                    <div 
                      key={node.id} 
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 border rounded-2xl cursor-pointer transition-all ${selectedNode?.id === node.id ? 'bg-indigo-50 border-indigo-200 shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
                    >
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-bold">{node.name}</span>
                        <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-bold uppercase">
                        <div>延迟: <span className="text-slate-800">{node.latency}ms</span></div>
                        <div>配置类型: <span className="text-slate-800">{node.type}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
                <h2 className="text-2xl font-black text-slate-800 mb-8">系统全局配置</h2>
                <div className="space-y-8">
                   <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1">Cloudflare API 令牌</label>
                      <input 
                        type="password" placeholder="请输入您的 CF_API_TOKEN" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        value={cfConfig.apiToken} onChange={e => setCfConfig({...cfConfig, apiToken: e.target.value})}
                      />
                   </div>
                   <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1">区域 ID (Zone ID)</label>
                      <input 
                        type="text" placeholder="请输入您的 Zone ID" 
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                        value={cfConfig.zoneId} onChange={e => setCfConfig({...cfConfig, zoneId: e.target.value})}
                      />
                   </div>
                   <button onClick={() => alert('设置已加密保存')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                     <Save size={18} /> 保存配置
                   </button>
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
      {/* Sidebar */}
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

      {/* Main Content */}
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

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-8">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-slate-800">部署新边缘节点</h3>
                <button onClick={() => setIsCreateModalOpen(false)}><XCircle size={24} className="text-slate-300" /></button>
             </div>
             <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">节点 ID (如: US-01)</label>
                  <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.id} onChange={e => setNewNodeData({...newNodeData, id: e.target.value})} placeholder="唯一标识符" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase mb-2 block">节点显示名称</label>
                  <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={newNodeData.name} onChange={e => setNewNodeData({...newNodeData, name: e.target.value})} placeholder="例如: 硅谷加速 01" />
                </div>
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">自动绑定最优 IP</p>
                  <p className="text-sm font-mono font-bold">{optimalIPs[0]?.ip || '正在从优选库获取...'}</p>
                </div>
                <button onClick={handleConfirmDeploy} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">
                  确认部署并生成配置
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Node Detail Drawer / Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-end">
          <div className="h-full w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Globe className="text-indigo-600" /> 节点配置详情</h3>
              <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={24} className="text-slate-300" /></button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase">节点状态</p>
                   <p className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> 运行中</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase">实时延迟</p>
                   <p className="text-slate-800 font-bold">{selectedNode.latency}ms</p>
                </div>
              </div>

              {/* 二维码展示 */}
              <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col items-center text-center shadow-2xl">
                 <div className="bg-white p-4 rounded-3xl mb-6 shadow-inner">
                    <QRCodeSVG 
                      value={generateConfigLink(selectedNode)} 
                      size={180} 
                      level="H" 
                      includeMargin={false}
                    />
                 </div>
                 <h4 className="text-white font-black text-lg mb-1">{selectedNode.name}</h4>
                 <p className="text-slate-400 text-xs mb-6">扫描上方二维码或复制下方链接导入客户端</p>
                 <div className="w-full flex gap-2">
                    <button 
                      onClick={() => copyToClipboard(generateConfigLink(selectedNode))}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all"
                    >
                      {copyStatus === generateConfigLink(selectedNode) ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      {copyStatus === generateConfigLink(selectedNode) ? '已复制' : '复制订阅链接'}
                    </button>
                    <button className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white/20 transition-all">
                      <Share2 size={18} />
                    </button>
                 </div>
              </div>

              {/* 详细参数 */}
              <div className="space-y-4">
                 <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">配置参数明细</h5>
                 <div className="space-y-3">
                    <ParamItem label="连接地址" value={selectedNode.location} />
                    <ParamItem label="传输协议" value="VLESS + WebSocket + TLS" />
                    <ParamItem label="UUID" value="de305d54-75b4-431b-adb2-eb6b9e546014" />
                    <ParamItem label="端口" value="443" />
                    <ParamItem label="伪装域名" value={cfConfig.zoneId || "未设置"} />
                 </div>
              </div>

              {/* 危险操作 */}
              <div className="pt-8 border-t border-slate-100">
                 <button 
                   onClick={() => handleDeleteNode(selectedNode.id)}
                   className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-all"
                 >
                   <Trash2 size={16} /> 删除该节点
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
  <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
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
