"use client";

import React, { useState } from "react";
import { useTeam } from "@/lib/team-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { ChevronDown, User, Users, Plus, Check, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface TeamSwitcherProps {
  user: {
    name?: string;
    email?: string;
    image?: string;
  };
}

export function TeamSwitcher({ user }: TeamSwitcherProps) {
  const router = useRouter();
  const { currentTeam, setCurrentTeam, teams, isPersonal } = useTeam();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          description: teamDescription,
        }),
      });

      if (res.ok) {
        const newTeam = await res.json();
        setCurrentTeam(newTeam);
        setCreateDialogOpen(false);
        setTeamName("");
        setTeamDescription("");
        window.location.reload(); // Refresh to load team data
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create team");
      }
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer">
            {isPersonal ? (
              <>
                <Avatar className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  {user.image ? (
                    <img src={user.image} alt={user.name || ""} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-emerald-400" />
                  )}
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-zinc-200">
                    {user.name || "Personal"}
                  </div>
                  <div className="text-xs text-zinc-500">Personal Account</div>
                </div>
              </>
            ) : (
              <>
                <Avatar className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                  {currentTeam?.image ? (
                    <img src={currentTeam.image} alt={currentTeam.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <Users className="h-4 w-4 text-white" />
                  )}
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-zinc-200">
                    {currentTeam?.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {currentTeam?._count?.members || 0} members
                  </div>
                </div>
              </>
            )}
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-64 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent" align="start">
          {/* Personal Account */}
          <DropdownMenuItem
            onClick={() => setCurrentTeam(null)}
            className="flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 focus:bg-zinc-800/50 hover:text-emerald-500"
          >
            <Avatar className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              {user.image ? (
                <img src={user.image} alt={user.name || ""} className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-3 w-3 text-emerald-400" />
              )}
            </Avatar>
            <div className="flex-1">
              <div className="text-sm font-medium">{user.name || "Personal"}</div>
              <div className="text-xs text-zinc-500">Personal Account</div>
            </div>
            {isPersonal && <Check className="h-4 w-4 text-emerald-500" />}
          </DropdownMenuItem>

          {teams.length > 0 && <DropdownMenuSeparator />}

          {/* Teams */}
          {teams.map((team) => (
            <DropdownMenuItem
              key={team.id}
              onClick={() => setCurrentTeam(team)}
              className="flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 focus:bg-zinc-800/50 !hover:text-emerald-500"
            >
              <Avatar className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                {team.image ? (
                  <img src={team.image} alt={team.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <Users className="h-3 w-3 text-white" />
                )}
              </Avatar>
              <div className="flex-1">
                <div className="text-sm font-medium"><p className="">{team.name}</p></div>
                <div className="text-xs text-zinc-500">
                  {team._count?.members || 0} members · {team.role}
                </div>
              </div>
              {currentTeam?.id === team.id && (
                <Check className="h-4 w-4 text-emerald-500" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* Team Settings (if team selected) */}
          {currentTeam && (
            <DropdownMenuItem
              onClick={() => router.push(`/dashboard/teams/${currentTeam.id}`)}
              className="flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 focus:bg-zinc-800/50"
            >
              <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center">
                <Settings className="h-3 w-3 text-zinc-400" />
              </div>
              <span className="text-sm font-medium">Team Settings</span>
            </DropdownMenuItem>
          )}

          {/* Create Team */}
          <DropdownMenuItem
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-3 cursor-pointer text-emerald-400 hover:bg-emerald-500/10 focus:bg-emerald-500/10"
          >
            <div className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Plus className="h-3 w-3 text-emerald-400" />
            </div>
            <span className="text-sm font-medium">Create Team</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="teamName" className="text-sm text-zinc-300">
                Team Name
              </Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="My Awesome Team"
                className="mt-1.5 bg-zinc-950 border-zinc-800"
              />
            </div>
            <div>
              <Label htmlFor="teamDescription" className="text-sm text-zinc-300">
                Description (optional)
              </Label>
              <Input
                id="teamDescription"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="What's your team working on?"
                className="mt-1.5 bg-zinc-950 border-zinc-800"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleCreateTeam}
                disabled={!teamName.trim() || creating}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
              >
                {creating ? "Creating..." : "Create Team"}
              </Button>
              <Button
                onClick={() => setCreateDialogOpen(false)}
                variant="outline"
                className="border-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
