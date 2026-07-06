import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

function getBackendBaseUrl() {
  return (
    process.env.FASTAPI_BASE_URL ||
    process.env.NEXT_PUBLIC_FASTAPI_BASE_URL ||
    DEFAULT_BACKEND_URL
  );
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const baseUrl = getBackendBaseUrl();
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const target = new URL(path.join("/"), normalizedBase);
  target.search = request.nextUrl.search;

  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text();

    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        accept: request.headers.get("accept") || "application/json",
        ...(body
          ? {
              "content-type":
                request.headers.get("content-type") || "application/json"
            }
          : {})
      },
      body,
      cache: "no-store"
    });

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");

    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to reach FastAPI backend",
        detail: error instanceof Error ? error.message : String(error),
        backend: baseUrl
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
