"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import {
  Terminal,
  LayoutDashboard,
  Settings,
  LogOut,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(
    pathname.startsWith("/dashboard/settings")
  );

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const navigation = [
    {
      name: "Workspaces",
      href: "/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/dashboard",
    },
    {
      name: "Presets",
      href: "/dashboard/presets",
      icon: Settings,
      active: pathname === "/dashboard/presets",
    },
  ];

  const settingsItems = [
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: User,
      active: pathname === "/dashboard/settings",
    },
    {
      name: "Domains",
      href: "/dashboard/settings/domains",
      icon: Globe,
      active: pathname === "/dashboard/settings/domains",
    },
  ];

  return (
    <div
      className={`relative h-screen bg-zinc-900/50 border-r border-zinc-800/50 flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo/Header */}
      <div className="h-16 border-b border-zinc-800/50 flex items-center px-4 justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
              <Terminal className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-xl font-light tracking-tight text-zinc-100">
              Kalpana
            </span>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20 mx-auto">
            <Terminal className="h-4 w-4 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {/* New Workspace Button */}
        <Button
          onClick={() => router.push("/dashboard/new")}
          className={`w-full justify-start bg-emerald-500 text-zinc-950 hover:bg-emerald-400 ${
            collapsed ? "px-0 justify-center" : ""
          }`}
        >
          <Plus className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "New Workspace"}
        </Button>

        <div className="pt-2 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </button>
            );
          })}

          {/* Settings Section with Submenu */}
          {!collapsed && (
            <div>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Settings</span>
                </div>
                {settingsExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {settingsExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => router.push(item.href)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          item.active
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {collapsed && settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center justify-center px-0 py-2 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                }`}
                title={item.name}
              >
                <Icon className="h-4 w-4 shrink-0" />
              </button>
            );
          })}
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-zinc-800/50 p-3 space-y-2">
        {/* Profile (placeholder) */}
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-zinc-500" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-zinc-300 truncate">
                Account
              </div>
              <div className="text-xs text-zinc-600 truncate">User Profile</div>
            </div>
          )}
        </div>

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10 ${
            collapsed ? "px-0 justify-center" : ""
          }`}
        >
          <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Logout"}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-zinc-400" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-zinc-400" />
        )}
      </button>
    </div>
  );
}
