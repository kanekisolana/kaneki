import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";

const PUMPFUN_API_KEY = env.PUMPFUN_API_KEY;

interface TradeLocalBody {
  action: string;
  publicKey: string;
  mint?: string;
  tokenMetadata?: {
    name: string;
    symbol: string;
    uri: string;
  };
  [key: string]: unknown;
}

interface ErrorResponse {
  error: string | Record<string, unknown>;
  statusText?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TradeLocalBody;

    try {
      const response = await fetch("https://pumpportal.fun/api/trade-local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": PUMPFUN_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        try {
          const errorText = await response.text();

          try {
            const errorJson = JSON.parse(errorText) as Record<string, unknown>;
            return NextResponse.json(
              {
                error: errorJson,
                statusText: response.statusText,
              } as ErrorResponse,
              { status: response.status },
            );
          } catch {
            return NextResponse.json(
              {
                error: errorText,
                statusText: response.statusText,
              } as ErrorResponse,
              { status: response.status },
            );
          }
        } catch {
          return NextResponse.json(
            {
              error: `Pump.fun API error: ${response.status} ${response.statusText}`,
            } as ErrorResponse,
            { status: response.status },
          );
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
    } catch (fetchError) {
      return NextResponse.json(
        {
          error:
            fetchError instanceof Error
              ? fetchError.message
              : "Unknown fetch error",
        } as ErrorResponse,
        { status: 500 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      } as ErrorResponse,
      { status: 500 },
    );
  }
}
