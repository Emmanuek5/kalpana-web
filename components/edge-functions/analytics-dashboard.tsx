"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Zap,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnalyticsDashboardProps {
  functionId: string;
}

interface Analytics {
  period: string;
  summary: {
    totalInvocations: number;
    successfulInvocations: number;
    errorInvocations: number;
    successRate: number;
  };
  duration: {
    total: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  execution: {
    totalMilliseconds: number;
    totalSeconds: number;
    totalMinutes: number;
  };
  memory: {
    average: number;
    max: number;
  };
  cpu: {
    total: number;
    average: number;
  };
  timeSeries: Array<{
    timestamp: string;
    invocations: number;
    errors: number;
    avgDuration: number;
  }>;
  errorsByStatus: Record<string, number>;
}

export function AnalyticsDashboard({ functionId }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7d");

  useEffect(() => {
    loadAnalytics();
  }, [functionId, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/edge-functions/${functionId}/analytics?period=${period}`
      );
      if (!response.ok) throw new Error("Failed to load analytics");
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-zinc-700 animate-spin" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-zinc-500">
        Failed to load analytics
      </div>
    );
  }

  // Filter out zero data points for better visualization
  const activeTimeSeries = analytics.timeSeries.filter(t => t.invocations > 0 || t.errors > 0);
  const displayTimeSeries = activeTimeSeries.length > 0 ? analytics.timeSeries : analytics.timeSeries.slice(-20);
  
  const maxInvocations = Math.max(
    ...analytics.timeSeries.map((t) => t.invocations),
    1
  );
  
  const maxDuration = Math.max(
    ...analytics.timeSeries.map(t => t.avgDuration),
    1
  );

  const StatCard = ({ label, value, subtext, icon: Icon, color, gradient }: any) => (
    <Card className="relative overflow-hidden p-5 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group">
      {/* Gradient background */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${gradient}`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</div>
          <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        <div className="text-3xl font-bold text-zinc-100 mb-1">{value}</div>
        {subtext && <div className="text-xs text-zinc-500">{subtext}</div>}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <Activity className="h-6 w-6 text-emerald-400" />
            Analytics Dashboard
          </h2>
          <p className="text-sm text-zinc-500 mt-1">Real-time performance metrics and insights</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-zinc-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Invocations"
          value={formatNumber(analytics.summary.totalInvocations)}
          subtext={`${formatNumber(analytics.summary.successfulInvocations)} successful`}
          icon={Activity}
          color="text-blue-400"
          gradient="from-blue-500/10 to-blue-600/5"
        />
        <StatCard
          label="Success Rate"
          value={`${analytics.summary.successRate.toFixed(1)}%`}
          subtext={`${formatNumber(analytics.summary.errorInvocations)} errors`}
          icon={CheckCircle}
          color="text-emerald-400"
          gradient="from-emerald-500/10 to-emerald-600/5"
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(analytics.duration.average)}
          subtext={`P95: ${formatDuration(analytics.duration.p95)}`}
          icon={Clock}
          color="text-purple-400"
          gradient="from-purple-500/10 to-purple-600/5"
        />
        <StatCard
          label="Total Execution"
          value={
            analytics.execution.totalMinutes < 1
              ? `${analytics.execution.totalSeconds.toFixed(1)}s`
              : `${analytics.execution.totalMinutes.toFixed(1)}m`
          }
          subtext="For billing"
          icon={Zap}
          color="text-yellow-400"
          gradient="from-yellow-500/10 to-yellow-600/5"
        />
      </div>

      {/* Main Chart - Invocations, Errors & Speed */}
      <Card className="p-6 bg-zinc-900/30 border-zinc-800 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </div>
            <h4 className="text-base font-semibold text-zinc-200">Performance Overview</h4>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-zinc-400">Invocations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span className="text-zinc-400">Errors</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-400" />
              <span className="text-zinc-400">Avg Duration</span>
            </div>
          </div>
        </div>

        {/* Multi-line Chart */}
        <div className="relative h-72 mb-4">
          {/* Y-axis labels (left - invocations) */}
          <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-xs text-zinc-500">
            <span className="text-blue-400">{maxInvocations}</span>
            <span>{Math.round(maxInvocations * 0.75)}</span>
            <span>{Math.round(maxInvocations * 0.5)}</span>
            <span>{Math.round(maxInvocations * 0.25)}</span>
            <span>0</span>
          </div>
          <div className="absolute left-0 bottom-0 text-xs text-blue-400 font-medium">Count</div>

          {/* Y-axis labels (right - duration) */}
          <div className="absolute right-0 top-0 bottom-6 w-16 flex flex-col justify-between text-xs text-zinc-500 items-end">
            <span className="text-purple-400">{formatDuration(maxDuration)}</span>
            <span>{formatDuration(maxDuration * 0.75)}</span>
            <span>{formatDuration(maxDuration * 0.5)}</span>
            <span>{formatDuration(maxDuration * 0.25)}</span>
            <span>0ms</span>
          </div>
          <div className="absolute right-0 bottom-0 text-xs text-purple-400 font-medium">Duration</div>

          {/* Chart area */}
          <div className="ml-14 mr-16 h-full pb-6 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 bottom-6 flex flex-col justify-between">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t border-zinc-800/50" />
              ))}
            </div>

            {/* Data visualization */}
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {displayTimeSeries.map((point, index) => {
                const invocationHeight = (point.invocations / maxInvocations) * 100;
                const errorHeight = point.errors > 0 ? (point.errors / maxInvocations) * 100 : 0;
                const durationHeight = point.avgDuration > 0 ? (point.avgDuration / maxDuration) * 100 : 0;
                
                return (
                  <div key={index} className="flex-1 h-full flex items-end justify-center gap-0.5 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl min-w-[200px]">
                      <div className="text-xs text-zinc-400 mb-2">
                        {new Date(point.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                        })}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-400">Invocations:</span>
                          <span className="text-xs font-semibold text-zinc-200">{point.invocations}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-red-400">Errors:</span>
                          <span className="text-xs font-semibold text-zinc-200">{point.errors}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-purple-400">Avg Duration:</span>
                          <span className="text-xs font-semibold text-zinc-200">{formatDuration(point.avgDuration)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invocations bar */}
                    {invocationHeight > 0 && (
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-400 hover:to-blue-300 shadow-lg shadow-blue-500/20"
                        style={{ height: `${Math.max(invocationHeight, 2)}%` }}
                      />
                    )}
                    {/* Errors bar */}
                    {errorHeight > 0 && (
                      <div
                        className="w-full bg-gradient-to-t from-red-500 to-red-400 rounded-t transition-all hover:from-red-400 hover:to-red-300 shadow-lg shadow-red-500/20"
                        style={{ height: `${Math.max(errorHeight, 2)}%` }}
                      />
                    )}
                    {/* Duration line indicator */}
                    {durationHeight > 0 && (
                      <div
                        className="absolute w-full border-t-2 border-purple-400/80 shadow-sm"
                        style={{ bottom: `${durationHeight}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="ml-14 mr-16 flex items-center justify-between text-xs text-zinc-500">
          {displayTimeSeries.filter((_, i) => i % Math.ceil(displayTimeSeries.length / 5) === 0).map((point, index) => (
            <span key={index}>
              {new Date(point.timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          ))}
        </div>

        {/* Empty state */}
        {activeTimeSeries.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm rounded-lg">
            <div className="text-center">
              <Activity className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No activity in this time period</p>
              <p className="text-xs text-zinc-600 mt-1">Data will appear once your function is invoked</p>
            </div>
          </div>
        )}
      </Card>

      {/* Secondary Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Performance Metrics */}
        <Card className="p-5 bg-zinc-900/30 border-zinc-800">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">Performance Metrics</h4>
          </div>
          <div className="space-y-3">
            {[
              { label: "P50 (Median)", value: formatDuration(analytics.duration.p50), color: "text-emerald-400" },
              { label: "P95", value: formatDuration(analytics.duration.p95), color: "text-blue-400" },
              { label: "P99", value: formatDuration(analytics.duration.p99), color: "text-yellow-400" },
              { label: "Max", value: formatDuration(analytics.duration.max), color: "text-red-400" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50 hover:border-zinc-600 transition-colors">
                <span className="text-sm text-zinc-400 font-medium">{item.label}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
            {analytics.memory.average > 0 && (
              <>
                <div className="border-t border-zinc-800/50 my-3" />
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                  <span className="text-sm text-zinc-400 font-medium">Avg Memory</span>
                  <span className="text-sm font-semibold text-purple-400">{analytics.memory.average.toFixed(1)} MB</span>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Error Breakdown & Billing */}
      <div className="grid grid-cols-2 gap-6 border-t border-zinc-800 pt-6">
        {/* Errors */}
        {Object.keys(analytics.errorsByStatus).length > 0 && (
          <Card className="p-5 bg-zinc-900/30 border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-400" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-200">Errors by Status</h4>
            </div>
            <div className="space-y-2">
              {Object.entries(analytics.errorsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20 hover:border-red-500/30 transition-colors">
                  <span className="text-sm text-zinc-400 font-medium">Status {status}</span>
                  <span className="text-base font-bold text-red-400">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Billing */}
        <Card className="p-5 bg-zinc-900/30 border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">Billing Summary</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
              <span className="text-sm text-zinc-400 font-medium">Execution Time</span>
              <span className="text-base font-bold text-yellow-400">{analytics.execution.totalMinutes.toFixed(2)}m</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
              <span className="text-sm text-zinc-400 font-medium">Invocations</span>
              <span className="text-base font-bold text-yellow-400">{formatNumber(analytics.summary.totalInvocations)}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-3 px-1">💡 Based on execution time & invocation count</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
