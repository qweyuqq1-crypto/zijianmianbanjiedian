
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  /**
   * 获取现有的 DNS 记录
   */
  async listDnsRecords(config: CFConfig): Promise<CFNode[]> {
    if (!config.apiToken || !config.zoneId) {
      throw new Error("配置缺失：请先填写 API Token 和 Zone ID");
    }

    const targetUrl = `${BASE_URL}/zones/${config.zoneId}/dns_records?type=A,AAAA,CNAME&per_page=100`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    let finalUrl = targetUrl;
    if (config.useProxy && config.proxyUrl) {
      finalUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl.slice(0, -1) : config.proxyUrl;
      headers['x-target-url'] = targetUrl;
    }

    const response = await fetch(finalUrl, { method: 'GET', headers });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || "无法获取 DNS 记录");
    }

    return data.result.map((rec: any) => ({
      id: rec.name.split('.')[0], // 获取子域名部分
      name: rec.name,
      location: rec.content,
      coords: [110 + Math.random() * 20, 20 + Math.random() * 10], // 随机分布，实际应用可根据 IP 定位
      status: 'online',
      latency: Math.floor(Math.random() * 100) + 30,
      uptime: 100,
      requests: 0,
      lastUpdate: rec.modified_on,
      source: 'api',
      proxied: rec.proxied,
      type: rec.type
    }));
  },

  /**
   * 创建 DNS 记录
   */
  async createDnsRecord(config: CFConfig, node: Partial<CFNode>): Promise<any> {
    if (!config.apiToken || !config.zoneId) {
      throw new Error("配置缺失：请在设置中填写 API Token 和 Zone ID");
    }

    const targetUrl = `${BASE_URL}/zones/${config.zoneId}/dns_records`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    let finalRequestUrl = targetUrl;
    if (config.useProxy && config.proxyUrl) {
      finalRequestUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl.slice(0, -1) : config.proxyUrl;
      headers['x-target-url'] = targetUrl;
    }

    const response = await fetch(finalRequestUrl, {
      method: 'POST',
      headers: headers,
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
      throw new Error(data.errors?.[0]?.message || `API 错误 (${response.status})`);
    }

    return data;
  }
};
