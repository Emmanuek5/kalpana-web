"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  role?: string;
  _count?: {
    members: number;
    workspaces: number;
    deployments: number;
  };
}

interface TeamContextType {
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  teams: Team[];
  isPersonal: boolean;
  loading: boolean;
  refreshTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [currentTeam, setCurrentTeamState] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Load teams from API
  const refreshTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Failed to load teams:", error);
    }
  };

  // Load teams on mount
  useEffect(() => {
    refreshTeams().finally(() => setLoading(false));
  }, []);

  // Load saved team selection from localStorage
  useEffect(() => {
    if (teams.length > 0) {
      const savedTeamId = localStorage.getItem("currentTeamId");
      if (savedTeamId && savedTeamId !== "personal") {
        const team = teams.find((t) => t.id === savedTeamId);
        if (team) {
          setCurrentTeamState(team);
        }
      }
    }
  }, [teams]);

  // Save team selection to localStorage
  const setCurrentTeam = (team: Team | null) => {
    setCurrentTeamState(team);
    localStorage.setItem("currentTeamId", team?.id || "personal");
  };

  const isPersonal = currentTeam === null;

  return (
    <TeamContext.Provider
      value={{
        currentTeam,
        setCurrentTeam,
        teams,
        isPersonal,
        loading,
        refreshTeams,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
