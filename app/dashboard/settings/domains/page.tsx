"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Shield,
  Globe,
  Star,
} from "lucide-react";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  isDefault: boolean;
  verificationToken?: string;
  verifiedAt?: string;
  sslEnabled: boolean;
  _count?: {
    deployments: number;
  };
  createdAt: string;
}

export default function DomainsSettingsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    try {
      const res = await fetch("/api/domains");
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
    } finally {
      setLoading(false);
    }
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;

    setAdding(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain.trim(),
          setAsDefault,
        }),
      });

      if (res.ok) {
        await fetchDomains();
        setShowAddDialog(false);
        setNewDomain("");
        setSetAsDefault(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to add domain");
      }
    } catch (error) {
      console.error("Error adding domain:", error);
      alert("Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const deleteDomain = async (domainId: string) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;

    try {
      const res = await fetch(`/api/domains/${domainId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchDomains();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete domain");
      }
    } catch (error) {
      console.error("Error deleting domain:", error);
      alert("Failed to delete domain");
    }
  };

  const setDefaultDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setAsDefault: true }),
      });

      if (res.ok) {
        await fetchDomains();
      }
    } catch (error) {
      console.error("Error setting default domain:", error);
    }
  };

  const verifyDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/domains/${domainId}/verify`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchDomains();
        alert("Domain verified successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Verification failed");
      }
    } catch (error) {
      console.error("Error verifying domain:", error);
      alert("Verification failed");
    }
  };

  const copyVerificationToken = (token: string, domain: string) => {
    navigator.clipboard.writeText(token);
    alert(
      `Verification token copied! Add this as a TXT record for ${domain}:\n\nName: _kalpana-verify\nValue: ${token}`
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-zinc-950 overflow-hidden">
        {/* Background */}
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

        <Sidebar />

        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none -z-10" />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="border-b border-zinc-800/50 flex items-center px-6 py-4 bg-zinc-950/50 backdrop-blur-sm">
          <h1 className="text-lg font-medium text-zinc-100">
            Domain Management
          </h1>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <p className="text-zinc-400">
                Manage custom domains for your deployments
              </p>
            </div>

            {/* Add Domain Button */}
            <div className="mb-6">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
                  <DialogHeader>
                    <DialogTitle>Add Domain</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                      Add a custom domain for your deployments
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Domain Name
                      </label>
                      <Input
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="example.com"
                        className="bg-zinc-900 border-zinc-800"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Enter your domain without http:// or https://
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={setAsDefault}
                        onChange={(e) => setSetAsDefault(e.target.checked)}
                        className="rounded border-zinc-700"
                      />
                      <label className="text-sm">Set as default domain</label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                      className="border-zinc-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={addDomain}
                      disabled={!newDomain.trim() || adding}
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      {adding ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Add Domain
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Domains List */}
            {domains.length === 0 ? (
              <Card className="bg-zinc-900/50 border-zinc-800 p-12">
                <div className="text-center">
                  <Globe className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                    No domains configured
                  </h3>
                  <p className="text-zinc-500 mb-6">
                    Add a domain to use custom URLs for your deployments
                  </p>
                  <Button
                    onClick={() => setShowAddDialog(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Domain
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {domains.map((domain) => (
                  <Card
                    key={domain.id}
                    className="bg-zinc-900/50 border-zinc-800 p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-zinc-100">
                            {domain.domain}
                          </h3>
                          {domain.isDefault && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              <Star className="h-3 w-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          {domain.verified ? (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not Verified
                            </Badge>
                          )}
                          {domain.sslEnabled && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                              <Shield className="h-3 w-3 mr-1" />
                              SSL
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400 space-y-1">
                          {domain._count && (
                            <p>
                              {domain._count.deployments} deployment
                              {domain._count.deployments !== 1 ? "s" : ""}
                            </p>
                          )}
                          <p>
                            Added{" "}
                            {new Date(domain.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Verification Instructions */}
                        {!domain.verified && domain.verificationToken && (
                          <div className="mt-4 p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                            <div className="flex items-start gap-2 mb-2">
                              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-zinc-100 mb-1">
                                  Verification Required
                                </p>
                                <p className="text-xs text-zinc-500 mb-3">
                                  Add this TXT record to your DNS:
                                </p>
                                <div className="bg-black rounded p-2 font-mono text-xs">
                                  <div className="text-zinc-400">
                                    Name:{" "}
                                    <span className="text-emerald-400">
                                      _kalpana-verify
                                    </span>
                                  </div>
                                  <div className="text-zinc-400 flex items-center gap-2">
                                    Value:{" "}
                                    <span className="text-emerald-400">
                                      {domain.verificationToken.substring(
                                        0,
                                        32
                                      )}
                                      ...
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        copyVerificationToken(
                                          domain.verificationToken!,
                                          domain.domain
                                        )
                                      }
                                      className="h-6 w-6 p-0"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => verifyDomain(domain.id)}
                                  className="mt-3 bg-emerald-600 hover:bg-emerald-500"
                                >
                                  Verify Domain
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {!domain.isDefault && domain.verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDefaultDomain(domain.id)}
                            className="border-zinc-800"
                          >
                            Set as Default
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteDomain(domain.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Info Section */}
            <Card className="bg-zinc-900/30 border-zinc-800 p-6 mt-8">
              <h3 className="text-lg font-semibold text-zinc-100 mb-4">
                How Domain Management Works
              </h3>
              <div className="space-y-3 text-sm text-zinc-400">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 rounded-full p-1 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-zinc-100 mb-1">Add Your Domain</p>
                    <p className="text-zinc-500">
                      Add any domain you own to use with deployments
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 rounded-full p-1 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-zinc-100 mb-1">Verify Ownership</p>
                    <p className="text-zinc-500">
                      Add the provided TXT record to your DNS to verify
                      ownership
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 rounded-full p-1 mt-0.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-zinc-100 mb-1">Use in Deployments</p>
                    <p className="text-zinc-500">
                      Select verified domains when creating deployments for
                      custom URLs
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
