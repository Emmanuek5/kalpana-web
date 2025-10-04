"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  verificationToken?: string;
  sslEnabled: boolean;
  createdAt: string;
}

interface DomainManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDomainAdded?: () => void;
}

export function DomainManagerDialog({
  open,
  onOpenChange,
  onDomainAdded,
}: DomainManagerDialogProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      loadDomains();
    }
  }, [open]);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/domains");
      if (!response.ok) throw new Error("Failed to load domains");
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (error) {
      console.error("Error loading domains:", error);
      toast.error("Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain name");
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.trim())) {
      toast.error("Please enter a valid domain name");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add domain");
      }

      toast.success("Domain added successfully!");
      setNewDomain("");
      loadDomains();
      onDomainAdded?.();
    } catch (error: any) {
      console.error("Error adding domain:", error);
      toast.error(error.message || "Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteDomain = async (id: string, domain: string) => {
    if (!confirm(`Are you sure you want to delete "${domain}"?`)) return;

    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/domains/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete domain");
      }

      toast.success("Domain deleted successfully");
      loadDomains();
      onDomainAdded?.();
    } catch (error: any) {
      console.error("Error deleting domain:", error);
      toast.error(error.message || "Failed to delete domain");
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleVerifyDomain = async (id: string, domain: string) => {
    setVerifying((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/domains/${id}/verify`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify domain");
      }

      const data = await response.json();
      if (data.verified) {
        toast.success("Domain verified successfully!");
      } else {
        toast.error("Domain verification failed. Please check your DNS records.");
      }
      loadDomains();
      onDomainAdded?.();
    } catch (error: any) {
      console.error("Error verifying domain:", error);
      toast.error(error.message || "Failed to verify domain");
    } finally {
      setVerifying((prev) => ({ ...prev, [id]: false }));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5 text-emerald-400" />
            Domain Management
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Add and manage custom domains for your edge functions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Add New Domain */}
          <Card className="p-4 bg-zinc-800/50 border-zinc-700">
            <Label className="text-zinc-300 mb-2 block">Add New Domain</Label>
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="bg-zinc-900 border-zinc-700 text-zinc-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddDomain();
                }}
              />
              <Button
                onClick={handleAddDomain}
                disabled={adding || !newDomain.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Domains List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Your Domains</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-zinc-600 animate-spin" />
              </div>
            ) : domains.length === 0 ? (
              <Card className="p-8 bg-zinc-800/30 border-zinc-700/50 text-center">
                <Globe className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No domains added yet</p>
              </Card>
            ) : (
              domains.map((domain) => (
                <Card
                  key={domain.id}
                  className="p-4 bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-base font-medium text-zinc-100">
                          {domain.domain}
                        </h4>
                        {domain.verified ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        {domain.sslEnabled && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                            SSL
                          </Badge>
                        )}
                      </div>

                      {!domain.verified && domain.verificationToken && (
                        <div className="mt-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700">
                          <p className="text-xs text-zinc-400 mb-2">
                            Add this TXT record to your DNS:
                          </p>
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-xs text-emerald-400 bg-zinc-950 px-2 py-1 rounded flex-1">
                              _kalpana-verify.{domain.domain}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(
                                  `_kalpana-verify.${domain.domain}`,
                                  "Record name"
                                )
                              }
                              className="h-7 w-7 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-emerald-400 bg-zinc-950 px-2 py-1 rounded flex-1 truncate">
                              {domain.verificationToken}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(
                                  domain.verificationToken!,
                                  "Verification token"
                                )
                              }
                              className="h-7 w-7 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
                        <span>
                          Added {new Date(domain.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {!domain.verified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerifyDomain(domain.id, domain.domain)}
                          disabled={verifying[domain.id]}
                          className="border-zinc-700 text-zinc-300"
                        >
                          {verifying[domain.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Verify
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDomain(domain.id, domain.domain)}
                        disabled={deleting[domain.id]}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        {deleting[domain.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Help Section */}
          <Card className="p-4 bg-blue-500/5 border-blue-500/20">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-zinc-300 space-y-2">
                <p className="font-medium text-blue-400">How to verify your domain:</p>
                <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                  <li>Add the TXT record to your domain's DNS settings</li>
                  <li>Wait a few minutes for DNS propagation</li>
                  <li>Click the "Verify" button to check verification status</li>
                  <li>Once verified, you can use the domain with your edge functions</li>
                </ol>
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
