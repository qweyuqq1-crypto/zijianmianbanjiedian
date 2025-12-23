
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  /**
   * 创建 DNS 记录
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
    const targetUrl = `${BASE_URL}/zones/${config.zoneId}/dns_records`;
    
    // 智能拼接 URL：去掉 proxyUrl 末尾的斜杠，并在拼接时使用 ? 分割
    let finalUrl = targetUrl;
    if (config.useProxy && config.proxyUrl) {
      const cleanProxyUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl.slice(0, -1) : config.proxyUrl;
      finalUrl = `${cleanProxyUrl}?${targetUrl}`;
    }

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
          ttl: 1, 
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
      // 捕捉网络层面的报错，通常是 CORS
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error("连接后端失败。请确保你的 Worker 代码已更新到最新版（处理了 OPTIONS 请求），且 URL 正确。");
      }
      throw err;
    }
  }
};
