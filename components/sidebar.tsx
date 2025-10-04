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
  Bot,
  Rocket,
  Coins,
  Users as UsersIcon,
  Database,
  Zap,
  HardDrive,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { TeamSwitcher } from "./workspace/team-switcher";
import { useTeam } from "@/lib/team-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentTeam } = useTeam();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(
    pathname.startsWith("/dashboard/settings")
  );
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<{
    remaining: number;
    totalCredits: number;
  } | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  useEffect(() => {
    fetchUser();
    fetchCredits();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/get-session");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  };

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/openrouter/credits");
      if (res.ok) {
        const data = await res.json();
        setCredits(data);
      }
    } catch (error) {
      console.error("Failed to fetch credits:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

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
      name: "Databases",
      href: "/dashboard/databases",
      icon: Database,
      active: pathname.startsWith("/dashboard/databases"),
    },
    {
      name: "Buckets",
      href: "/dashboard/buckets",
      icon: HardDrive,
      active: pathname.startsWith("/dashboard/buckets"),
    },
    {
      name: "Deployments",
      href: "/dashboard/deployments",
      icon: Rocket,
      active: pathname.startsWith("/dashboard/deployments"),
    },
    {
      name: "Edge Functions",
      href: "/dashboard/edge-functions",
      icon: Zap,
      active: pathname.startsWith("/dashboard/edge-functions"),
    },
    {
      name: "Agents",
      href: "/dashboard/agents",
      icon: Bot,
      active: pathname.startsWith("/dashboard/agents"),
    },
    {
      name: "Presets",
      href: "/dashboard/presets",
      icon: Settings,
      active: pathname === "/dashboard/presets",
    },
    ...(currentTeam
      ? [
          {
            name: "Team Settings",
            href: `/dashboard/teams/${currentTeam.id}`,
            icon: UsersIcon,
            active: pathname.startsWith(`/dashboard/teams/${currentTeam.id}`),
          },
        ]
      : []),
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
      className={`relative h-screen bg-gradient-to-b from-[#0a0a0a] to-[#141414] flex flex-col transition-all duration-300 border-r border-zinc-800/50 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo/Header */}
      <div className="h-16 flex items-center px-4 justify-between mb-4 border-b border-zinc-800/30">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Terminal className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Kalpana
            </span>
          </div>
        )}
        {collapsed && (
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <Terminal className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {/* New Workspace Button */}
        <Button
          onClick={() => router.push("/dashboard/new")}
          className={`w-full justify-start bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 font-semibold mb-6 h-11 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all ${
            collapsed ? "px-0 justify-center" : ""
          }`}
        >
          <Plus className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "New Workspace"}
        </Button>

        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all group ${
                  item.active
                    ? "bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 shadow-sm shadow-emerald-500/10"
                    : "text-zinc-400 hover:bg-zinc-800/40 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.name : undefined}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110 ${
                    item.active ? "text-emerald-400" : ""
                  }`}
                />
                {!collapsed && <span className="truncate">{item.name}</span>}
                {item.active && !collapsed && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            );
          })}

          {/* Settings Section with Submenu */}
          {!collapsed && (
            <div className="pt-2">
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-800/40 hover:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:rotate-90 duration-300" />
                  <span>Settings</span>
                </div>
                <div className="transition-transform duration-200">
                  {settingsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  settingsExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="ml-6 mt-1 space-y-1 border-l-2 border-zinc-800/50 pl-3">
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => router.push(item.href)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                          item.active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "text-zinc-500 hover:bg-zinc-800/40 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {collapsed &&
            settingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center justify-center px-0 py-3 rounded-xl text-sm font-medium transition-all group ${
                    item.active
                      ? "bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400"
                      : "text-zinc-400 hover:bg-zinc-800/40 hover:text-white"
                  }`}
                  title={item.name}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 group-hover:scale-110 transition-transform" />
                </button>
              );
            })}
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-zinc-800/30 p-3 space-y-2 mt-auto bg-zinc-900/20 backdrop-blur-sm">
        {/* Credits Display */}
        {!collapsed && (
          <div className="px-3.5 py-3 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/50 border border-zinc-700/30 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-500">Credits</span>
              </div>
              {loadingCredits ? (
                <Skeleton className="h-4 w-14 bg-zinc-800" />
              ) : credits ? (
                <span
                  className={`text-sm font-bold ${
                    credits.remaining < 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  ${credits.remaining.toFixed(2)}
                </span>
              ) : null}
            </div>
            {!loadingCredits && credits && (
              <div className="relative h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                    credits.remaining < 0
                      ? "bg-gradient-to-r from-red-500 to-red-600"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, (credits.remaining / credits.totalCredits) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Team Switcher */}
        {!collapsed && user && <TeamSwitcher user={user} />}

        {/* Collapsed user avatar */}
        {collapsed && (
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="w-full flex justify-center group"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || user.email}
                className="h-9 w-9 rounded-lg ring-2 ring-zinc-700/50 object-cover group-hover:ring-emerald-500/50 transition-all"
              />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-700/30 group-hover:ring-emerald-500/50 transition-all">
                <User className="h-4 w-4 text-emerald-400" />
              </div>
            )}
          </button>
        )}

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-10 font-medium rounded-xl transition-all group ${
            collapsed ? "px-0 justify-center" : ""
          }`}
        >
          <LogOut
            className={`h-[18px] w-[18px] group-hover:scale-110 transition-transform ${
              collapsed ? "" : "mr-2"
            }`}
          />
          {!collapsed && "Logout"}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-7 w-7 rounded-full bg-zinc-900 border border-zinc-700/50 flex items-center justify-center hover:bg-zinc-800 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/20 transition-all shadow-md z-10"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-zinc-400" />
        )}
      </button>
    </div>
  );
}