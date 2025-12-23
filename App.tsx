
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Globe, 
  LayoutDashboard, 
  Network, 
  RefreshCw, 
  Search, 
  Settings, 
  Trophy, 
  Zap,
  FlaskConical,
  Server,
  Cpu,
  ArrowUpRight
} from 'lucide-react';
import { fetchUserInfo } from './services/ipService';
import { testAndRankIPs } from './services/diagnosticService';
import { UserInfo, OptimalIP, CFNode } from './types';
import { MOCK_NODES } from './constants';
import GlobalMap from './components/GlobalMap';
import StatCard from './components/StatCard';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'dashboard' | 'network' | 'lab' | 'settings'>('dashboard');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [optimalIPs, setOptimalIPs] = useState<OptimalIP[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [probeProgress, setProbeProgress] = useState({ ip: '', percent: 0 });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [nodes] = useState<CFNode[]>(MOCK_NODES);
  const [selectedNode, setSelectedNode] = useState<CFNode | null>(null);

  useEffect(() => {
    // Initial data fetch
    fetchUserInfo().then(setUserInfo);
  }, []);

  const handleOptimizeIP = async () => {
    setIsOptimizing(true);
    try {
      const results = await testAndRankIPs((ip, percent) => {
        setProbeProgress({ ip, percent });
      });
      setOptimalIPs(results);
    } catch (error) {
      console.error("Optimization failed:", error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(text);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const renderContentView = () => {
    switch(activeView) {
      case 'dashboard':
        return (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                label="平均延迟" 
                value="42ms" 
                icon={<Activity size={20} />} 
                trend="-5%" 
                trendPositive={true} 
              />
              <StatCard 
                label="活跃节点" 
                value={nodes.filter(n => n.status === 'online').length} 
                icon={<Server size={20} />} 
              />
              <StatCard 
                label="系统负载" 
                value="12.5%" 
                icon={<Cpu size={20} />} 
                trend="+2%" 
                trendPositive={false} 
              />
              <StatCard 
                label="请求总量" 
                value="42.1k" 
                icon={<ArrowUpRight size={20} />} 
              />
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200">
               <h3 className="text-lg font-bold mb-4">实时拓扑预览</h3>
               <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
            </div>
          </div>
        );
      case 'network':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold">全球边缘节点拓扑</h3>
                 <div className="flex gap-2">
                   {['online', 'warning', 'offline'].map(status => (
                     <div key={status} className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-bold uppercase">
                       <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                       {status}
                     </div>
                   ))}
                 </div>
               </div>
               <GlobalMap nodes={nodes} onNodeSelect={setSelectedNode} />
             </div>
             {selectedNode && (
               <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-in zoom-in-95">
                 <h4 className="font-bold text-slate-800 mb-2">节点详情: {selectedNode.name}</h4>
                 <div className="grid grid-cols-3 gap-4 text-sm">
                   <div><span className="text-slate-400">延迟:</span> {selectedNode.latency}ms</div>
                   <div><span className="text-slate-400">可用性:</span> {selectedNode.uptime}%</div>
                   <div><span className="text-slate-400">状态:</span> {selectedNode.status}</div>
                 </div>
               </div>
             )}
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
                              <p className="text-xs text-slate-400 font-bold">出口 IP</p>
                              <p className="text-lg font-mono font-black text-slate-800">{userInfo.ip}</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">运营商</p>
                              <p className="text-sm font-bold text-slate-700 truncate">{userInfo.org}</p>
                           </div>
                           <div className="p-4 border border-slate-100 rounded-2xl">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">连接状态</p>
                              <p className="text-sm font-bold text-emerald-600">接入正常</p>
                           </div>
                        </div>
                     </div>
                   ) : <div className="animate-pulse space-y-4"><div className="h-16 bg-slate-100 rounded-2xl"></div><div className="h-16 bg-slate-100 rounded-2xl"></div></div>}
                </div>
             </div>

             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-bold">测速排名 (丢包率优先)</h3>
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                     <AlertCircle size={12} /> 建议选择丢包率为 0% 的 IP
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                   {optimalIPs.length > 0 ? optimalIPs.map((ip, i) => (
                     <div key={i} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:shadow-lg hover:border-indigo-200 transition-all group relative overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                           <span className="text-[10px] font-black text-slate-300">RANK #{i+1}</span>
                           <button onClick={() => copyToClipboard(ip.ip)} className="text-slate-300 group-hover:text-indigo-600 relative z-10">
                             {copyStatus === ip.ip ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                           </button>
                        </div>
                        <p className="text-sm font-mono font-bold text-slate-800 mb-1">{ip.ip}</p>
                        <div className="flex items-end justify-between mt-4">
                           <div>
                             <div className="text-indigo-600 font-black text-xl leading-none">{ip.latency}ms</div>
                             <div className={`text-[9px] font-bold mt-1 ${ip.packetLoss > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                               丢包率: {ip.packetLoss}%
                             </div>
                           </div>
                           <div className={`px-2 py-0.5 rounded text-[8px] font-bold ${ip.latency < 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                             {ip.latency < 100 ? '极速' : '一般'}
                           </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-500" style={{ width: `${Math.max(0, 100 - (ip.latency / 5))}%` }}></div>
                     </div>
                   )) : (
                     <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl">
                        <Search className="text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 text-sm font-medium">点击“开始深度探测”启动实时优选</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 animate-in fade-in duration-500">
            <h3 className="text-xl font-bold mb-6">系统配置</h3>
            <p className="text-slate-500">API 配置与凭据管理功能正在开发中。</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 text-indigo-600 mb-10">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
              <Activity size={24} />
            </div>
            <h1 className="text-xl font-black tracking-tight">CF EDGE MGR</h1>
          </div>
          
          <nav className="space-y-2">
            {[
              { id: 'dashboard', label: '控制中心', icon: LayoutDashboard },
              { id: 'network', label: '全球拓扑', icon: Network },
              { id: 'lab', label: '优选实验室', icon: FlaskConical },
              { id: 'settings', label: '系统设置', icon: Settings }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id as any)}
                className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-bold transition-all ${
                  activeView === item.id 
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-8">
          <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden">
             <p className="text-[10px] font-bold text-indigo-400 mb-1">PRO VERSION</p>
             <p className="text-xs font-bold leading-tight">解锁更多边缘计算能力</p>
             <button className="mt-4 text-[10px] font-black bg-white text-slate-900 px-3 py-1.5 rounded-lg">立即升级</button>
             <div className="absolute -right-4 -bottom-4 opacity-10">
               <Zap size={80} />
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50/50 p-10">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-800">
              {activeView === 'dashboard' && '控制中心'}
              {activeView === 'network' && '全球拓扑'}
              {activeView === 'lab' && '优选实验室'}
              {activeView === 'settings' && '系统设置'}
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">实时监测边缘节点状态与网络链路质量</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-bold">HK</div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-amber-100 flex items-center justify-center text-[10px] font-bold">US</div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold">+2</div>
            </div>
            <div className="h-10 w-px bg-slate-200"></div>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        {renderContentView()}
      </main>
    </div>
  );
};

export default App;
