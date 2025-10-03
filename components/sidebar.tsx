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
      name: "Deployments",
      href: "/dashboard/deployments",
      icon: Rocket,
      active: pathname.startsWith("/dashboard/deployments"),
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
      className={`relative h-screen bg-[#1a1a1a] flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo/Header */}
      <div className="h-16 flex items-center px-4 justify-between mb-2">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
              <Terminal className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">
              Kalpana
            </span>
          </div>
        )}
        {collapsed && (
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {/* New Workspace Button */}
        <Button
          onClick={() => router.push("/dashboard/new")}
          className={`w-full justify-start bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-medium mb-4 h-10 ${
            collapsed ? "px-0 justify-center" : ""
          }`}
        >
          <Plus className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "New Workspace"}
        </Button>

        <div className="space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  item.active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </button>
            );
          })}

          {/* Settings Section with Submenu */}
          {!collapsed && (
            <div className="pt-1">
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-[18px] w-[18px] shrink-0" />
                  <span>Settings</span>
                </div>
                {settingsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {settingsExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-zinc-800 pl-2">
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => router.push(item.href)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          item.active
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "text-zinc-500 hover:bg-zinc-800/50 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {collapsed &&
            settingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center justify-center px-0 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    item.active
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                  }`}
                  title={item.name}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                </button>
              );
            })}
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-zinc-800 p-3 space-y-1.5 mt-auto">
        {/* Credits Display */}
        {!collapsed && (
          <div className="px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Credits</span>
              {loadingCredits ? (
                <Skeleton className="h-3 w-12 bg-zinc-800" />
              ) : credits ? (
                <span className={`text-xs font-bold ${credits.remaining < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  ${credits.remaining.toFixed(2)}
                </span>
              ) : null}
            </div>
            {!loadingCredits && credits && (
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${credits.remaining < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{
                    width: `${Math.max(0, (credits.remaining / credits.totalCredits) * 100)}%`,
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
            className="w-full flex justify-center"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || user.email}
                className="h-8 w-8 rounded-full ring-2 ring-zinc-700/50 object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-600/20 to-emerald-500/10 flex items-center justify-center ring-2 ring-emerald-700/30">
                <User className="h-4 w-4 text-emerald-400" />
              </div>
            )}
          </button>
        )}

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className={`w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-10 font-medium ${
            collapsed ? "px-0 justify-center" : ""
          }`}
        >
          <LogOut className={`h-[18px] w-[18px] ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && "Logout"}
        </Button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 hover:border-zinc-600 transition-all shadow-lg"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>
    </div>
  );
}