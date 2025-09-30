import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET GitHub connection status
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
      select: {
        accountId: true,
        accessToken: true,
        createdAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({
        connected: false,
      });
    }

    // Fetch GitHub user info
    let githubUser = null;
    if (account.accessToken) {
      try {
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (res.ok) {
          githubUser = await res.json();
        }
      } catch (error) {
        console.error("Error fetching GitHub user:", error);
      }
    }

    return NextResponse.json({
      connected: true,
      username: githubUser?.login || account.accountId,
      avatarUrl: githubUser?.avatar_url,
      name: githubUser?.name,
      connectedAt: account.createdAt,
    });
  } catch (error) {
    console.error("Error fetching GitHub status:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub status" },
      { status: 500 }
    );
  }
}

// DELETE GitHub connection
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
    });

    return NextResponse.json({
      success: true,
      message: "GitHub account disconnected",
    });
  } catch (error) {
    console.error("Error disconnecting GitHub:", error);
    return NextResponse.json(
      { error: "Failed to disconnect GitHub" },
      { status: 500 }
    );
  }
}
