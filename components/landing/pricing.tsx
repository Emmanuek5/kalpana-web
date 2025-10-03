"use client";

import React from "react";
import { Check } from "lucide-react";

export function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "9.99",
      description: "Perfect for individual developers",
      features: [
        "5 Workspaces",
        "2GB RAM per workspace",
        "10GB Storage",
        "Community Support",
        "Basic AI Features",
        "GitHub Integration",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Pro",
      price: "19.99",
      description: "For professional developers",
      features: [
        "Unlimited Workspaces",
        "8GB RAM per workspace",
        "100GB Storage",
        "Priority Support",
        "Advanced AI Features",
        "GitHub + GitLab",
        "Custom Domains",
        "Team Collaboration",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "59.99",
      description: "For teams and organizations",
      features: [
        "Everything in Pro",
        "16GB RAM per workspace",
        "500GB Storage",
        "24/7 Premium Support",
        "Unlimited AI Usage",
        "SSO & SAML",
        "Custom Integrations",
        "SLA Guarantee",
        "Dedicated Account Manager",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <div className="relative container mx-auto px-6 py-32">
      <div className="text-center mb-20">
        <h2 className="text-5xl font-normal tracking-tight mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-zinc-500 text-lg">
          Choose the plan that fits your needs
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan, i) => (
          <div
            key={i}
            className={`relative rounded-2xl border p-8 ${
              plan.popular
                ? "bg-gradient-to-b from-emerald-500/5 to-zinc-900 border-emerald-500/30 scale-105"
                : "bg-zinc-900 border-zinc-800"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-zinc-950 text-xs font-medium rounded-full">
                Most Popular
              </div>
            )}
            <h3 className="text-2xl font-medium mb-2">{plan.name}</h3>
            <p className="text-zinc-500 text-sm mb-6">{plan.description}</p>
            <div className="mb-6">
              <span className="text-5xl font-normal">${plan.price}</span>
              <span className="text-zinc-500">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, j) => (
                <li key={j} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-zinc-300 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="/login"
              className={`block text-center px-6 py-3 rounded-lg font-medium transition-all ${
                plan.popular
                  ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                  : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
              }`}
            >
              {plan.cta}
            </a>
          </div>
        ))}
      </div>

      <p className="text-center text-zinc-500 text-sm mt-12">
        All plans include a 14-day free trial. No credit card required.
      </p>
    </div>
  );
}
