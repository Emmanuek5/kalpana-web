import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Cache models for 1 hour
let modelsCache: any = null;
let cacheTime: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache
    const now = Date.now();
    if (modelsCache && now - cacheTime < CACHE_DURATION) {
      return NextResponse.json(modelsCache);
    }

    // Fetch from OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch models from OpenRouter");
    }

    const data = await response.json();

    // Filter and format models
    const models = data.data
      .filter((model: any) => {
        // Only include models that support chat
        return (
          model.architecture?.output_modalities?.includes("text") &&
          !model.id.includes("moderation")
        );
      })
      .map((model: any) => ({
        id: model.id,
        name: model.name,
        description: model.description,
        contextLength: model.context_length,
        pricing: {
          prompt: model.pricing.prompt,
          completion: model.pricing.completion,
        },
        supportedParameters: model.supported_parameters || [],
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    // Update cache
    modelsCache = { data: models, timestamp: now };
    cacheTime = now;

    return NextResponse.json(modelsCache);
  } catch (error) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}
