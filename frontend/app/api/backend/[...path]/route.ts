import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

function backendBaseUrl() {
  return (
    process.env.FASTAPI_BASE_URL ||
    process.env.NEXT_PUBLIC_FASTAPI_BASE_URL ||
    DEFAULT_BACKEND_URL
  ).replace(/\/$/, "");
}

async function proxyToFastApi(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetPath = path.map(encodeURIComponent).join("/");
  const targetUrl = `${backendBaseUrl()}/${targetPath}${incomingUrl.search}`;

  const headers = new Headers();
  headers.set("accept", request.headers.get("accept") ?? "application/json");

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text();

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store"
    });

    const responseHeaders = new Headers();
    responseHeaders.set(
      "content-type",
      response.headers.get("content-type") ?? "application/json"
    );
    responseHeaders.set("cache-control", "no-store");

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach FastAPI";

    return NextResponse.json(
      {
        error: "FastAPI proxy request failed",
        detail: message,
        target: targetUrl
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToFastApi(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToFastApi(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToFastApi(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToFastApi(request, context);
}
