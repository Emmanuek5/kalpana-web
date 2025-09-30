import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET user settings
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        openrouterApiKey: true,
        favoriteModels: true,
        defaultModel: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasApiKey: !!user.openrouterApiKey,
      favoriteModels: user.favoriteModels || [],
      defaultModel: user.defaultModel,
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH user settings
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { openrouterApiKey, favoriteModels, defaultModel } = body;

    // Validate favorite models (max 10)
    if (favoriteModels && favoriteModels.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 favorite models allowed" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (openrouterApiKey !== undefined) {
      updateData.openrouterApiKey = openrouterApiKey || null;
    }

    if (favoriteModels !== undefined) {
      updateData.favoriteModels = favoriteModels;
    }

    if (defaultModel !== undefined) {
      updateData.defaultModel = defaultModel || null;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        openrouterApiKey: true,
        favoriteModels: true,
        defaultModel: true,
      },
    });

    return NextResponse.json({
      hasApiKey: !!user.openrouterApiKey,
      favoriteModels: user.favoriteModels || [],
      defaultModel: user.defaultModel,
      success: true,
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
