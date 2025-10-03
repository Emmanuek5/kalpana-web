import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/teams/[teamId]/members - Get team members
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

    // Check access
    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[teamId]/members - Update member role
export async function PATCH(
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
    const { userId, role } = body;

    // Check if requester is owner or admin
    const requester = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (
      !requester ||
      (requester.role !== "OWNER" && requester.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can't change owner role
    const targetMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });

    if (targetMember?.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot change owner role" },
        { status: 400 }
      );
    }

    const updated = await prisma.teamMember.updateMany({
      where: { teamId, userId },
      data: { role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[teamId]/members - Remove member
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
    const { userId } = await req.json();

    // Check if requester is owner or admin
    const requester = await prisma.teamMember.findFirst({
      where: { teamId, userId: session.user.id },
    });

    if (
      !requester ||
      (requester.role !== "OWNER" && requester.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can't remove owner
    const targetMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });

    if (targetMember?.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot remove team owner" },
        { status: 400 }
      );
    }

    await prisma.teamMember.deleteMany({
      where: { teamId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
