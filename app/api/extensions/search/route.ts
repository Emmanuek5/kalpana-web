import { NextRequest, NextResponse } from "next/server";

// GET /api/extensions/search?q=<query>&size=<n>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();
    const sizeParam = parseInt(searchParams.get("size") || "20", 10);
    const size = Math.max(1, Math.min(50, isNaN(sizeParam) ? 20 : sizeParam));

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // VS Marketplace API endpoint
    const url =
      "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

    const body = {
      filters: [
        {
          criteria: [
            { filterType: 8, value: "Microsoft.VisualStudio.Code" },
            { filterType: 10, value: query },
          ],
          pageSize: size,
          pageNumber: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      flags: 914,
    };

    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json;api-version=3.0-preview.1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream search failed", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Parse VS Marketplace response format
    const extensions = data.results?.[0]?.extensions || [];

    const results = extensions.map((item: any) => {
      const publisher = item.publisher?.publisherName || "";
      const name = item.extensionName || "";
      const extensionId = publisher && name ? `${publisher}.${name}` : name;

      const stats = item.statistics || [];
      const downloads =
        stats.find((s: any) => s.statisticName === "install")?.value || 0;
      const rating =
        stats.find((s: any) => s.statisticName === "averagerating")?.value ||
        null;

      return {
        id: extensionId,
        name: item.displayName || name || extensionId,
        namespace: publisher,
        extensionName: name,
        description: item.shortDescription || "",
        version: item.versions?.[0]?.version || "",
        averageRating: rating ? parseFloat(rating) : null,
        downloadCount: downloads ? parseInt(downloads, 10) : null,
        repository: null, // Would need to parse from properties
        homepage: null,
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    const isAbort =
      typeof error === "object" &&
      error &&
      (error as any).name === "AbortError";
    return NextResponse.json(
      {
        error: isAbort ? "Timeout contacting VS Marketplace" : "Search failed",
      },
      { status: 504 }
    );
  }
}
