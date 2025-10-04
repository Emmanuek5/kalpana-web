"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewBucketDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewBucketDialogProps) {
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    versioning: false,
    encryption: false,
    publicAccess: false,
    maxSizeGB: "",
  });

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error("Bucket name is required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          versioning: formData.versioning,
          encryption: formData.encryption,
          publicAccess: formData.publicAccess,
          maxSizeGB: formData.maxSizeGB
            ? parseInt(formData.maxSizeGB)
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create bucket");
      }

      toast.success("Bucket created successfully!");
      onOpenChange(false);
      setFormData({
        name: "",
        description: "",
        versioning: false,
        encryption: false,
        publicAccess: false,
        maxSizeGB: "",
      });
      onSuccess();
    } catch (error: any) {
      console.error("Error creating bucket:", error);
      toast.error(error.message || "Failed to create bucket");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            Create New Bucket
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a new S3-compatible object storage bucket
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="name" className="text-zinc-300">
              Bucket Name *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="my-app-assets"
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
            <p className="text-xs text-zinc-500 mt-1">
              3-63 characters, lowercase, numbers, and hyphens only
            </p>
          </div>
          <div>
            <Label htmlFor="description" className="text-zinc-300">
              Description
            </Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Static assets for my app"
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <div>
            <Label htmlFor="maxSizeGB" className="text-zinc-300">
              Max Size (GB)
            </Label>
            <Input
              id="maxSizeGB"
              type="number"
              value={formData.maxSizeGB}
              onChange={(e) =>
                setFormData({ ...formData, maxSizeGB: e.target.value })
              }
              placeholder="10"
              className="bg-zinc-800 border-zinc-700 text-zinc-100"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Leave empty for unlimited
            </p>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={formData.versioning}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    versioning: e.target.checked,
                  })
                }
                className="rounded border-zinc-700"
              />
              Enable versioning
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={formData.encryption}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    encryption: e.target.checked,
                  })
                }
                className="rounded border-zinc-700"
              />
              Enable encryption
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={formData.publicAccess}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    publicAccess: e.target.checked,
                  })
                }
                className="rounded border-zinc-700"
              />
              Allow public access
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 text-zinc-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Bucket"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
