import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/notifications - Fetch user notifications
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to 50 most recent
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

// POST /api/notifications - Create a new notification
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { type, title, message, actionLabel, actionUrl, workspaceId, agentId, deploymentId } = await req.json();

    const notification = await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: type.toUpperCase(),
        title,
        message,
        actionLabel,
        actionUrl,
        workspaceId,
        agentId,
        deploymentId,
      },
    });

    return Response.json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { notificationIds, markAll } = await req.json();

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: { read: true },
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

// DELETE /api/notifications - Delete notifications
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get("id");
    const deleteAll = searchParams.get("all") === "true";

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { userId: session.user.id },
      });
    } else if (notificationId) {
      await prisma.notification.delete({
        where: {
          id: notificationId,
          userId: session.user.id,
        },
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
