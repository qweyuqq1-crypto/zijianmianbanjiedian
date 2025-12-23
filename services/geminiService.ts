
import { GoogleGenAI } from "@google/genai";
import { CFNode } from "../types";

export const analyzeNodesWithAI = async (nodes: CFNode[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    你是一个专业的网络架构师和 Cloudflare 专家。
    请分析以下边缘节点的运行数据，并提供一份简明扼要的中文诊断报告。
    数据：${JSON.stringify(nodes.map(n => ({ 
      name: n.name, 
      status: n.status, 
      latency: n.latency, 
      uptime: n.uptime 
    })))}
    
    要求：
    1. 评估整体系统健康度 (0-100)。
    2. 找出表现最差的节点并说明可能原因。
    3. 提供 3 条具体的优化建议。
    4. 语言要专业且具有行动指导性。
    请以 JSON 格式返回，包含字段：summary (字符串), recommendations (数组), healthScore (数字)。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      summary: result.summary || "分析完成，系统运行平稳。",
      recommendations: result.recommendations || ["定期检查节点状态", "优化 Anycast 路由"],
      healthScore: result.healthScore || 90
    };
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return null;
  }
};
