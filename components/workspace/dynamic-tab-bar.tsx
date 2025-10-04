'use client';

import React, { useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

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
    <div className="flex flex-col">
      {/* Top Tabs Bar */}
      <div className="flex border-b border-white/10 bg-[#0f0f0f] relative">
        {/* Bottom shadow for depth */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/50 to-transparent" />
        
        {/* Visible Tabs */}
        {visibleTabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>

      {/* Overflow Tabs Footer - Docked at bottom */}
      {overflowTabs.length > 0 && (
        <OverflowFooter
          tabs={overflowTabs}
          onSelect={(tabId) => onTabChange(tabId)}
        />
      )}
    </div>
  );
}

// Tab Button Component with Depth
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
        flex-1 px-4 py-3 text-sm font-medium relative transition-all duration-200 rounded-s-md
        ${
          isActive
            ? `
              text-emerald-400 
              bg-[#242424]
              border-b-2 border-emerald-500
              shadow-[0_2px_4px_0_rgba(0,0,0,0.3)]
              [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.05)]
            `
            : `
              text-zinc-500 
              hover:text-zinc-300 
              hover:bg-white/5
              border-b-2 border-transparent
            `
        }
      `}
    >
      {/* Top highlight for active tab */}
      {isActive && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
      
      <div className="flex items-center justify-center gap-2 relative z-10">
        <Icon className="h-4 w-4" />
        <span>{tab.label}</span>

        {/* Badge with elevation */}
        {tab.badge && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-bold shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]">
            {tab.badge}
          </span>
        )}

        {/* Pulse Indicator with glow */}
        {tab.pulseColor && (
          <span
            className="h-2 w-2 rounded-full animate-pulse shadow-[0_0_8px_2px_rgba(16,185,129,0.4)]"
            style={{ backgroundColor: tab.pulseColor }}
          />
        )}
      </div>
    </button>
  );
}

// Overflow Footer Component - Docked at bottom showing tab names
function OverflowFooter({
  tabs,
  onSelect,
}: {
  tabs: DynamicTab[];
  onSelect: (tabId: string) => void;
}) {
  return (
    <div className="border-t border-white/10 bg-[#0f0f0f] relative">
      {/* Top highlight for depth */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="px-4 py-2 flex items-center gap-3 overflow-x-auto scrollbar-thin">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wide font-medium shrink-0">
          More:
        </span>
        
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className="
                flex items-center gap-2 px-3 py-1.5 
                bg-[#1a1a1a] 
                border border-white/10 
                rounded-lg 
                text-xs text-zinc-400 
                hover:text-emerald-400 
                hover:border-emerald-500/30
                hover:bg-[#242424]
                transition-all duration-200
                shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]
                hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.3)]
                [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.03)]
                shrink-0
                group
              "
            >
              <Icon className="h-3.5 w-3.5 group-hover:text-emerald-400 transition-colors" />
              <span className="font-medium">{tab.label}</span>
              
              {tab.badge && (
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-400 font-bold shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]">
                  {tab.badge}
                </span>
              )}
              
              {tab.pulseColor && (
                <span
                  className="h-2 w-2 rounded-full animate-pulse shadow-[0_0_8px_2px_rgba(16,185,129,0.4)]"
                  style={{ backgroundColor: tab.pulseColor }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
