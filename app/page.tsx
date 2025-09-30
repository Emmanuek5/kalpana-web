import React from "react";
import {
  Code2,
  Github,
  Sparkles,
  Terminal,
  Zap,
  ArrowRight,
  Lock,
  Gauge,
  Globe,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none" />

      {/* Navbar */}
      <nav className="relative border-b border-zinc-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
              <Terminal className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-xl font-normal tracking-tight text-zinc-100">
              Kalpana
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/login"
              className="px-5 py-2 text-sm bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all rounded-lg font-medium"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative container mx-auto px-6 pt-32 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm mb-8">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">
              AI-Powered Development
            </span>
          </div>

          <h1 className="text-7xl font-normal tracking-tight mb-8 leading-tight">
            Your Cloud Development
            <br />
            <span className="text-zinc-500">Environment, Reimagined</span>
          </h1>

          <p className="text-lg text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Spin up VSCode servers with custom runtimes, connect your GitHub
            repos, and let AI handle the heavy lifting. All in your browser.
          </p>

          <div className="flex gap-4 justify-center">
            <a
              href="/login"
              className="group px-6 py-3 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all rounded-lg font-medium flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              Start with GitHub
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="/dashboard"
              className="px-6 py-3 border border-zinc-800 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all rounded-lg font-medium text-zinc-300 flex items-center gap-2"
            >
              View Dashboard
            </a>
          </div>

          <p className="text-sm text-zinc-600 mt-6">
            Free for developers · No credit card required
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative container mx-auto px-6 py-32">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-normal tracking-tight mb-4">
            Everything You Need to Code
          </h2>
          <p className="text-zinc-500 text-lg">
            A complete cloud development platform
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-px max-w-6xl mx-auto bg-zinc-800/30 border border-zinc-800/30 rounded-2xl overflow-hidden">
          {[
            {
              icon: Code2,
              title: "Full VSCode Experience",
              desc: "Complete VSCode editor in your browser with all your favorite extensions and themes.",
            },
            {
              icon: Sparkles,
              title: "AI-Powered Assistant",
              desc: "Chat with AI to write code, run commands, search files, and more. Powered by Claude and GPT-4.",
            },
            {
              icon: Zap,
              title: "Nix-Based Runtimes",
              desc: "Reproducible development environments with Nix. Use templates or bring your own config.",
            },
            {
              icon: Github,
              title: "GitHub Integration",
              desc: "Clone any GitHub repository (public or private) directly into your workspace.",
            },
            {
              icon: Terminal,
              title: "Full Terminal Access",
              desc: "Integrated terminal with full shell access. Run builds, tests, and any command you need.",
            },
            {
              icon: Zap,
              title: "Instant Spin-up",
              desc: "Start coding in seconds. Each workspace gets isolated Docker containers with dedicated resources.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative p-8 bg-zinc-950 hover:bg-zinc-900/50 transition-all"
            >
              <div className="h-11 w-11 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-6 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/10 transition-all">
                <feature.icon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-medium mb-3 text-zinc-100">
                {feature.title}
              </h3>
              <p className="text-zinc-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why Kalpana Section */}
      <div className="relative container mx-auto px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-normal tracking-tight mb-6">
                Why Developers Choose Kalpana
              </h2>
              <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                Traditional development environments are slow to set up, hard to
                reproduce, and lack the intelligence needed for modern
                workflows. Kalpana changes that.
              </p>
              <div className="space-y-4">
                {[
                  "Zero-config environment setup with Nix",
                  "AI that understands your entire codebase",
                  "Collaborate in real-time with team members",
                  "Deploy directly from your workspace",
                ].map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-zinc-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
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
                <div className="p-6 font-mono text-sm space-y-2">
                  <div className="flex gap-3">
                    <span className="text-zinc-600 select-none">1</span>
                    <span className="text-zinc-500">import</span>
                    <span className="text-zinc-300">{"{ AI }"}</span>
                    <span className="text-zinc-500">from</span>
                    <span className="text-emerald-400">
                      &apos;kalpana&apos;
                    </span>
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
                    <span className="text-emerald-400">
                      &apos;node-20&apos;
                    </span>
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
                  <span className="text-xs text-zinc-500">
                    Workspace running
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Performance */}
      <div className="relative container mx-auto px-6 py-32">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-medium mb-3">Enterprise Security</h3>
              <p className="text-zinc-500 leading-relaxed">
                SOC 2 compliant with end-to-end encryption. Your code stays
                private.
              </p>
            </div>
            <div className="text-center p-8">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Gauge className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-medium mb-3">Lightning Fast</h3>
              <p className="text-zinc-500 leading-relaxed">
                Optimized infrastructure with global edge deployment for minimal
                latency.
              </p>
            </div>
            <div className="text-center p-8">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Globe className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-medium mb-3">Global Scale</h3>
              <p className="text-zinc-500 leading-relaxed">
                Deployed across 12 regions worldwide. Work from anywhere,
                anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative container mx-auto px-6 py-32">
        <div className="max-w-4xl mx-auto text-center border border-emerald-500/10 rounded-3xl p-16 bg-gradient-to-b from-emerald-500/5 to-zinc-950 backdrop-blur-sm">
          <h2 className="text-5xl font-normal tracking-tight mb-6">
            Ready to Start Building?
          </h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-2xl mx-auto">
            Join developers using Kalpana to build faster with AI-powered cloud
            workspaces.
          </p>
          <a
            href="/login"
            className="group px-8 py-4 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all rounded-lg font-medium flex items-center gap-2 mx-auto"
          >
            <Github className="h-5 w-5" />
            Sign Up with GitHub
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <p className="text-zinc-600 text-sm mt-6">
            Free for individual developers · No credit card required
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-zinc-800/50 py-12 mt-20">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
                <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="font-normal text-zinc-400">Kalpana</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="/dashboard"
                className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/login"
                className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
              >
                Sign In
              </a>
              <p className="text-sm text-zinc-600">
                Built with Next.js, AI SDK, and Docker
              </p>
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-zinc-700">
            © {new Date().getFullYear()} Kalpana. Your AI-powered cloud
            development platform.
          </div>
        </div>
      </footer>
    </div>
  );
}
