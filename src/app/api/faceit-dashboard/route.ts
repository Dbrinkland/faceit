import { NextResponse } from "next/server";

import { buildDashboard } from "@/lib/faceit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await buildDashboard();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Der opstod en ukendt fejl under FACEIT-fetch.";

    return NextResponse.json(
      {
        message
      },
      {
        status: 500
      }
    );
  }
}
