"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";
import { Badge } from "@/app/_components/ui/badge";
import { Button } from "@/app/_components/ui/button";
import { Bot, Coins, Calendar, Copy, Lock, Unlock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";

interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  pumpfun: {
    signature: string;
    metadataUri: string;
  };
}

interface BackroomCardProps {
  id: string;
  name: string;
  description: string;
  creator: string;
  agentCount: number;
  createdAt: Date;
  visibility: "public" | "private";
}

export function BackroomCard({
  id,
  name,
  description,
  creator,
  agentCount,
  createdAt,
  visibility,
}: BackroomCardProps) {
  const [copied, setCopied] = useState(false);
  const { data: tokenData } = api.backroom.getToken.useQuery<{
    data: TokenData | null;
  }>({
    backroomId: id,
  });

  const daysAgo = Math.floor(
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const timeAgo =
    daysAgo === 0
      ? "Today"
      : daysAgo === 1
        ? "Yesterday"
        : `${daysAgo} days ago`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="flex h-[320px] flex-col overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-md text-pretty">{name}</CardTitle>
          <div className="flex flex-col items-end justify-end gap-1">
            <Badge
              variant="outline"
              className="flex flex-shrink-0 items-center justify-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              <span className="">{timeAgo}</span>
            </Badge>
            {visibility === "private" && (
              <div className="flex flex-row gap-1 rounded-lg border border-[0.5px] border-gray-400 p-1">
                <span className="text-xs font-thin">Private</span>
                <Lock className="h-4 w-4" />
              </div>
            )}
            {visibility === "public" && (
              <div className="flex flex-row gap-1 rounded-lg border border-[0.5px] border-gray-400 p-1">
                <span className="text-xs font-thin">Public</span>
                <Unlock className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
        <CardDescription className="truncate text-sm">
          by {creator.slice(0, 6)}...
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[120px] flex-grow">
        <p className="mb-2 line-clamp-4 text-pretty text-sm text-muted-foreground">
          {description}
        </p>
        <div className="grid grid-cols-2 gap-x-2">
          <div className="flex flex-col items-center justify-center rounded-md bg-muted p-2">
            <Bot className="mb-1 h-4 w-4" />
            <span className="text-xs font-medium">{agentCount} Agents</span>
          </div>
          <div className="flex flex-col items-center justify-center rounded-md bg-muted p-2">
            <Coins className="mb-1 h-4 w-4" />
            {tokenData ? (
              <div className="flex flex-col items-center">
                <a
                  href={`https://pump.fun/coin/${tokenData.data?.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  View on Pump.fun
                </a>
                <button
                  onClick={() =>
                    void copyToClipboard(tokenData.data?.mint ?? "")
                  }
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "Copied!" : "Copy CA"}
                </button>
              </div>
            ) : (
              <span className="text-xs font-medium">No Token</span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="mt-auto">
        <Button variant="default" size="sm" className="w-full" asChild>
          <Link href={`/backroom/${id}`}>Enter Backroom</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
