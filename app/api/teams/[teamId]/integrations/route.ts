import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";

// GET /api/teams/[teamId]/integrations - Get team integrations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // Check if user is a member
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        githubUsername: true,
        githubAccessToken: true,
        openrouterApiKey: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Return status without exposing actual keys
    return NextResponse.json({
      githubConnected: !!team.githubAccessToken,
      githubUsername: team.githubUsername,
      openrouterConfigured: !!team.openrouterApiKey,
    });
  } catch (error) {
    console.error("Error fetching team integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/integrations - Update team integrations
export async function PATCH(
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

    const body = await req.json();
    const { openrouterApiKey } = body;

    const updateData: any = {};

    if (openrouterApiKey !== undefined) {
      // Encrypt the API key before storing
      updateData.openrouterApiKey = openrouterApiKey
        ? encrypt(openrouterApiKey)
        : null;
    }

    await prisma.team.update({
      where: { id: teamId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating team integrations:", error);
    return NextResponse.json(
      { error: "Failed to update integrations" },
      { status: 500 }
    );
  }
}
