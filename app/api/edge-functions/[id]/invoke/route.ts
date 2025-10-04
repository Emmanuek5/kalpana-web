import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { edgeFunctionExecutor } from "@/lib/edge-functions/executor";

// POST /api/edge-functions/[id]/invoke - Test invoke edge function
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const {
      method = "GET",
      path = "/",
      headers: reqHeaders = {},
      body: reqBody,
      queryParams = {},
    } = body;

    // Execute function (test mode - doesn't record invocation)
    const result = await edgeFunctionExecutor.testExecute(id, {
      method,
      path,
      headers: reqHeaders,
      body: reqBody,
      queryParams,
    });

    return NextResponse.json({
      statusCode: result.statusCode,
      headers: result.headers,
      body: result.body,
      duration: result.duration,
      error: result.error,
      errorStack: result.errorStack,
    });
  } catch (error: any) {
    console.error("Error invoking edge function:", error);
    return NextResponse.json(
      { error: error.message || "Failed to invoke edge function" },
      { status: 500 }
    );
  }
}

// Handle all HTTP methods for actual function execution
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleFunctionExecution(request, params, "GET");
}

async function handleFunctionExecution(
  request: NextRequest,
  params: Promise<{ id: string }>,
  method: string
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);

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
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Execute function
    const result = await edgeFunctionExecutor.execute(
      id,
      {
        method,
        path: url.pathname,
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
    return new NextResponse(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
