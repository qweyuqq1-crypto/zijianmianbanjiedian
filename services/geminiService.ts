
import { GoogleGenAI, Type } from "@google/genai";
import { CFNode } from "../types";

// Always initialize a fresh client instance before making a request to ensure updated environment variables
export const analyzeNodesWithAI = async (nodes: CFNode[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `分析以下边缘节点的运行数据：${JSON.stringify(nodes.map(n => ({ 
    name: n.name, 
    status: n.status, 
    latency: n.latency, 
    uptime: n.uptime 
  })))}`;

  try {
    // Using gemini-3-pro-preview for complex reasoning task as per task classification guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: "你是一个专业的网络架构师和 Cloudflare 专家。分析提供的边缘节点运行数据，并提供一份简明扼要的中文诊断报告。评估整体系统健康度 (0-100)，找出表现最差的节点，并提供 3 条具体的、具有行动指导性的优化建议。请严格以 JSON 格式返回。",
        responseMimeType: "application/json",
        // Using responseSchema as recommended for structured JSON output
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "A summary of the node analysis result."
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Actionable recommendations for optimization."
            },
            healthScore: {
              type: Type.NUMBER,
              description: "Overall system health score from 0 to 100."
            }
          },
          required: ["summary", "recommendations", "healthScore"],
          propertyOrdering: ["summary", "recommendations", "healthScore"]
        }
      }
    });

    // Access .text property directly (not a method) from the response
    const jsonStr = response.text?.trim() || "{}";
    const result = JSON.parse(jsonStr);
    
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
