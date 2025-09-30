"use client";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Github, Terminal, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const handleGitHubLogin = async () => {
    await signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center border border-emerald-500/20">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="text-2xl font-light tracking-tight text-zinc-100">
            Kalpana
          </span>
        </div>

        {/* Login Card */}
        <Card className="p-8 bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-light tracking-tight mb-2">
              Welcome Back
            </h1>
            <p className="text-zinc-500">
              Sign in to access your cloud development workspaces
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleGitHubLogin}
              className="w-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400 h-12 text-base group"
            >
              <Github className="mr-2 h-5 w-5" />
              Continue with GitHub
              <ArrowRight className="ml-auto h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-900/50 px-2 text-zinc-600">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-zinc-800 hover:bg-zinc-800/50 h-12 text-base"
              disabled
            >
              Email (Coming Soon)
            </Button>
          </div>

          <p className="mt-8 text-center text-sm text-zinc-600">
            By continuing, you agree to our{" "}
            <a href="#" className="text-emerald-400 hover:text-emerald-300">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-emerald-400 hover:text-emerald-300">
              Privacy Policy
            </a>
          </p>
        </Card>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
