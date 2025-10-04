import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// POST /api/teams/[teamId]/invite - Send team invitation
export async function POST(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = params;
    const body = await req.json();
    const { email, role = "MEMBER" } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if requester is owner or admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMember = await prisma.teamMember.findFirst({
        where: { teamId, userId: existingUser.id },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a team member" },
          { status: 409 }
        );
      }
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.teamInvitation.findFirst({
      where: {
        teamId,
        email,
        acceptedAt: null,
        expiresAt: { gte: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "Invitation already sent" },
        { status: 409 }
      );
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        email,
        role,
        token,
        invitedBy: session.user.id,
        expiresAt,
      },
      include: {
        team: {
          select: { name: true },
        },
        inviter: {
          select: { name: true, email: true },
        },
      },
    });

    // Create notification for the invited user if they exist
    if (existingUser) {
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          type: "INFO",
          title: "Team Invitation",
          message: `${invitation.inviter.name || invitation.inviter.email} invited you to join ${invitation.team.name}`,
          actionLabel: "View Invitation",
          actionUrl: `/teams/invite/${token}`,
        },
      });
    }

    // TODO: Send invitation email here
    // await sendInvitationEmail(email, invitation);

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}

// GET /api/teams/[teamId]/invite - Get pending invitations
export async function GET(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = params;

    // Check if requester is owner or admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invitations = await prisma.teamInvitation.findMany({
      where: {
        teamId,
        acceptedAt: null,
        expiresAt: { gte: new Date() },
      },
      include: {
        inviter: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/invite - Cancel/remove a pending invitation
export async function DELETE(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = params;
    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("invitationId");

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Check if requester is owner or admin
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the invitation
    await prisma.teamInvitation.delete({
      where: {
        id: invitationId,
        teamId, // Ensure invitation belongs to this team
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invitation:", error);
    return NextResponse.json(
      { error: "Failed to delete invitation" },
      { status: 500 }
    );
  }
}
