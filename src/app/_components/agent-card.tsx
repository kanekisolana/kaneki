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
import { Heart, Lock, Unlock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { api } from "@/trpc/react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface AgentCardProps {
  id: string;
  name: string;
  description: string;
  creator: string;
  likes: number;
  fee: number;
  isPublic: boolean;
  interactions?: number;
}

export function AgentCard({
  id,
  name,
  description,
  creator,
  likes: initialLikes,
  fee,
  isPublic,
}: AgentCardProps) {
  const { publicKey } = useUser();
  const { toast } = useToast();
  const utils = api.useUtils();
  const [localLikes, setLocalLikes] = useState(initialLikes);

  const { data: likeStatus } = api.r2.checkAgentLike.useQuery(
    { agentId: id, userId: publicKey ?? "" },
    { enabled: !!publicKey },
  );

  const [isLiked, setIsLiked] = useState(false);
  useEffect(() => {
    if (likeStatus) {
      setIsLiked(likeStatus.liked);
      setLocalLikes(likeStatus.likeCount);
    }
  }, [likeStatus]);

  const toggleLike = api.r2.toggleAgentLike.useMutation({
    onMutate: () => {
      void setLocalLikes((prev) => prev + (isLiked ? -1 : 1));
      setIsLiked(!isLiked);
    },
    onSuccess: ({ liked, likeCount }) => {
      setLocalLikes(likeCount);
      setIsLiked(liked);
      void utils.r2.listAgents.invalidate();
    },
    onError: (error) => {
      setLocalLikes(initialLikes);
      setIsLiked(!isLiked);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLikeClick = () => {
    if (!publicKey) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to like agents",
        variant: "destructive",
      });
      return;
    }

    toggleLike.mutate({ agentId: id, userId: publicKey });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center justify-between gap-2">
              {name}
              {!isPublic && (
                <div className="flex flex-row gap-1 rounded-lg border border-[0.5px] border-gray-400 p-1">
                  <span className="text-xs font-thin">Private</span>
                  <Lock className="h-4 w-4" />
                </div>
              )}
              {isPublic && (
                <div className="flex flex-row gap-1 rounded-lg border border-[0.5px] border-gray-400 p-1">
                  <span className="text-xs font-thin">Public</span>
                  <Unlock className="h-4 w-4" />
                </div>
              )}
            </CardTitle>
            <CardDescription className="line-clamp-5">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 px-2"
            onClick={handleLikeClick}
            disabled={toggleLike.isPending}
          >
            <Heart
              className={`h-3 w-3 ${toggleLike.isPending ? "animate-pulse" : ""} ${
                isLiked ? "fill-current" : ""
              }`}
            />
            {localLikes}
          </Button>
          {fee > 0 && (
            <Badge variant="default" className="flex items-center gap-1">
              {fee} ZYNC
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between">
          <div className="text-sm text-muted-foreground">
            by {creator.slice(0, 5)}...{creator.slice(-3)}
          </div>
          <Link href={`/agent/${id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
