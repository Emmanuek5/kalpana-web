"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-900 group-[.toaster]:text-zinc-50 group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-zinc-400",
          actionButton:
            "group-[.toast]:bg-emerald-600 group-[.toast]:text-zinc-50",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-400",
          error: "group-[.toast]:bg-red-900/20 group-[.toast]:border-red-800",
          success: "group-[.toast]:bg-emerald-900/20 group-[.toast]:border-emerald-800",
          warning: "group-[.toast]:bg-yellow-900/20 group-[.toast]:border-yellow-800",
          info: "group-[.toast]:bg-blue-900/20 group-[.toast]:border-blue-800",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
