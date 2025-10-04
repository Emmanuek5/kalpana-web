import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { edgeFunctionExecutor } from "@/lib/edge-functions/executor";

/**
 * Public edge function invocation endpoint
 * Handles all HTTP methods for edge functions
 */
async function handleFunctionExecution(
  request: NextRequest,
  params: Promise<{ functionId: string }>,
  method: string
) {
  try {
    const { functionId } = await params;
    const url = new URL(request.url);

    // Find function by ID
    const edgeFunction = await prisma.edgeFunction.findUnique({
      where: { id: functionId },
      include: { domain: true },
    });

    if (!edgeFunction) {
      return new NextResponse(
        JSON.stringify({ error: "Function not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if function is active
    if (edgeFunction.status !== "ACTIVE") {
      return new NextResponse(
        JSON.stringify({ error: "Function is not active" }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse query parameters
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Parse headers
    const reqHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      reqHeaders[key] = value;
    });

    // Get body if present
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.text();
      } catch (e) {
        // No body
      }
    }

    // Get client info
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Execute function
    const result = await edgeFunctionExecutor.execute(
      functionId,
      {
        method,
        path: edgeFunction.path || url.pathname,
        headers: reqHeaders,
        body,
        queryParams,
      },
      ipAddress,
      userAgent
    );

    // Return response
    return new NextResponse(result.body, {
      status: result.statusCode,
      headers: result.headers,
    });
  } catch (error: any) {
    console.error("Error executing edge function:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Export all HTTP methods
export async function GET(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "GET");
}

export async function POST(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "POST");
}

export async function PUT(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "PUT");
}

export async function PATCH(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "DELETE");
}

export async function HEAD(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "HEAD");
}

export async function OPTIONS(
  request: NextRequest,
  params: { params: Promise<{ functionId: string }> }
) {
  return handleFunctionExecution(request, params.params, "OPTIONS");
}
