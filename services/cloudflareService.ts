
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  sanitizeId(id: string): string {
    if (!id) return "";
    return id.trim().replace(/^["']|["']$/g, '');
  },

  async request(config: CFConfig, method: string, path: string, body?: any) {
    const apiToken = this.sanitizeId(config.apiToken);
    const zoneId = this.sanitizeId(config.zoneId);

    if (!apiToken || !zoneId) {
      throw new Error("配置缺失：请检查 Token 和 Zone ID 是否填写正确。");
    }

    // 确保 path 开头有斜杠且没有双斜杠
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const targetUrl = `${BASE_URL}${cleanPath}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    let fetchUrl = targetUrl;
    if (config.useProxy && config.proxyUrl) {
      // 确保代理 URL 格式正确
      fetchUrl = config.proxyUrl.replace(/\/$/, ''); 
      headers['x-target-url'] = targetUrl;
    }

    console.log(`[CloudVista] 发送请求: ${method} ${targetUrl}`, body);

    const response = await fetch(fetchUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get("content-type") || "";
    
    if (!contentType.includes("application/json")) {
      const errorText = await response.text();
      throw new Error(`请求失败 (${response.status}): ${errorText.slice(0, 100)}`);
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message || `API 报错 (${response.status})`;
      throw new Error(`Cloudflare: ${errorMsg}`);
    }

    return data;
  },

  async listDnsRecords(config: CFConfig): Promise<CFNode[]> {
    const zoneId = this.sanitizeId(config.zoneId);
    const data = await this.request(config, 'GET', `/zones/${zoneId}/dns_records?type=A,AAAA,CNAME&per_page=100`);
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
    const zoneId = this.sanitizeId(config.zoneId);
    const domain = config.domain.trim().toLowerCase();
    
    // 关键修复：Cloudflare API 的 name 必须是完整域名或者能被识别的子域名
    // 如果用户只输入了 'gj'，我们帮他拼接成 'gj.shiye.ggff.net'
    const fullName = node.id?.includes('.') ? node.id : `${node.id}.${domain}`;

    return this.request(config, 'POST', `/zones/${zoneId}/dns_records`, {
      type: node.type || 'A',
      name: fullName,
      content: node.location,
      ttl: 1, 
      proxied: node.proxied ?? true
    });
  }
};
