
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  /**
   * 创建 DNS 记录
   * @param config 用户配置
   * @param node 节点信息
   * @param isSimulated 是否模拟
   */
  async createDnsRecord(config: CFConfig, node: Partial<CFNode>, isSimulated: boolean = false): Promise<any> {
    if (isSimulated) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, result: { id: "mock_" + Date.now() } };
    }

    if (!config.apiToken || !config.zoneId) {
      throw new Error("配置缺失：请先在设置中填写 API Token 和 Zone ID");
    }

    // 默认请求地址
    let targetUrl = `${BASE_URL}/zones/${config.zoneId}/dns_records`;
    
    // 如果使用了代理
    let finalUrl = config.useProxy && config.proxyUrl 
      ? `${config.proxyUrl}${config.proxyUrl.includes('?') ? '' : '?'}${targetUrl}`
      : targetUrl;

    try {
      const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: node.type || 'A',
          name: node.id,
          content: node.location,
          ttl: 1, // 自动 TTL
          proxied: node.proxied ?? true
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.errors?.[0]?.message || `HTTP 错误: ${response.status}`;
        throw new Error(`Cloudflare API 拒绝请求: ${errorMsg}`);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error("网络错误：浏览器 CORS 限制。请务必在设置中部署并使用 Cloudflare Worker 代理。");
      }
      throw err;
    }
  }
};
