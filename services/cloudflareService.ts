
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
    
    // 如果启用代理，实际请求地址是 Worker 地址，目标地址放在 x-target-url 头中
    let finalRequestUrl = targetUrl;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };

    if (config.useProxy && config.proxyUrl) {
      finalRequestUrl = config.proxyUrl.endsWith('/') ? config.proxyUrl.slice(0, -1) : config.proxyUrl;
      headers['x-target-url'] = targetUrl; // 核心修复：通过 Header 传递目标 URL
    }

    try {
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

      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        // 如果是 405，很有可能是请求被 Worker 拦截或者转发路径不对
        const errorDesc = response.status === 405 ? "Method Not Allowed (请确保 Worker 源码已更新为 Header 转发版)" : `非 JSON 响应`;
        throw new Error(`${errorDesc} (状态码 ${response.status}): ${text.slice(0, 150)}...`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.errors?.map((e: any) => e.message).join(", ") || `API 错误 (${response.status})`;
        throw new Error(`Cloudflare API: ${errorMsg}`);
      }

      return data;
    } catch (err: any) {
      // 捕获各种网络或解析错误
      if (err.message.includes("Unexpected end of JSON input")) {
        throw new Error("后端返回了空响应，请确认子域名不包含中文或特殊字符。");
      }
      throw err;
    }
  }
};
