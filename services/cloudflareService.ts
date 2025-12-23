
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  /**
   * 创建 DNS 记录
   * 注意：在浏览器直接调用会遇到 CORS 限制。
   * 建议通过 Cloudflare Pages Functions 做转发。
   */
  async createDnsRecord(config: CFConfig, node: Partial<CFNode>, isSimulated: boolean = false): Promise<any> {
    if (isSimulated) {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1200));
      return { success: true, result: { id: "mock_" + Math.random().toString(36).substr(2, 9) } };
    }

    if (!config.apiToken || !config.zoneId) {
      throw new Error("请先在设置中配置 API Token 和 Zone ID");
    }

    const response = await fetch(`${BASE_URL}/zones/${config.zoneId}/dns_records`, {
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.message || "Cloudflare API 响应异常");
    }
    return await response.json();
  }
};
