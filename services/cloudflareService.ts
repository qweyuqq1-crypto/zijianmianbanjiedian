
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
      throw new Error("配置缺失：请在设置中填写 API Token 和 Zone ID");
    }

    const targetUrl = `${BASE_URL}/zones/${config.zoneId}/dns_records`;
    
    let finalUrl = targetUrl;
    if (config.useProxy && config.proxyUrl) {
      const cleanProxyUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl.slice(0, -1) : config.proxyUrl;
      finalUrl = `${cleanProxyUrl}?${encodeURIComponent(targetUrl)}`;
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

      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`后端返回了非 JSON 格式内容 (${response.status}): ${text.slice(0, 100)}...`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        // 如果是 Cloudflare 报错，提取具体错误信息
        const errorMsg = data.errors?.map((e: any) => e.message).join(", ") || `API 错误 (${response.status})`;
        throw new Error(`Cloudflare: ${errorMsg}`);
      }

      return data;
    } catch (err: any) {
      if (err.message.includes("Unexpected end of JSON input")) {
        throw new Error("解析失败：后端返回了空响应。请检查子域名是否包含特殊字符，或更新 Worker 源码。");
      }
      throw err;
    }
  }
};
