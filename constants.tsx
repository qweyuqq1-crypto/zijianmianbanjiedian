
import React from 'react';
import { CFNode, MetricPoint } from './types';

// Added missing 'source' property to each mock node to match the CFNode interface
export const MOCK_NODES: CFNode[] = [
  { id: 'HKG', name: '香港节点 (HKG)', location: 'Hong Kong', coords: [114.1694, 22.3193], status: 'online', latency: 32, uptime: 99.99, requests: 12540, lastUpdate: '2023-10-27 10:00:00', source: 'mock' },
  { id: 'SJC', name: '圣何塞节点 (SJC)', location: 'San Jose, USA', coords: [-121.8863, 37.3382], status: 'online', latency: 156, uptime: 99.95, requests: 8432, lastUpdate: '2023-10-27 10:00:05', source: 'mock' },
  { id: 'FRA', name: '法兰克福节点 (FRA)', location: 'Frankfurt, DE', coords: [8.6821, 50.1109], status: 'warning', latency: 210, uptime: 98.40, requests: 4210, lastUpdate: '2023-10-27 09:55:00', source: 'mock' },
  { id: 'NRT', name: '成田节点 (NRT)', location: 'Tokyo, JP', coords: [139.6917, 35.6895], status: 'online', latency: 45, uptime: 99.98, requests: 11020, lastUpdate: '2023-10-27 10:00:10', source: 'mock' },
  { id: 'SIN', name: '新加坡节点 (SIN)', location: 'Singapore', coords: [103.8198, 1.3521], status: 'online', latency: 58, uptime: 99.97, requests: 9650, lastUpdate: '2023-10-27 10:00:02', source: 'mock' },
  { id: 'LHR', name: '伦敦节点 (LHR)', location: 'London, UK', coords: [-0.1278, 51.5074], status: 'offline', latency: 0, uptime: 0, requests: 0, lastUpdate: '2023-10-27 08:30:00', source: 'mock' },
];

export const generateMetricHistory = (): MetricPoint[] => {
  const points: MetricPoint[] = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    points.push({
      time: `${time.getHours()}:00`,
      requests: Math.floor(Math.random() * 5000) + 1000,
      latency: Math.floor(Math.random() * 50) + 20,
    });
  }
  return points;
};
