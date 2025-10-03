import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's OpenRouter API key
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { openrouterApiKey: true },
    });

    if (!user?.openrouterApiKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key configured" },
        { status: 400 }
      );
    }

    // Fetch credits from OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${user.openrouterApiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch credits" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      totalCredits: data.data.total_credits,
      totalUsage: data.data.total_usage,
      remaining: data.data.total_credits - data.data.total_usage,
    });
  } catch (error) {
    console.error("Error fetching OpenRouter credits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
