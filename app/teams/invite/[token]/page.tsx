"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch("/api/auth/get-session");
      if (!res.ok) {
        // Not logged in, redirect to login with return URL
        router.push(`/login?redirect=/teams/invite/${token}`);
        return;
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to check session:", error);
      setError("Failed to verify session");
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch("/api/teams/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const data = await res.json();
        setTeamName(data.team.name);
        setSuccess(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Failed to accept invitation");
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setError("Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <Card className="bg-zinc-900 border-zinc-800 p-8 max-w-md w-full">
        {success ? (
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">
              Welcome to {teamName}!
            </h1>
            <p className="text-zinc-400 mb-6">
              You've successfully joined the team. Redirecting to dashboard...
            </p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">
              Invitation Error
            </h1>
            <p className="text-zinc-400 mb-6">{error}</p>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="border-zinc-800"
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">
              Team Invitation
            </h1>
            <p className="text-zinc-400 mb-6">
              You've been invited to join a team. Click below to accept the invitation.
            </p>
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                "Accept Invitation"
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
