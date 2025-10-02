"use client";

import React from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RestoreCheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messagePreview: string;
  timestamp: Date;
  isRestoring: boolean;
  error?: string | null;
}

export function RestoreCheckpointModal({
  isOpen,
  onClose,
  onConfirm,
  messagePreview,
  timestamp,
  isRestoring,
  error,
}: RestoreCheckpointModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Restore Checkpoint
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-md transition-colors"
            disabled={isRestoring}
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-zinc-300">
              You are about to restore your workspace to this checkpoint:
            </p>

            <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <div className="text-xs text-zinc-500 mb-1">
                {new Date(timestamp).toLocaleString()}
              </div>
              <div className="text-sm text-zinc-200 line-clamp-2">
                {messagePreview}
              </div>
            </div>
          </div>

          {error ? (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-500">
                    Restoration Failed
                  </p>
                  <p className="text-xs text-zinc-400">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-500">
                    Warning: This action cannot be undone
                  </p>
                  <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
                    <li>All file changes after this point will be reverted</li>
                    <li>All messages after this checkpoint will be deleted</li>
                    <li>Your current work will be lost</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/50 border-t border-zinc-800">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRestoring}
            className="border-zinc-700 hover:bg-zinc-800"
          >
            {error ? 'Close' : 'Cancel'}
          </Button>
          {!error && (
            <Button
              onClick={onConfirm}
              disabled={isRestoring}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isRestoring ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Checkpoint
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
