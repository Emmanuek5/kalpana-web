import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

// GET /api/edge-functions/[id]/analytics - Get function analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "7d"; // 24h, 7d, 30d, 90d

    // Verify ownership
    const func = await prisma.edgeFunction.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!func) {
      return NextResponse.json(
        { error: "Edge function not found" },
        { status: 404 }
      );
    }

    // Calculate date range
    const now = new Date();
    const periodMap: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };
    const startDate = new Date(now.getTime() - (periodMap[period] || periodMap["7d"]));

    // Get all invocations in period
    const invocations = await prisma.functionInvocation.findMany({
      where: {
        functionId: id,
        invokedAt: {
          gte: startDate,
        },
      },
      select: {
        statusCode: true,
        duration: true,
        error: true,
        invokedAt: true,
        memoryUsed: true,
        cpuTime: true,
      },
      orderBy: {
        invokedAt: "asc",
      },
    });

    // Calculate metrics
    const totalInvocations = invocations.length;
    const successfulInvocations = invocations.filter(
      (inv) => inv.statusCode >= 200 && inv.statusCode < 300 && !inv.error
    ).length;
    const errorInvocations = invocations.filter(
      (inv) => inv.statusCode >= 400 || inv.error
    ).length;

    const totalDuration = invocations.reduce((sum, inv) => sum + inv.duration, 0);
    const avgDuration = totalInvocations > 0 ? totalDuration / totalInvocations : 0;
    const maxDuration = invocations.length > 0 
      ? Math.max(...invocations.map((inv) => inv.duration))
      : 0;
    const minDuration = invocations.length > 0
      ? Math.min(...invocations.map((inv) => inv.duration))
      : 0;

    const p50Duration = calculatePercentile(
      invocations.map((inv) => inv.duration),
      50
    );
    const p95Duration = calculatePercentile(
      invocations.map((inv) => inv.duration),
      95
    );
    const p99Duration = calculatePercentile(
      invocations.map((inv) => inv.duration),
      99
    );

    // Calculate total execution time (for billing)
    const totalExecutionTime = totalDuration; // in milliseconds
    const totalExecutionSeconds = totalExecutionTime / 1000;
    const totalExecutionMinutes = totalExecutionSeconds / 60;

    // Calculate memory usage
    const memoryUsages = invocations
      .filter((inv) => inv.memoryUsed)
      .map((inv) => inv.memoryUsed!);
    const avgMemoryUsed = memoryUsages.length > 0
      ? memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length
      : 0;
    const maxMemoryUsed = memoryUsages.length > 0
      ? Math.max(...memoryUsages)
      : 0;

    // Calculate CPU time
    const cpuTimes = invocations
      .filter((inv) => inv.cpuTime)
      .map((inv) => inv.cpuTime!);
    const totalCpuTime = cpuTimes.reduce((sum, cpu) => sum + cpu, 0);
    const avgCpuTime = cpuTimes.length > 0
      ? totalCpuTime / cpuTimes.length
      : 0;

    // Group invocations by time buckets for charting
    const bucketSize = getBucketSize(period);
    const timeSeries = groupByTimeBuckets(invocations, startDate, now, bucketSize);

    // Error breakdown
    const errorsByStatus = invocations
      .filter((inv) => inv.statusCode >= 400 || inv.error)
      .reduce((acc, inv) => {
        const status = inv.statusCode.toString();
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Success rate
    const successRate = totalInvocations > 0
      ? (successfulInvocations / totalInvocations) * 100
      : 0;

    return NextResponse.json({
      period,
      startDate,
      endDate: now,
      summary: {
        totalInvocations,
        successfulInvocations,
        errorInvocations,
        successRate: Math.round(successRate * 100) / 100,
      },
      duration: {
        total: totalDuration,
        average: Math.round(avgDuration * 100) / 100,
        min: minDuration,
        max: maxDuration,
        p50: Math.round(p50Duration * 100) / 100,
        p95: Math.round(p95Duration * 100) / 100,
        p99: Math.round(p99Duration * 100) / 100,
      },
      execution: {
        totalMilliseconds: totalExecutionTime,
        totalSeconds: Math.round(totalExecutionSeconds * 100) / 100,
        totalMinutes: Math.round(totalExecutionMinutes * 100) / 100,
      },
      memory: {
        average: Math.round(avgMemoryUsed * 100) / 100,
        max: maxMemoryUsed,
      },
      cpu: {
        total: totalCpuTime,
        average: Math.round(avgCpuTime * 100) / 100,
      },
      timeSeries,
      errorsByStatus,
    });
  } catch (error: any) {
    console.error("Error getting function analytics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get analytics" },
      { status: 500 }
    );
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get bucket size based on period
 */
function getBucketSize(period: string): number {
  switch (period) {
    case "24h":
      return 60 * 60 * 1000; // 1 hour buckets
    case "7d":
      return 6 * 60 * 60 * 1000; // 6 hour buckets
    case "30d":
      return 24 * 60 * 60 * 1000; // 1 day buckets
    case "90d":
      return 24 * 60 * 60 * 1000; // 1 day buckets
    default:
      return 60 * 60 * 1000;
  }
}

/**
 * Group invocations by time buckets
 */
function groupByTimeBuckets(
  invocations: any[],
  startDate: Date,
  endDate: Date,
  bucketSize: number
): Array<{
  timestamp: string;
  invocations: number;
  errors: number;
  avgDuration: number;
}> {
  const buckets: Record<
    string,
    { invocations: number; errors: number; durations: number[] }
  > = {};

  // Initialize buckets
  let currentTime = startDate.getTime();
  while (currentTime <= endDate.getTime()) {
    const bucketKey = new Date(currentTime).toISOString();
    buckets[bucketKey] = { invocations: 0, errors: 0, durations: [] };
    currentTime += bucketSize;
  }

  // Fill buckets with data
  invocations.forEach((inv) => {
    const invTime = new Date(inv.invokedAt).getTime();
    const bucketTime =
      Math.floor((invTime - startDate.getTime()) / bucketSize) * bucketSize +
      startDate.getTime();
    const bucketKey = new Date(bucketTime).toISOString();

    if (buckets[bucketKey]) {
      buckets[bucketKey].invocations++;
      if (inv.statusCode >= 400 || inv.error) {
        buckets[bucketKey].errors++;
      }
      buckets[bucketKey].durations.push(inv.duration);
    }
  });

  // Convert to array and calculate averages
  return Object.entries(buckets).map(([timestamp, data]) => ({
    timestamp,
    invocations: data.invocations,
    errors: data.errors,
    avgDuration:
      data.durations.length > 0
        ? Math.round(
            (data.durations.reduce((sum, d) => sum + d, 0) /
              data.durations.length) *
              100
          ) / 100
        : 0,
  }));
}
