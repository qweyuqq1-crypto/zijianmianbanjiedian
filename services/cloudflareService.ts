
import { CFConfig, CFNode } from "../types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export const cloudflareApi = {
  /**
   * 清洗 ID，去除引号和空格
   */
  sanitizeId(id: string): string {
    if (!id) return "";
    return id.trim().replace(/^["']|["']$/g, '');
  },

  /**
   * 通用请求封装，增加详细调试
   */
  async request(config: CFConfig, method: string, path: string, body?: any) {
    const apiToken = this.sanitizeId(config.apiToken);
    const zoneId = this.sanitizeId(config.zoneId);

    if (!apiToken || !zoneId) {
      throw new Error("配置缺失：请在设置中填写 API Token 和 Zone ID (确保没有多余的引号)");
    }

    // 处理路径中的 Zone ID 替换，确保它是干净的
    // 之前的 path 可能是从外部传入的包含 ${config.zoneId} 的字符串
    // 我们在具体方法里调用时需要确保传入的也是清洗过的
    const cleanPath = path.replace(config.zoneId, zoneId);
    const targetUrl = `${BASE_URL}${cleanPath}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiToken}`,
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
    
    if (!contentType.includes("application/json")) {
      const errorText = await response.text();
      // 检查是否是由于路径错误导致的 404
      if (response.status === 404 || response.status === 400) {
         throw new Error(`Cloudflare 路由错误 (${response.status})：请检查 Zone ID 是否包含多余引号或空格。原始返回：${errorText.slice(0, 50)}`);
      }
      throw new Error(`服务器返回了非 JSON 内容 (${response.status}): ${errorText.slice(0, 100)}...`);
    }

    let data;
    try {
      const text = await response.text();
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`JSON 解析失败，服务器可能返回了损坏的数据`);
    }

    if (!response.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message || `API 错误 (${response.status})`;
      throw new Error(`Cloudflare: ${errorMsg}`);
    }

    return data;
  },

  async listDnsRecords(config: CFConfig): Promise<CFNode[]> {
    const cleanZoneId = this.sanitizeId(config.zoneId);
    const data = await this.request(config, 'GET', `/zones/${cleanZoneId}/dns_records?type=A,AAAA,CNAME&per_page=100`);
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
    const cleanZoneId = this.sanitizeId(config.zoneId);
    return this.request(config, 'POST', `/zones/${cleanZoneId}/dns_records`, {
      type: node.type || 'A',
      name: node.id,
      content: node.location,
      ttl: 1, 
      proxied: node.proxied ?? true
    });
  }
};
