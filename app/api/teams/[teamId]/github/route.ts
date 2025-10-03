import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";

// POST /api/teams/[teamId]/github - Connect GitHub to team
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Check if user is owner or admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user's GitHub account
    const githubAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "github",
      },
    });

    if (!githubAccount?.accessToken) {
      return NextResponse.json(
        { error: "GitHub not connected to your account" },
        { status: 400 }
      );
    }

    // Fetch GitHub username
    const githubRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${githubAccount.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!githubRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch GitHub user" },
        { status: 500 }
      );
    }

    const githubUser = await githubRes.json();

    // Update team with GitHub credentials
    await prisma.team.update({
      where: { id: teamId },
      data: {
        githubAccessToken: encrypt(githubAccount.accessToken),
        githubUsername: githubUser.login,
      },
    });

    return NextResponse.json({
      success: true,
      githubUsername: githubUser.login,
    });
  } catch (error) {
    console.error("Error connecting GitHub to team:", error);
    return NextResponse.json(
      { error: "Failed to connect GitHub" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/github - Disconnect GitHub from team
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Check if user is owner or admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        githubAccessToken: null,
        githubUsername: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting GitHub from team:", error);
    return NextResponse.json(
      { error: "Failed to disconnect GitHub" },
      { status: 500 }
    );
  }
}
