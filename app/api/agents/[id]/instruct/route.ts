import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST add instruction to queue
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string") {
      return NextResponse.json(
        { error: "Invalid instruction" },
        { status: 400 }
      );
    }

    // Parse existing queue or create new one
    const existingQueue = agent.instructionQueue
      ? JSON.parse(agent.instructionQueue)
      : [];

    const newQueue = [
      ...existingQueue,
      {
        id: Date.now().toString(),
        instruction,
        addedAt: new Date().toISOString(),
        status: "queued",
      },
    ];

    await prisma.agent.update({
      where: { id },
      data: {
        instructionQueue: JSON.stringify(newQueue),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Instruction added to queue",
    });
  } catch (error) {
    console.error("Error adding instruction:", error);
    return NextResponse.json(
      { error: "Failed to add instruction" },
      { status: 500 }
    );
  }
}