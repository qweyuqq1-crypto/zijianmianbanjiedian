
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  /**
   * 通用请求封装，增加详细调试
   */
  async request(config: CFConfig, method: string, path: string, body?: any) {
    if (!config.apiToken || !config.zoneId) {
      throw new Error("配置缺失：请在设置中填写 API Token 和 Zone ID");
    }

    const targetUrl = `${BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    let finalUrl = targetUrl;
    if (config.useProxy && config.proxyUrl) {
      finalUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl.slice(0, -1) : config.proxyUrl;
      headers['x-target-url'] = targetUrl;
    }

    const response = await fetch(finalUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get("content-type") || "";
    
    // 如果不是 JSON，很有可能是代理报错或者被防火墙拦截了
    if (!contentType.includes("application/json")) {
      const errorText = await response.text();
      throw new Error(`服务器返回了非 JSON 内容 (${response.status}): ${errorText.slice(0, 100)}...`);
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      const raw = await response.text();
      throw new Error(`JSON 解析失败: ${raw.slice(0, 50)}`);
    }

    if (!response.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message || `API 错误 (${response.status})`;
      throw new Error(`Cloudflare: ${errorMsg}`);
    }

    return data;
  },

  async listDnsRecords(config: CFConfig): Promise<CFNode[]> {
    const data = await this.request(config, 'GET', `/zones/${config.zoneId}/dns_records?type=A,AAAA,CNAME&per_page=100`);
    return data.result.map((rec: any) => ({
      id: rec.name.split('.')[0],
      name: rec.name,
      location: rec.content,
      coords: [110 + Math.random() * 20, 20 + Math.random() * 10],
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

  async createDnsRecord(config: CFConfig, node: Partial<CFNode>): Promise<any> {
    return this.request(config, 'POST', `/zones/${config.zoneId}/dns_records`, {
      type: node.type || 'A',
      name: node.id,
      content: node.location,
      ttl: 1, 
      proxied: node.proxied ?? true
    });
  }
};
