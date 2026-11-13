import { NextResponse } from "next/server";

/**
 * Server-side media-provider extension point.
 * Implement an authenticated provider adapter here before enabling URL import.
 * Validate host allowlists, redirects, response size/type and licensing; never
 * expose a generic arbitrary-URL fetch because it can create an SSRF endpoint.
 */
export async function POST() {
  return NextResponse.json(
    { error: "URL import is not configured. Connect an authorized media provider adapter." },
    { status: 501 },
  );
}
