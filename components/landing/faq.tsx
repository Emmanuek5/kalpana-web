"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is Kalpana?",
      answer:
        "Kalpana is an AI-powered cloud development platform that provides VSCode servers with custom runtimes in your browser. You can connect GitHub repos, run terminals, and let AI assist with coding tasks.",
    },
    {
      question: "How does the AI assistant work?",
      answer:
        "Our AI assistant is powered by Claude and GPT-4. It can understand your codebase, write code, run commands, search files, and help with debugging. Simply chat with it like you would with a colleague.",
    },
    {
      question: "Can I use my own GitHub repositories?",
      answer:
        "Yes! You can clone any public or private GitHub repository directly into your workspace. We support OAuth authentication for secure access to your repositories.",
    },
    {
      question: "What programming languages are supported?",
      answer:
        "Kalpana supports all major programming languages through Nix-based runtimes. You can use pre-configured templates for Node.js, Python, Go, Rust, and more, or bring your own Nix configuration.",
    },
    {
      question: "Is my code secure?",
      answer:
        "Absolutely. We are SOC 2 compliant with end-to-end encryption. Each workspace runs in isolated Docker containers, and your code is never shared or used for training AI models.",
    },
    {
      question: "Can I collaborate with my team?",
      answer:
        "Yes! Pro and Enterprise plans include real-time collaboration features. Multiple developers can work on the same workspace simultaneously, similar to Google Docs.",
    },
    {
      question: "What happens if I cancel?",
      answer:
        "You can cancel anytime. Your workspaces will remain accessible until the end of your billing period. You can export your code and data before cancellation.",
    },
    {
      question: "Do you offer educational or open source discounts?",
      answer:
        "Yes! We offer free Pro plans for students and educators, as well as discounts for open source maintainers. Contact our support team to learn more.",
    },
  ];

  return (
    <div className="relative container mx-auto px-6 py-32">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-6xl font-normal tracking-tight mb-6">
            Frequently Asked Questions
          </h2>
          <p className="text-zinc-400 text-xl">
            Everything you need to know about Kalpana
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/50 hover:border-emerald-500/30 transition-all"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-8 py-6 flex items-center justify-between text-left group"
              >
                <h3 className="text-xl font-medium text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  {faq.question}
                </h3>
                <ChevronDown
                  className={`h-6 w-6 text-emerald-500 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-8 pb-6">
                  <p className="text-zinc-400 leading-relaxed text-lg">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center p-8 border border-zinc-800 rounded-2xl bg-zinc-900/50">
          <p className="text-zinc-400 text-lg mb-4">Still have questions?</p>
          <a
            href="mailto:support@kalpana.dev"
            className="inline-flex items-center gap-2 text-emerald-500 hover:text-emerald-400 transition-colors text-lg font-medium"
          >
            Contact our support team
            <span className="text-sm">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
