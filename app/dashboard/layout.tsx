"use client";

import { TeamProvider } from "@/lib/team-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeamProvider>{children}</TeamProvider>;
}
