
export interface CFNode {
  id: string;
  name: string;
  location: string;
  coords: [number, number];
  status: 'online' | 'warning' | 'offline';
  latency: number;
  uptime: number;
  requests: number;
  lastUpdate: string;
  proxied?: boolean;
  type?: 'A' | 'AAAA' | 'CNAME';
  source: 'mock' | 'api' | 'manual';
}

export interface MetricPoint {
  time: string;
  requests: number;
  latency: number;
}

export interface DiagnosticResult {
  summary: string;
  recommendations: string[];
  healthScore: number;
}

export interface UserInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
  loc: string;
}

export interface OptimalIP {
  ip: string;
  latency: number;
  packetLoss: number;
  speed: string;
  type: 'Anycast' | 'Unicast';
}

export interface CFConfig {
  apiToken: string;
  zoneId: string;
}
