
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, Globe, Activity, ShieldCheck, Settings, Menu, Bell, Zap, Clock,
  BarChart3, Cpu, ShieldAlert, AlertCircle, CheckCircle2, ChevronRight, MapPin,
  Network, Copy, RefreshCw, Trophy, History, Timer, XCircle, ChevronDown,
  CheckSquare, Square, Plus, Save, Cloud, BrainCircuit
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_NODES, generateMetricHistory } from './constants';
import { CFNode, DiagnosticResult, UserInfo, OptimalIP, CFConfig } from './types';
import StatCard from './components/StatCard';
import GlobalMap from './components/GlobalMap';
import { fetchUserInfo } from './services/ipService';
import { testAndRankIPs } from './services/diagnosticService';
import { cloudflareApi } from './services/cloudflareService';
import { analyzeNodesWithAI } from './services/geminiService';

const App: React.FC = () => {
  // 优先级：本地存储 > 模拟数据
  const [nodes, setNodes] = useState<CFNode[]>(() => {
    const saved = localStorage.getItem('cv_nodes');
    return saved ? JSON.parse(saved) : MOCK_NODES;
  });
  
  const [history] = useState(generateMetricHistory());
  const [selectedNode, setSelectedNode] = useState<CFNode | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // IP 优选状态
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [optimalIPs, setOptimalIPs] = useState<OptimalIP[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [probeProgress, setProbeProgress] = useState({ currentIP: '', percent: 0 });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // 创建节点状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSimulatedMode, setIsSimulatedMode] = useState(true);
  const [newNode, setNewNode] = useState<Partial<CFNode>>({
    name: '', id: '', location: '', coords: [116.4, 39.9], proxied: true, type: 'A'
  });
  const [cfConfig, setCfConfig] = useState<CFConfig>(() => {
    const saved = localStorage.getItem('cv_config');
    return saved ? JSON.parse(saved) : { apiToken: '', zoneId: '' };
  });

  // 批量操作状态
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // 持久化节点数据
  useEffect(() => {
    localStorage.setItem('cv_nodes', JSON.stringify(nodes));
  }, [nodes]);

  // 持久化配置数据
  useEffect(() => {
    localStorage.setItem('cv_config', JSON.stringify(cfConfig));
  }, [cfConfig]);

  const stats = useMemo(() => {
    const validNodes = nodes.filter(n => n.status === 'online');
    return {
      totalRequests: nodes.reduce((acc, n) => acc + n.requests, 0),
      avgLatency: validNodes.length > 0 ? validNodes.reduce((acc, n) => acc + n.latency, 0) / validNodes.length : 0,
      onlineCount: validNodes.length
    };
  }, [nodes]);

  // Added copyToClipboard function to fix the "Cannot find name 'copyToClipboard'" error
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(text);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (err) {
      console.error('Failed to copy IP to clipboard:', err);
    }
  };

  const handleAIDiagnose = async () => {
    setIsAnalyzing(true);
    const result = await analyzeNodesWithAI(nodes);
    if (result) {
      setDiagnostic(result);
    } else {
      alert("AI 分析暂时不可用，请检查网络连接或 API KEY 设置。");
    }
    setIsAnalyzing(false);
  };

  const handleCreateNode = async () => {
    if (!newNode.name || !newNode.id || !newNode.location) {
      alert("请完整填写节点名称、子域名和目标 IP");
      return;
    }

    try {
      if (!isSimulatedMode) {
        await cloudflareApi.createDnsRecord(cfConfig, newNode, false);
      } else {
        await cloudflareApi.createDnsRecord(cfConfig, newNode, true);
      }

      const createdNode: CFNode = {
        id: newNode.id!,
        name: newNode.name!,
        location: newNode.location!,
        coords: newNode.coords || [116.4, 39.9],
        status: 'online',
        latency: Math.floor(Math.random() * 50) + 20,
        uptime: 100,
        requests: 0,
        lastUpdate: new Date().toLocaleString(),
        source: isSimulatedMode ? 'manual' : 'api',
        proxied: newNode.proxied
      };

      setNodes(prev => [createdNode, ...prev]);
      setIsCreateModalOpen(false);
      setNewNode({ name: '', id: '', location: '', coords: [116.4, 39.9], proxied: true, type: 'A' });
    } catch (err: any) {
      alert(`部署失败: ${err.message}`);
    }
  };

  const handleOptimizeIP = async () => {
    if (isOptimizing) return;
    setIsOptimizing(true);
    setOptimalIPs([]);
    try {
      const suggestions = await testAndRankIPs((ip, progress) => {
        setProbeProgress({ currentIP: ip, percent: progress });
      }, 5);
      setOptimalIPs(suggestions);
    } catch (error) { console.error(error); } finally { setIsOptimizing(false); }
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

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden selection:bg-indigo-100">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-indigo-100">
            <Cloud size={24} />
          </div>
          {sidebarOpen && <h1 className="text-xl font-black tracking-tight text-slate-800">CloudVista</h1>}
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          <NavItem icon={<LayoutDashboard size={20} />} label="主面板" active sidebarOpen={sidebarOpen} />
          <NavItem icon={<Globe size={20} />} label="全球网络" sidebarOpen={sidebarOpen} />
          <NavItem icon={<Trophy size={20} />} label="优选实验室" sidebarOpen={sidebarOpen} />
          <NavItem icon={<ShieldCheck size={20} />} label="安全防御" sidebarOpen={sidebarOpen} />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem icon={<Settings size={20} />} label="系统配置" sidebarOpen={sidebarOpen} />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-8 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200/50">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[11px] font-bold text-slate-600">后端服务已连接</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${isSimulatedMode ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              {isSimulatedMode ? <Zap size={14} /> : <ShieldCheck size={14} />}
              {isSimulatedMode ? '模拟模式' : '生产模式'}
              <button 
                onClick={() => setIsSimulatedMode(!isSimulatedMode)}
                className="ml-2 px-2 py-0.5 bg-white border border-current rounded-md hover:scale-105 active:scale-95 transition-all"
              >
                切换
              </button>
            </div>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus size={18} />
              创建节点
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Dashboard Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard label="24h 数据吞吐" value={`${(stats.totalRequests / 1024).toFixed(1)} GB`} icon={<BarChart3 size={20} />} trend="+12%" trendPositive />
            <StatCard label="系统平均延迟" value={`${stats.avgLatency.toFixed(0)}ms`} icon={<Zap size={20} />} trend="-4ms" trendPositive />
            <StatCard label="活动边缘节点" value={`${stats.onlineCount}/${nodes.length}`} icon={<Globe size={20} />} />
            <div className="bg-slate-900 rounded-3xl p-6 shadow-xl flex flex-col justify-between group overflow-hidden relative">
               <div className="relative z-10">
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">AI 智能评分</p>
                 <h4 className="text-4xl font-black text-white">{diagnostic?.healthScore || '--'}</h4>
               </div>
               <button 
                onClick={handleAIDiagnose}
                disabled={isAnalyzing}
                className="mt-4 relative z-10 w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-50 transition-all"
               >
                 {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                 {isAnalyzing ? '分析中...' : '启动 AI 诊断'}
               </button>
               <BrainCircuit size={100} className="absolute -bottom-4 -right-4 text-white/5 group-hover:scale-110 transition-transform duration-700" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               {/* Map Visualization */}
               <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                      <div className="w-2 h-8 bg-blue-500 rounded-full"></div>
                      全球节点流量分布
                    </h3>
                  </div>
                  <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
               </div>

               {/* AI Diagnostic Report */}
               {diagnostic && (
                 <div className="bg-indigo-50/50 rounded-[2rem] p-8 border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                        <BrainCircuit size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-800">AI 诊断报告 (CloudVista Intelligence)</h4>
                        <p className="text-sm text-slate-500">由 Gemini 3.0 Flash 实时生成的专业建议</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                       <p className="text-slate-700 text-sm leading-relaxed bg-white/60 p-5 rounded-2xl border border-indigo-50">
                        {diagnostic.summary}
                       </p>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {diagnostic.recommendations.map((rec, i) => (
                            <div key={i} className="bg-white p-4 rounded-2xl border border-indigo-50 shadow-sm flex items-start gap-3">
                               <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</div>
                               <span className="text-xs text-slate-600 font-medium leading-normal">{rec}</span>
                            </div>
                          ))}
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="space-y-8">
              {/* Optimal IP Banner */}
              <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Trophy className="text-indigo-500" /> 优选 IP 实验室</h3>
                   <button 
                    onClick={handleOptimizeIP} 
                    disabled={isOptimizing}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                   >
                     {isOptimizing ? <RefreshCw className="animate-spin" /> : <Zap size={20} />}
                   </button>
                </div>
                
                {isOptimizing ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                    <div className="relative w-24 h-24 mb-6">
                       <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                       <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center font-black text-indigo-600 text-xl">{probeProgress.percent}%</div>
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">正在连接采样...</p>
                    <p className="text-[10px] font-mono text-slate-400 break-all px-4">{probeProgress.currentIP}</p>
                  </div>
                ) : optimalIPs.length > 0 ? (
                  <div className="space-y-3">
                    {optimalIPs.slice(0, 6).map((ip, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-300">#{i+1}</span>
                            <div>
                               <p className="text-xs font-mono font-bold text-slate-700">{ip.ip}</p>
                               <div className="flex items-center gap-2 mt-1">
                                  <div className={`w-1 h-1 rounded-full ${ip.latency < 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{ip.type}</span>
                               </div>
                            </div>
                         </div>
                         <div className="text-right flex items-center gap-4">
                            <div>
                               <p className="text-xs font-black text-indigo-600">{ip.latency}ms</p>
                            </div>
                            <button onClick={() => copyToClipboard(ip.ip)} className="p-2 text-slate-300 group-hover:text-indigo-600 transition-colors">
                               {copyStatus === ip.ip ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <Zap size={40} className="mb-4 text-slate-200" />
                    <p className="text-xs font-bold leading-relaxed">点击右上角雷电按钮<br/>开始 Anycast 延迟实测</p>
                  </div>
                )}
              </div>

              {/* Node List */}
              <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">活跃节点清单 ({nodes.length})</h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {nodes.map(node => (
                    <div 
                      key={node.id} 
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedNode?.id === node.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md hover:border-indigo-100'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          {node.name}
                        </span>
                        {node.proxied && <div className="p-1 bg-amber-100 text-amber-600 rounded-md" title="Cloudflare Proxied"><Cloud size={12} /></div>}
                      </div>
                      <div className="flex items-end justify-between">
                         <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">ID: {node.id}</span>
                         <span className="text-xs font-black text-slate-900">{node.latency}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Deploy Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-8 pb-0 flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-800">部署新边缘节点</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle size={24} className="text-slate-300" />
                </button>
             </div>
             <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase mb-2 block ml-1">节点标识 (ID)</label>
                    <input 
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="如: US-WEST-1"
                      value={newNode.id} onChange={e => setNewNode({...newNode, id: e.target.value})}
                    />
                  </div>
                  <div>
                     <label className="text-xs font-black text-slate-400 uppercase mb-2 block ml-1">节点名称</label>
                     <input 
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="如: 旧金山边缘 01"
                      value={newNode.name} onChange={e => setNewNode({...newNode, name: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                   <label className="text-xs font-black text-slate-400 uppercase mb-2 block ml-1">目标地址 (IPv4/CNAME)</label>
                   <input 
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    placeholder="104.x.x.x 或 host.domain.com"
                    value={newNode.location} onChange={e => setNewNode({...newNode, location: e.target.value})}
                  />
                </div>

                <div className="p-4 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-indigo-700">Cloudflare 代理设置</span>
                    <button 
                      onClick={() => setNewNode({...newNode, proxied: !newNode.proxied})}
                      className={`w-12 h-6 rounded-full transition-all relative ${newNode.proxied ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newNode.proxied ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-400 leading-normal">开启代理后，Cloudflare 将为该节点分配 Anycast IP 并提供 WAF 与 DDoS 防护，源站 IP 将被隐藏。</p>
                </div>

                {!isSimulatedMode && (
                  <div className="space-y-4 pt-2">
                    <input 
                      type="password" placeholder="CF API Token" 
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs"
                      value={cfConfig.apiToken} onChange={e => setCfConfig({...cfConfig, apiToken: e.target.value})}
                    />
                    <input 
                      type="text" placeholder="Zone ID" 
                      className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs"
                      value={cfConfig.zoneId} onChange={e => setCfConfig({...cfConfig, zoneId: e.target.value})}
                    />
                  </div>
                )}
             </div>
             <div className="p-8 bg-slate-50 flex gap-4">
                <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition-all">取消</button>
                <button onClick={handleCreateNode} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                  <Save size={18} />
                  确认部署
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{icon: any, label: string, active?: boolean, sidebarOpen: boolean}> = ({ icon, label, active, sidebarOpen }) => (
  <a href="#" className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
    <span className={`${active ? 'text-white' : 'text-slate-400'}`}>{icon}</span>
    {sidebarOpen && <span className="text-sm tracking-wide">{label}</span>}
  </a>
);

export default App;
