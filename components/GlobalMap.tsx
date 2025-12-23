
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { CFNode } from '../types';

interface GlobalMapProps {
  nodes: CFNode[];
  onNodeSelect: (node: CFNode) => void;
}

const GlobalMap: React.FC<GlobalMapProps> = ({ nodes, onNodeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 450;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const projection = d3.geoMercator()
      .scale(120)
      .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    // Draw Map
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then((data: any) => {
      svg.append("g")
        .selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path as any)
        .attr("fill", "#e2e8f0")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.5);

      // Draw Nodes
      const nodeGroups = svg.selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("cursor", "pointer")
        .on("click", (event, d) => onNodeSelect(d));

      nodeGroups.append("circle")
        .attr("cx", (d: any) => projection(d.coords)![0])
        .attr("cy", (d: any) => projection(d.coords)![1])
        .attr("r", 6)
        .attr("fill", (d: any) => {
          if (d.status === 'online') return '#10b981';
          if (d.status === 'warning') return '#f59e0b';
          return '#ef4444';
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .append("title")
        .text((d: any) => d.name);

      nodeGroups.append("text")
        .attr("x", (d: any) => projection(d.coords)![0] + 8)
        .attr("y", (d: any) => projection(d.coords)![1] + 4)
        .text((d: any) => d.id)
        .attr("font-size", "10px")
        .attr("fill", "#64748b")
        .attr("font-weight", "600");
    });

  }, [nodes, onNodeSelect]);

  return (
    <div className="w-full h-[450px] overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center relative">
      <svg ref={svgRef} viewBox="0 0 800 450" className="w-full h-full"></svg>
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur p-2 rounded-lg border border-slate-200 text-xs shadow-sm">
         <div className="flex items-center gap-2 mb-1">
           <span className="w-2 h-2 rounded-full bg-emerald-500"></span> <span>在线 (正常)</span>
         </div>
         <div className="flex items-center gap-2 mb-1">
           <span className="w-2 h-2 rounded-full bg-amber-500"></span> <span>波动 (警告)</span>
         </div>
         <div className="flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-red-500"></span> <span>离线 (异常)</span>
         </div>
      </div>
    </div>
  );
};

export default GlobalMap;
