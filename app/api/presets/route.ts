import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/presets - Get all presets for current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const presets = await prisma.preset.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(presets);
  } catch (error) {
    console.error("Error fetching presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch presets" },
      { status: 500 }
    );
  }
}

// POST /api/presets - Create new preset
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, settings, extensions } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Preset name is required" },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: "Settings are required" },
        { status: 400 }
      );
    }

    // Validate settings is valid JSON
    try {
      JSON.parse(settings);
    } catch (e) {
      return NextResponse.json(
        { error: "Settings must be valid JSON" },
        { status: 400 }
      );
    }

    // Check preset limit (max 10 per user)
    const presetCount = await prisma.preset.count({
      where: { userId: session.user.id },
    });

    if (presetCount >= 10) {
      return NextResponse.json(
        { error: "Maximum 10 presets allowed" },
        { status: 403 }
      );
    }

    const preset = await prisma.preset.create({
      data: {
        name,
        description,
        settings,
        extensions: extensions || [],
        userId: session.user.id,
      },
    });

    return NextResponse.json(preset, { status: 201 });
  } catch (error) {
    console.error("Error creating preset:", error);
    return NextResponse.json(
      { error: "Failed to create preset" },
      { status: 500 }
    );
  }
}
