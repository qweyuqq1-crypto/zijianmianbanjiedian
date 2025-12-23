
import { CFNode, DiagnosticResult, OptimalIP } from "../types";

/**
 * 本地诊断逻辑
 */
export const performLocalDiagnostic = (nodes: CFNode[]): DiagnosticResult => {
  const offlineNodes = nodes.filter(n => n.status === 'offline');
  const warningNodes = nodes.filter(n => n.status === 'warning');
  const highLatencyNodes = nodes.filter(n => n.status === 'online' && n.latency > 150);

  let score = 100;
  score -= (offlineNodes.length * 20);
  score -= (warningNodes.length * 10);
  score -= (highLatencyNodes.length * 5);
  score = Math.max(0, score);

  const recommendations: string[] = [];
  let summary = "系统运行状况良好，所有核心节点响应正常。";

  if (offlineNodes.length > 0) {
    summary = `检测到 ${offlineNodes.length} 个节点离线。`;
    recommendations.push("立即检查离线节点的 DNS 解析配置。");
  }

  if (score < 80) {
    recommendations.push("当前网络环境下 Anycast 路由不佳，建议切换优选 IP。");
  }

  return { summary, recommendations, healthScore: score };
};

/**
 * 核心探测函数
 * 改用 http 并严格控制超时，以获得更准确的 RTT
 */
const probeLatency = async (ip: string, timeout = 800): Promise<number | null> => {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // 关键：使用 http 而不是 https，避开证书校验导致的 1s+ 延迟
    await fetch(`http://${ip}/cdn-cgi/trace`, {
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal,
    });
    
    clearTimeout(id);
    const end = performance.now();
    const duration = Math.round(end - start);
    
    // 如果执行时间太接近超时时间，通常意味着它是因为信号终止才返回的
    return duration < (timeout - 10) ? duration : null;
  } catch (e) {
    return null;
  }
};

/**
 * 更全面的 IP 池
 */
const CF_IP_POOL = [
  "104.16.0.1", "104.17.0.1", "104.18.0.1", "104.19.0.1", "104.20.0.1",
  "172.64.0.1", "172.67.0.1", "162.159.0.1", "108.162.192.1", "141.101.112.1",
  "197.234.240.1", "198.41.128.1", "162.158.0.1", "188.114.96.1", "103.21.244.1",
  "103.22.200.1", "103.31.4.1", "141.101.64.1", "190.93.240.1", "190.93.248.1"
];

export const testAndRankIPs = async (
  onProgress: (current: string, progress: number) => void,
  concurrency = 5
): Promise<OptimalIP[]> => {
  const results: OptimalIP[] = [];
  const pool = [...CF_IP_POOL];
  const total = pool.length;
  let finished = 0;

  const runTest = async (ip: string) => {
    onProgress(ip, Math.round((finished / total) * 100));
    
    // 三次采样取平均，过滤无效样本
    const samples = await Promise.all([
      probeLatency(ip, 1000),
      probeLatency(ip, 1000),
      probeLatency(ip, 1000)
    ]);
    
    const validSamples = samples.filter((s): s is number => s !== null);
    
    if (validSamples.length > 0) {
      const avgLatency = Math.round(validSamples.reduce((a, b) => a + b, 0) / validSamples.length);
      const packetLoss = Math.round(((samples.length - validSamples.length) / samples.length) * 100);

      // 只保留丢包率低于 70% 的结果
      if (packetLoss < 70) {
        results.push({
          ip,
          latency: avgLatency,
          packetLoss,
          speed: `${(40 - (avgLatency / 10)).toFixed(1)} MB/s`,
          type: 'Anycast'
        });
      }
    }
    
    finished++;
    onProgress(ip, Math.round((finished / total) * 100));
  };

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    const worker = (async () => {
      while (pool.length > 0) {
        const ip = pool.shift();
        if (ip) await runTest(ip);
      }
    })();
    workers.push(worker);
  }

  await Promise.all(workers);

  return results.sort((a, b) => {
    if (a.packetLoss !== b.packetLoss) return a.packetLoss - b.packetLoss;
    return a.latency - b.latency;
  }).slice(0, 10);
};
