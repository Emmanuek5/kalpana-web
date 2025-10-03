'use client';

import React, { useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DynamicTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: number;
  badge?: string | number;
  pulseColor?: string;
  content: React.ReactNode;
}

interface DynamicTabBarProps {
  tabs: DynamicTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  maxVisible?: number;
}

export function DynamicTabBar({
  tabs,
  activeTabId,
  onTabChange,
  maxVisible = 2,
}: DynamicTabBarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Calculate visible and overflow tabs
  const { visibleTabs, overflowTabs } = useMemo(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId);

    // Get other tabs sorted by priority (highest first)
    const otherTabs = tabs
      .filter((t) => t.id !== activeTabId)
      .sort((a, b) => b.priority - a.priority);

    // Visible: active tab + top (maxVisible - 1) highest priority tabs
    const visible = [activeTab, ...otherTabs.slice(0, maxVisible - 1)].filter(
      Boolean
    ) as DynamicTab[];

    // Overflow: remaining tabs
    const overflow = otherTabs.slice(maxVisible - 1);

    return { visibleTabs: visible, overflowTabs: overflow };
  }, [tabs, activeTabId, maxVisible]);

  return (
    <div className="flex border-b border-zinc-800 bg-zinc-950/50">
      {/* Visible Tabs */}
      {visibleTabs.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onClick={() => onTabChange(tab.id)}
        />
      ))}

      {/* Overflow Menu */}
      {overflowTabs.length > 0 && (
        <OverflowMenu
          tabs={overflowTabs}
          isOpen={overflowOpen}
          onToggle={() => setOverflowOpen(!overflowOpen)}
          onSelect={(tabId) => {
            onTabChange(tabId);
            setOverflowOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: DynamicTab;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={`
        flex-1 px-4 py-3 text-sm font-medium transition-colors relative
        ${
          isActive
            ? 'text-emerald-400 border-b-2 border-emerald-500'
            : 'text-zinc-500 hover:text-zinc-300'
        }
      `}
    >
      <div className="flex items-center justify-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{tab.label}</span>

        {/* Badge */}
        {tab.badge && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            {tab.badge}
          </span>
        )}

        {/* Pulse Indicator */}
        {tab.pulseColor && (
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: tab.pulseColor }}
          />
        )}
      </div>
    </button>
  );
}

// Overflow Menu Component
function OverflowMenu({
  tabs,
  isOpen,
  onToggle,
  onSelect,
}: {
  tabs: DynamicTab[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (tabId: string) => void;
}) {
  // Check if any overflow tab has a badge
  const hasBadge = tabs.some((t) => t.badge);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="px-3 py-3 text-zinc-500 hover:text-zinc-300 transition-colors relative"
        title="More tabs"
      >
        <MoreHorizontal className="h-4 w-4" />
        {hasBadge && (
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={onToggle}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full right-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelect(tab.id)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800 transition-colors text-left"
                >
                  <Icon className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm text-zinc-300 flex-1">{tab.label}</span>
                  {tab.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                      {tab.badge}
                    </span>
                  )}
                  {tab.pulseColor && (
                    <span
                      className="h-2 w-2 rounded-full animate-pulse"
                      style={{ backgroundColor: tab.pulseColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
