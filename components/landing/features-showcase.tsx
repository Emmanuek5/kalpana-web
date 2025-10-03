"use client";

import React from "react";
import { Lock, Gauge, Globe, CheckCircle2, Zap } from "lucide-react";

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
              {/* VS Code Interface */}
              <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs text-zinc-500 ml-2">
                  my-app - VS Code
                </span>
              </div>
              <div className="p-6 space-y-4 bg-gradient-to-b from-zinc-900 to-zinc-950">
                {/* File Explorer */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>📁</span>
                    <span className="font-semibold">my-app</span>
                  </div>
                  <div className="ml-4 space-y-1 text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span>📄</span>
                      <span>package.json</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📁</span>
                      <span>src/</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📁</span>
                      <span>components/</span>
                    </div>
                  </div>
                </div>

                {/* Terminal */}
                <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs text-zinc-600">TERMINAL</div>
                  </div>
                  <div className="font-mono text-xs space-y-1">
                    <div className="text-zinc-500">
                      $ npm run dev
                    </div>
                    <div className="text-emerald-400">
                      ✓ Ready in 1.2s
                    </div>
                    <div className="text-zinc-400">
                      → Local: http://localhost:3000
                    </div>
                  </div>
                </div>

                {/* AI Chat */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-semibold">AI Assistant</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    I&apos;ve analyzed your codebase. Would you like me to add authentication?
                  </p>
                </div>
              </div>
              <div className="bg-zinc-950 border-t border-zinc-800 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-zinc-500">Workspace active</span>
                </div>
                <span className="text-xs text-zinc-600">2 collaborators</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SecurityPerformanceSection() {
  const features = [
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "SOC 2 compliant with end-to-end encryption. Your code stays private and secure.",
      stats: ["256-bit encryption", "SOC 2 Type II", "GDPR compliant"]
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Optimized infrastructure with global edge deployment for minimal latency.",
      stats: ["<100ms response", "99.99% uptime", "Global CDN"]
    },
    {
      icon: Globe,
      title: "Global Scale",
      description: "Deployed across 12 regions worldwide. Work from anywhere, anytime.",
      stats: ["12 regions", "24/7 support", "Auto-scaling"]
    }
  ];

  return (
    <div className="relative container mx-auto px-6 py-32">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-emerald-500/30 transition-all p-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                  <div className="h-16 w-16 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-medium mb-3 group-hover:text-emerald-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed mb-6">
                    {feature.description}
                  </p>
                  <div className="space-y-2">
                    {feature.stats.map((stat, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm text-zinc-500">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {stat}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
