"use client"
import React, { useEffect, useState } from "react";
import { Github, Terminal, ArrowRight } from "lucide-react";
import { BentoGridFeatures } from "@/components/landing/bento-features";
import {
  WhyKalpanaSection,
  SecurityPerformanceSection,
} from "@/components/landing/features-showcase";
import { PricingSection } from "@/components/landing/pricing";
import { FAQSection } from "@/components/landing/faq";

export default function LandingPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setSession(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            {!loading && (
              session?.user ? (
                <a
                  href="/dashboard"
                  className="px-5 py-2 text-sm bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all rounded-lg font-medium"
                >
                  Go to Dashboard
                </a>
              ) : (
                <>
                  <a
                    href="/login"
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                  >
                    Sign In
                  </a>
                  <a
                    href="/login"
                    className="px-5 py-2 text-sm bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all rounded-lg font-medium"
                  >
                    Get Started
                  </a>
                </>
              )
            )}
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

      {/* Bento Grid Features Section */}
      <BentoGridFeatures />

      {/* Why Kalpana Section */}
      <WhyKalpanaSection />

      {/* Security & Performance */}
      <SecurityPerformanceSection />

      {/* Pricing Section */}
      <PricingSection />

      {/* FAQ Section */}
      <FAQSection />

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
            className="group inline-flex px-8 py-4 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all rounded-lg font-medium items-center gap-2"
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
    <footer className="relative border-t border-zinc-800/50 py-16 mt-20 bg-zinc-950/50">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-xl font-normal text-zinc-100">Kalpana</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                AI-powered cloud development platform for modern developers.
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Product</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#features" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="/dashboard" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Dashboard
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Resources</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Guides
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-4">Company</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="/login" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors">
                    Sign In
                  </a>
                </li>
                <li>
                  <a href="https://github.com" className="text-sm text-zinc-500 hover:text-emerald-400 transition-colors flex items-center gap-2">
                    <Github className="h-3.5 w-3.5" />
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-600">
              &copy; {new Date().getFullYear()} Kalpana. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-zinc-600 hover:text-emerald-400 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-zinc-600 hover:text-emerald-400 transition-colors">
                Terms of Service
              </a>
              <p className="text-sm text-zinc-700">
                Built with Next.js & Docker
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
