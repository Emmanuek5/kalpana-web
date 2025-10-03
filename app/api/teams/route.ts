import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/teams - Get all teams for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get teams where user is a member (includes owned teams)
    const memberTeams = await prisma.teamMember.findMany({
      where: { userId: session.user.id },
      include: {
        team: {
          include: {
            _count: {
              select: { members: true, workspaces: true, deployments: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const teams = memberTeams.map((m) => ({ ...m.team, role: m.role }));

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 }
    );
  }
}

// POST /api/teams - Create new team
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, slug } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const teamSlug =
      slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Check if slug is taken
    const existing = await prisma.team.findUnique({
      where: { slug: teamSlug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Team slug already taken" },
        { status: 409 }
      );
    }

    // Create team
    const team = await prisma.team.create({
      data: {
        name,
        description,
        slug: teamSlug,
        ownerId: session.user.id,
      },
      include: {
        _count: {
          select: { members: true, workspaces: true, deployments: true },
        },
      },
    });

    // Create owner as team member
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: session.user.id,
        role: "OWNER",
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
