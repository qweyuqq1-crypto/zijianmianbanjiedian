
import { UserInfo } from "../types";

export const fetchUserInfo = async (): Promise<UserInfo> => {
  try {
    const response = await fetch('https://ipinfo.io/json');
    if (!response.ok) throw new Error('Failed to fetch IP info');
    return await response.json();
  } catch (error) {
    console.error("IP info fetch failed:", error);
    return {
      ip: "未知",
      city: "未知城市",
      region: "未知地区",
      country: "未知国家",
      org: "未知运营商",
      loc: "0,0"
    };
  }
};
