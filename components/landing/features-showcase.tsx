"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, Gauge, Globe, CheckCircle2, Shield, Zap } from "lucide-react";

export function WhyKalpanaSection() {
  return (
    <div className="relative container mx-auto px-6 py-32">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-5xl font-normal tracking-tight mb-6">
              Why Developers Choose Kalpana
            </h2>
            <p className="text-zinc-400 text-xl mb-10 leading-relaxed">
              Traditional development environments are slow to set up, hard to
              reproduce, and lack the intelligence needed for modern workflows.
              Kalpana changes that.
            </p>
            <div className="space-y-5">
              {[
                "Zero-config environment setup with Nix",
                "AI that understands your entire codebase",
                "Collaborate in real-time with team members",
                "Deploy directly from your workspace",
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-0.5 group-hover:bg-emerald-500/20 transition-all">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-zinc-300 text-lg">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
              {/* Mini Code Editor */}
              <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs text-zinc-500 ml-2">
                  workspace.tsx
                </span>
              </div>
              <div className="p-6 font-mono text-sm space-y-2 bg-gradient-to-b from-zinc-900 to-zinc-950">
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">1</span>
                  <span className="text-zinc-500">import</span>
                  <span className="text-zinc-300">{"{ AI }"}</span>
                  <span className="text-zinc-500">from</span>
                  <span className="text-emerald-400">&apos;kalpana&apos;</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">2</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">3</span>
                  <span className="text-purple-400">const</span>
                  <span className="text-blue-400">workspace</span>
                  <span className="text-zinc-500">=</span>
                  <span className="text-zinc-500">await</span>
                  <span className="text-zinc-300">AI</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">4</span>
                  <span className="ml-4 text-zinc-300">.create({"{"}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">5</span>
                  <span className="ml-8 text-zinc-400">runtime:</span>
                  <span className="text-emerald-400">&apos;node-20&apos;</span>
                  <span className="text-zinc-500">,</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">6</span>
                  <span className="ml-8 text-zinc-400">repo:</span>
                  <span className="text-emerald-400">
                    &apos;myproject&apos;
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">7</span>
                  <span className="ml-4 text-zinc-300">{"}"});</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">8</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-zinc-600 select-none">9</span>
                  <span className="text-zinc-500">{"//"}</span>
                  <span className="text-zinc-600">Ready in 2.3s ⚡</span>
                </div>
              </div>
              <div className="bg-zinc-950 border-t border-zinc-800 px-6 py-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-zinc-500">Workspace running</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SecurityPerformanceSection() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left - rect.width / 2) / 20,
      y: (e.clientY - rect.top - rect.height / 2) / 20,
    });
  };

  return (
    <div
      className="relative container mx-auto px-6 py-32"
      style={{ perspective: "2000px" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Security - 3D Enhanced */}
          <div
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 hover:border-emerald-500/30 transition-all duration-500"
            style={{
              transform: `rotateX(${-mousePosition.y}deg) rotateY(${
                mousePosition.x
              }deg)`,
              transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
          >
            {/* 3D depth layers */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div
              className="relative p-10"
              style={{ transform: "translateZ(20px)" }}
            >
              <div
                className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all duration-500 shadow-2xl shadow-emerald-500/20"
                style={{ transform: "translateZ(40px)" }}
              >
                <Lock className="h-10 w-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4 group-hover:text-emerald-400 transition-colors">
                Enterprise Security
              </h3>
              <p className="text-zinc-400 leading-relaxed text-lg mb-6">
                SOC 2 compliant with end-to-end encryption. Your code stays
                private and secure.
              </p>
              <SecurityAnimation3D />
            </div>
          </div>

          {/* Performance - 3D Enhanced */}
          <div
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 hover:border-emerald-500/30 transition-all duration-500"
            style={{
              transform: `rotateX(${-mousePosition.y}deg) rotateY(${
                mousePosition.x
              }deg)`,
              transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div
              className="relative p-10"
              style={{ transform: "translateZ(20px)" }}
            >
              <div
                className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all duration-500 shadow-2xl shadow-emerald-500/20"
                style={{ transform: "translateZ(40px)" }}
              >
                <Gauge className="h-10 w-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4 group-hover:text-emerald-400 transition-colors">
                Lightning Fast
              </h3>
              <p className="text-zinc-400 leading-relaxed text-lg mb-6">
                Optimized infrastructure with global edge deployment for minimal
                latency.
              </p>
              <PerformanceMetrics3D />
            </div>
          </div>

          {/* Global Scale - 3D Globe */}
          <div
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 hover:border-emerald-500/30 transition-all duration-500"
            style={{
              transform: `rotateX(${-mousePosition.y}deg) rotateY(${
                mousePosition.x
              }deg)`,
              transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.1),transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div
              className="relative p-10"
              style={{ transform: "translateZ(20px)" }}
            >
              <div
                className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-all duration-500 shadow-2xl shadow-emerald-500/20"
                style={{ transform: "translateZ(40px)" }}
              >
                <Globe className="h-10 w-10 text-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-2xl font-medium mb-4 group-hover:text-emerald-400 transition-colors">
                Global Scale
              </h3>
              <p className="text-zinc-400 leading-relaxed text-lg mb-6">
                Deployed across 12 regions worldwide. Work from anywhere,
                anytime.
              </p>
              <Globe3D />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Animation Component
function SecurityAnimation() {
  const [shields, setShields] = useState([
    { id: 1, active: true },
    { id: 2, active: false },
    { id: 3, active: false },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShields((prev) =>
        prev.map((shield, i) => ({
          ...shield,
          active: i === Math.floor(Date.now() / 1000) % 3,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      {shields.map((shield) => (
        <div
          key={shield.id}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
            shield.active
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-zinc-950/50 border-zinc-800"
          }`}
        >
          <div
            className={`h-2 w-2 rounded-full ${
              shield.active ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ${
                shield.active ? "w-full" : "w-0"
              }`}
            />
          </div>
        </div>
      ))}
      <div className="pt-2 flex items-center justify-between text-xs">
        <span className="text-zinc-500">End-to-end encrypted</span>
        <span className="text-emerald-500 font-medium">100% Secure</span>
      </div>
    </div>
  );
}

// Performance Metrics Component
function PerformanceMetrics() {
  const [metrics, setMetrics] = useState([
    { label: "Response Time", value: 0, max: 100, unit: "ms" },
    { label: "Uptime", value: 0, max: 100, unit: "%" },
    { label: "Throughput", value: 0, max: 1000, unit: "req/s" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics([
        {
          label: "Response Time",
          value: 12 + Math.random() * 8,
          max: 100,
          unit: "ms",
        },
        { label: "Uptime", value: 99.9, max: 100, unit: "%" },
        {
          label: "Throughput",
          value: 850 + Math.random() * 100,
          max: 1000,
          unit: "req/s",
        },
      ]);
    }, 2000);

    // Initial animation
    setTimeout(() => {
      setMetrics([
        { label: "Response Time", value: 15, max: 100, unit: "ms" },
        { label: "Uptime", value: 99.9, max: 100, unit: "%" },
        { label: "Throughput", value: 892, max: 1000, unit: "req/s" },
      ]);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      {metrics.map((metric, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{metric.label}</span>
            <span className="text-emerald-500 font-mono font-medium">
              {metric.value.toFixed(metric.unit === "%" ? 1 : 0)}
              {metric.unit}
            </span>
          </div>
          <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000 ease-out"
              style={{ width: `${(metric.value / metric.max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Enhanced World Map Component - Much Larger!
function WorldMapLarge() {
  const [activeRegions, setActiveRegions] = useState<number[]>([0]);
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);

  const regions = [
    { x: 18, y: 38, name: "US West", users: "2.4K" },
    { x: 25, y: 32, name: "US East", users: "5.1K" },
    { x: 45, y: 28, name: "Europe", users: "8.3K" },
    { x: 48, y: 55, name: "Africa", users: "1.2K" },
    { x: 68, y: 38, name: "Asia", users: "12.5K" },
    { x: 75, y: 28, name: "Japan", users: "3.7K" },
    { x: 85, y: 65, name: "Australia", users: "1.8K" },
    { x: 32, y: 62, name: "Brazil", users: "2.9K" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRegions((prev) => {
        if (prev.length >= regions.length) {
          return [0];
        }
        return [...prev, prev.length];
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-64 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden p-4">
      {/* Enhanced World Map SVG with better continents */}
      <svg
        viewBox="0 0 100 80"
        className="w-full h-full opacity-15"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* North America */}
        <path
          d="M 12 30 Q 15 25 20 26 L 25 24 L 28 28 L 30 35 L 28 42 L 24 45 L 18 44 L 14 38 Z"
          fill="currentColor"
          className="text-emerald-500"
        />
        {/* Europe */}
        <path
          d="M 42 22 Q 48 20 52 22 L 54 26 L 52 30 L 48 32 L 44 30 L 42 26 Z"
          fill="currentColor"
          className="text-emerald-500"
        />
        {/* Asia */}
        <path
          d="M 58 24 Q 65 22 72 25 L 78 28 L 80 35 L 76 42 L 70 44 L 64 42 L 60 36 L 58 30 Z"
          fill="currentColor"
          className="text-emerald-500"
        />
        {/* Africa */}
        <path
          d="M 44 38 Q 48 36 52 38 L 54 45 L 52 55 L 48 58 L 44 56 L 42 48 Z"
          fill="currentColor"
          className="text-emerald-500"
        />
        {/* South America */}
        <path
          d="M 28 52 Q 32 50 35 52 L 36 58 L 35 65 L 30 68 L 26 65 L 26 56 Z"
          fill="currentColor"
          className="text-emerald-500"
        />
        {/* Australia */}
        <path
          d="M 82 60 Q 86 58 90 60 L 90 66 L 86 68 L 82 66 Z"
          fill="currentColor"
          className="text-emerald-500"
        />
      </svg>

      {/* Animated region dots with better visuals */}
      {regions.map((region, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          style={{ left: `${region.x}%`, top: `${region.y}%` }}
          onMouseEnter={() => setHoveredRegion(i)}
          onMouseLeave={() => setHoveredRegion(null)}
        >
          <div
            className={`relative transition-all duration-500 ${
              activeRegions.includes(i)
                ? "scale-100 opacity-100"
                : "scale-0 opacity-0"
            }`}
          >
            {/* Outer glow ring */}
            <div className="absolute inset-0 h-6 w-6 -m-1.5 rounded-full bg-emerald-500/20 animate-ping" />

            {/* Middle pulse ring */}
            <div className="absolute inset-0 h-5 w-5 -m-1 rounded-full bg-emerald-500/30 blur-sm" />

            {/* Solid dot */}
            <div className="relative h-3 w-3 rounded-full bg-emerald-400 border-2 border-zinc-950 shadow-lg shadow-emerald-500/50" />

            {/* Tooltip on hover */}
            {hoveredRegion === i && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-12 bg-zinc-900 border border-emerald-500/30 rounded-lg px-3 py-2 whitespace-nowrap shadow-xl z-10">
                <div className="text-xs font-medium text-zinc-100">
                  {region.name}
                </div>
                <div className="text-[10px] text-emerald-500">
                  {region.users} active users
                </div>
                {/* Arrow pointer */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-900" />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Enhanced connection lines with animation */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0)" />
            <stop offset="50%" stopColor="rgba(16, 185, 129, 0.6)" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
          </linearGradient>
        </defs>
        {activeRegions.slice(0, -1).map((_, i) => {
          if (i + 1 < activeRegions.length) {
            const from = regions[activeRegions[i]];
            const to = regions[activeRegions[i + 1]];
            return (
              <g key={i}>
                {/* Glow line */}
                <line
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke="url(#lineGradient)"
                  strokeWidth="3"
                  className="blur-sm"
                />
                {/* Solid line */}
                <line
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke="rgba(16, 185, 129, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />
              </g>
            );
          }
          return null;
        })}
      </svg>

      {/* Stats overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-400">
            {activeRegions.length} regions active
          </span>
        </div>
        <span className="text-xs text-emerald-500 font-medium">
          99.99% uptime
        </span>
      </div>
    </div>
  );
}

// 3D Enhanced Security Animation
function SecurityAnimation3D() {
  const [shields, setShields] = useState([
    { id: 1, active: true, depth: 0 },
    { id: 2, active: false, depth: 10 },
    { id: 3, active: false, depth: 20 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setShields((prev) =>
        prev.map((shield, i) => ({
          ...shield,
          active: i === Math.floor(Date.now() / 1000) % 3,
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3" style={{ transformStyle: "preserve-3d" }}>
      {shields.map((shield, i) => (
        <div
          key={shield.id}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-500 ${
            shield.active
              ? "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/20"
              : "bg-zinc-950/50 border-zinc-800"
          }`}
          style={{
            transform: `translateZ(${
              shield.active ? shield.depth + 10 : shield.depth
            }px)`,
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div className="relative">
            <div
              className={`h-2 w-2 rounded-full ${
                shield.active ? "bg-emerald-500" : "bg-zinc-600"
              }`}
            />
            {shield.active && (
              <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ${
                shield.active ? "w-full" : "w-0"
              }`}
              style={{
                boxShadow: shield.active
                  ? "0 0 10px rgba(16, 185, 129, 0.5)"
                  : "none",
              }}
            />
          </div>
          <Shield
            className={`h-3 w-3 transition-colors ${
              shield.active ? "text-emerald-500" : "text-zinc-600"
            }`}
          />
        </div>
      ))}
      <div className="pt-2 flex items-center justify-between text-xs">
        <span className="text-zinc-500">End-to-end encrypted</span>
        <span className="text-emerald-500 font-medium flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          100% Secure
        </span>
      </div>
    </div>
  );
}

// 3D Enhanced Performance Metrics
function PerformanceMetrics3D() {
  const [metrics, setMetrics] = useState([
    { label: "Response Time", value: 0, max: 100, unit: "ms", depth: 0 },
    { label: "Uptime", value: 0, max: 100, unit: "%", depth: 10 },
    { label: "Throughput", value: 0, max: 1000, unit: "req/s", depth: 20 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics([
        {
          label: "Response Time",
          value: 12 + Math.random() * 8,
          max: 100,
          unit: "ms",
          depth: 0,
        },
        { label: "Uptime", value: 99.9, max: 100, unit: "%", depth: 10 },
        {
          label: "Throughput",
          value: 850 + Math.random() * 100,
          max: 1000,
          unit: "req/s",
          depth: 20,
        },
      ]);
    }, 2000);

    // Initial animation
    setTimeout(() => {
      setMetrics([
        { label: "Response Time", value: 15, max: 100, unit: "ms", depth: 0 },
        { label: "Uptime", value: 99.9, max: 100, unit: "%", depth: 10 },
        {
          label: "Throughput",
          value: 892,
          max: 1000,
          unit: "req/s",
          depth: 20,
        },
      ]);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4" style={{ transformStyle: "preserve-3d" }}>
      {metrics.map((metric, i) => (
        <div
          key={i}
          className="space-y-2"
          style={{
            transform: `translateZ(${metric.depth}px)`,
            transition: "transform 0.5s ease",
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 flex items-center gap-2">
              <Zap className="h-3 w-3 text-emerald-500" />
              {metric.label}
            </span>
            <span className="text-emerald-500 font-mono font-medium">
              {metric.value.toFixed(metric.unit === "%" ? 1 : 0)}
              {metric.unit}
            </span>
          </div>
          <div className="h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 transition-all duration-1000 ease-out relative"
              style={{
                width: `${(metric.value / metric.max) * 100}%`,
                boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
              }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 3D Rotating Globe Component
// 3D Rotating Globe Component with realistic continents
function Globe3D() {
  const [rotation, setRotation] = useState(0);
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const regions = [
    { lat: 37, lon: -120, name: "US West", users: "2.4K" },
    { lat: 40, lon: -74, name: "US East", users: "5.1K" },
    { lat: 52, lon: 13, name: "Europe", users: "8.3K" },
    { lat: -1, lon: 30, name: "Africa", users: "1.2K" },
    { lat: 31, lon: 121, name: "Asia", users: "12.5K" },
    { lat: 35, lon: 139, name: "Japan", users: "3.7K" },
    { lat: -33, lon: 151, name: "Australia", users: "1.8K" },
    { lat: -23, lon: -46, name: "Brazil", users: "2.9K" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => (prev + 0.3) % 360);
    }, 30);

    return () => clearInterval(interval);
  }, []);

  // Convert lat/lon to 3D sphere coordinates
  const getPosition = (lat: number, lon: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + rotation) * (Math.PI / 180);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return { x, y, z };
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-72 bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-xl border border-zinc-800 overflow-hidden"
      style={{
        perspective: "1200px",
      }}
    >
      {/* 3D Globe Container */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Main Globe Sphere */}
        <div
          className="relative w-48 h-48"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${rotation}deg) rotateX(10deg)`,
          }}
        >
          {/* Sphere with realistic shading */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `
                radial-gradient(circle at 35% 35%, 
                  rgba(30, 41, 59, 0.9) 0%,
                  rgba(15, 23, 42, 1) 50%,
                  rgba(0, 0, 0, 1) 100%
                )
              `,
              boxShadow: `
                inset -20px -20px 40px rgba(0, 0, 0, 0.8),
                inset 10px 10px 30px rgba(16, 185, 129, 0.1),
                0 0 60px rgba(16, 185, 129, 0.15),
                0 0 100px rgba(16, 185, 129, 0.1)
              `,
            }}
          />

          {/* Rotating continents layer */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 200 200"
            style={{
              transform: `rotateY(${rotation}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            <defs>
              <radialGradient id="globeGradient">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
                <stop offset="70%" stopColor="rgba(16, 185, 129, 0.2)" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
              </radialGradient>
            </defs>

            {/* North America */}
            <path
              d="M 50 60 Q 45 55 50 50 L 60 48 Q 65 50 68 55 L 70 65 Q 68 72 65 75 L 58 76 Q 52 74 50 70 Z"
              fill="url(#globeGradient)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="0.5"
              opacity="0.8"
            />

            {/* South America */}
            <path
              d="M 58 85 Q 60 80 65 82 L 68 90 Q 70 98 68 105 L 65 110 Q 60 108 58 105 L 56 95 Z"
              fill="url(#globeGradient)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="0.5"
              opacity="0.7"
            />

            {/* Europe */}
            <path
              d="M 95 55 Q 98 52 102 54 L 108 56 Q 110 60 108 65 L 104 67 Q 100 66 98 63 Z"
              fill="url(#globeGradient)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="0.5"
              opacity="0.9"
            />

            {/* Africa */}
            <path
              d="M 100 75 Q 105 72 110 75 L 112 85 Q 115 95 112 105 L 108 110 Q 103 108 100 105 L 98 90 Z"
              fill="url(#globeGradient)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="0.5"
              opacity="0.8"
            />

            {/* Asia */}
            <path
              d="M 120 50 Q 125 48 135 50 L 145 55 Q 150 60 148 68 L 145 75 Q 140 78 130 76 L 122 70 Z"
              fill="url(#globeGradient)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="0.5"
              opacity="0.85"
            />

            {/* Australia */}
            <path
              d="M 145 105 Q 150 103 155 105 L 158 112 Q 157 118 153 120 L 148 118 Q 145 114 145 110 Z"
              fill="url(#globeGradient)"
              stroke="rgba(16, 185, 129, 0.3)"
              strokeWidth="0.5"
              opacity="0.75"
            />

            {/* Grid lines for 3D effect */}
            {[30, 50, 70, 90, 110, 130, 150, 170].map((y) => (
              <ellipse
                key={`lat-${y}`}
                cx="100"
                cy="100"
                rx={Math.abs(100 - y) * 0.9}
                ry="4"
                fill="none"
                stroke="rgba(16, 185, 129, 0.08)"
                strokeWidth="0.5"
                transform={`translate(0, ${y - 100})`}
                opacity={1 - Math.abs(100 - y) / 100}
              />
            ))}

            {[0, 30, 60, 90, 120, 150].map((angle) => (
              <ellipse
                key={`lon-${angle}`}
                cx="100"
                cy="100"
                rx="3"
                ry="95"
                fill="none"
                stroke="rgba(16, 185, 129, 0.08)"
                strokeWidth="0.5"
                transform={`rotate(${angle} 100 100)`}
              />
            ))}
          </svg>

          {/* Region markers with 3D positioning */}
          {regions.map((region, i) => {
            const pos = getPosition(region.lat, region.lon, 96);
            const isVisible = pos.z > 0;
            const scale = Math.max(0.3, (pos.z + 96) / 192);
            const screenX = pos.x + 96;
            const screenY = -pos.y + 96;

            return (
              <div
                key={i}
                className={`absolute transition-all duration-300 cursor-pointer ${
                  isVisible ? "opacity-100" : "opacity-20"
                }`}
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  zIndex: isVisible ? Math.floor(pos.z) : 1,
                }}
                onMouseEnter={() => setHoveredRegion(i)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <div className="relative">
                  {/* Pulsing ring */}
                  {isVisible && (
                    <div className="absolute inset-0 h-5 w-5 -m-1 rounded-full bg-emerald-500/30 animate-ping" />
                  )}
                  {/* Core dot */}
                  <div
                    className="relative h-3 w-3 rounded-full bg-emerald-400 border-2 border-zinc-950 shadow-lg"
                    style={{
                      boxShadow: isVisible
                        ? `0 0 ${8 * scale}px rgba(16, 185, 129, 0.6)`
                        : "none",
                    }}
                  />

                  {/* Tooltip */}
                  {hoveredRegion === i && isVisible && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-zinc-900/95 backdrop-blur-sm border border-emerald-500/40 rounded-lg px-3 py-2 whitespace-nowrap shadow-2xl z-[100]">
                      <div className="text-xs font-medium text-zinc-100">
                        {region.name}
                      </div>
                      <div className="text-[10px] text-emerald-500 flex items-center gap-1">
                        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                        {region.users} active users
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atmospheric glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-3 left-3 right-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400">8 global regions</span>
          </div>
          <span className="text-xs text-emerald-500 font-medium">
            99.99% uptime
          </span>
        </div>
      </div>
    </div>
  );
}
