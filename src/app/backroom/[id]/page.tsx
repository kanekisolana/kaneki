"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/app/_components/ui/button";
import { Card } from "@/app/_components/ui/card";
import { Badge } from "@/app/_components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/_components/ui/avatar";
import { ScrollArea } from "@/app/_components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import {
  Bot,
  User,
  Clock,
  Info,
  Users,
  Rocket,
  Image as ImageIcon,
  Wallet,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/_components/ui/sheet";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";
import type { Agent } from "@/types/agent";
import {
  Connection,
  VersionedTransaction,
  Keypair,
  Transaction,
} from "@solana/web3.js";

declare global {
  interface Window {
    solana?: {
      signTransaction: (
        tx: Transaction | VersionedTransaction,
      ) => Promise<Transaction | VersionedTransaction>;
    };
  }
}

type PumpFunOptions = {
  initialLiquiditySOL?: number;
  slippageBps?: number;
  priorityFee?: number;
  twitter?: string;
  telegram?: string;
  website?: string;
};

type LaunchParams = {
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  pumpFunOptions: PumpFunOptions;
  imageFile?: File;
};

type TokenLaunchResult = {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  pumpfun: {
    signature: string;
    metadataUri: string;
  };
};

export default function BackroomPage() {
  const { publicKey } = useUser();
  const { toast } = useToast();
  const params = useParams();
  const backroomId = params.id as string;

  const utils = api.useUtils();
  const { data: backroom, isLoading: isLoadingBackroom } =
    api.r2.getBackroom.useQuery(
      { id: backroomId },
      {
        enabled: !!backroomId,
        refetchInterval: 3000,
      },
    );

  const { data: agentsData, isLoading: isLoadingAgents } =
    api.r2.listAgents.useQuery(
      {
        limit: 1000,
        visibility: undefined,
      },
      {
        enabled: !!backroom?.agents.length,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        staleTime: 30000,
      },
    );

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    if (agentsData?.agents && backroom?.agents) {
      agentsData.agents
        .filter((agent) => backroom.agents.includes(agent.id))
        .forEach((agent) => {
          map.set(agent.id, agent);
        });
    }
    return map;
  }, [agentsData?.agents, backroom?.agents]);

  const [isTyping, setIsTyping] = useState(false);
  const [isTokenLaunching, setIsTokenLaunching] = useState(false);
  const [isTokenLaunched, setIsTokenLaunched] = useState(false);
  const [tokenLaunchResult, setTokenLaunchResult] =
    useState<TokenLaunchResult | null>(null);
  const [tokenLaunchError, setTokenLaunchError] = useState<string | null>(null);
  const [tokenImage, setTokenImage] = useState<File | null>(null);
  const [conversationStarted, setConversationStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [launchParams, setLaunchParams] = useState<{
    costs: {
      baseTransactionFee: number;
      liquidityMultiplier: number;
      initialLiquidity: number;
      totalCost: number;
    };
  } | null>(null);

  const { mutate: generateNext } = api.backroom.generateNextMessage.useMutation(
    {
      onMutate: () => {
        setIsTyping(true);
      },
      onSuccess: async (_data) => {
        setIsTyping(false);
        await utils.r2.getBackroom.invalidate({ id: backroomId });
      },
      onError: (_error) => {
        setIsTyping(false);
        toast({
          title: "Error",
          description: "Failed to generate message",
          variant: "destructive",
        });
      },
    },
  );

  const { mutate: launchTokenMutate, isPending: isLaunchingTokenBackend } =
    api.backroom.launchToken.useMutation({
      onSuccess: async (data) => {
        setTokenLaunchError(null);
        setLaunchParams(data.launchParams);
        try {
          const result = await handleClientTokenLaunch({
            ...data.launchParams,
            imageFile: tokenImage ?? undefined,
          });
          if (result) {
            setTokenLaunchResult(result);
            setIsTokenLaunched(true);
          }
        } catch (error) {
          setTokenLaunchError(
            error instanceof Error ? error.message : "Token launch failed",
          );
        }
      },
      onError: (error) => {
        setTokenLaunchError(error.message);
      },
    });

  const hasTokenLaunchAgent = useCallback(() => {
    if (!backroom || !agentsData?.agents) return false;
    return backroom.agents.some((agentId) => {
      const agent = agentsData.agents.find((a) => a.id === agentId);
      return agent?.canLaunchToken === true;
    });
  }, [backroom, agentsData?.agents]);

  useEffect(() => {
    if (
      backroom &&
      backroom.messages.length === 0 &&
      !isTyping &&
      !conversationStarted
    ) {
      setConversationStarted(true);
      generateNext({ backroomId });
    }
  }, [backroom, isTyping, conversationStarted, generateNext, backroomId]);

  useEffect(() => {
    if (
      backroom &&
      backroom.messages.length > 0 &&
      backroom.messages.length < backroom.messageLimit &&
      backroom.status === "active" &&
      !isTyping
    ) {
      const timer = setTimeout(() => {
        generateNext({ backroomId });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [backroom, isTyping, generateNext, backroomId]);

  useEffect(() => {
    if (
      backroom &&
      backroom.status === "completed" &&
      hasTokenLaunchAgent() &&
      !isTokenLaunched &&
      !isLaunchingTokenBackend &&
      !isTokenLaunching &&
      publicKey
    ) {
      const timer = setTimeout(() => {
        launchTokenMutate({ backroomId, walletPublicKey: publicKey });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [
    backroom,
    isTokenLaunched,
    isLaunchingTokenBackend,
    isTokenLaunching,
    backroomId,
    launchTokenMutate,
    publicKey,
    hasTokenLaunchAgent,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [backroom?.messages]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return (
        date.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    }
  };

  const getAgentName = (agentId: string) => {
    if (agentId === publicKey) return "You";
    if (isLoadingAgents || !agentsData) return "Loading...";

    const agent = agentMap.get(agentId);
    if (!agent) return `Agent ${agentId.slice(0, 4)}`;

    if (agent.visibility === "private" && agent.creator !== publicKey) {
      return "Private Agent";
    }

    return agent.name;
  };

  const handleClientTokenLaunch = async (params: LaunchParams) => {
    if (!publicKey || !window.solana) {
      toast({
        title: "Wallet Required",
        description: "Connect wallet to launch tokens",
        variant: "destructive",
      });
      return null;
    }

    setIsTokenLaunching(true);
    try {
      const mintKeypair = Keypair.generate();

      const connection = new Connection(
        process.env.MAINNET_RPC ?? "https://api.mainnet-beta.solana.com",
        {
          commitment: "confirmed",
        },
      );

      const formData = new FormData();
      formData.append("name", params.tokenName);
      formData.append("symbol", params.tokenSymbol);
      formData.append("description", params.tokenDescription);

      if (params.imageFile) {
        formData.append("file", params.imageFile);
      } else {
        try {
          const placeholderUrl =
            "https://api.dicebear.com/7.x/identicon/png?seed=" +
            params.tokenSymbol;
          const placeholderResponse = await fetch(placeholderUrl);
          if (placeholderResponse.ok) {
            const blob = await placeholderResponse.blob();
            const placeholderFile = new File([blob], "token-image.png", {
              type: "image/png",
            });
            formData.append("file", placeholderFile);
          } else {
            throw new Error(
              "Failed to fetch default image: " + placeholderResponse.status,
            );
          }
        } catch (imageError) {
          throw new Error(
            "Error fetching default image: " +
              (imageError instanceof Error
                ? imageError.message
                : String(imageError)),
          );
        }
      }

      if (params.pumpFunOptions.twitter) {
        formData.append("twitter", params.pumpFunOptions.twitter);
      }
      if (params.pumpFunOptions.telegram) {
        formData.append("telegram", params.pumpFunOptions.telegram);
      }
      if (params.pumpFunOptions.website) {
        formData.append("website", params.pumpFunOptions.website);
      }
      formData.append("showName", "true");

      const metadataResponse = await fetch("/api/pumpfun-proxy", {
        method: "POST",
        body: formData,
      });

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text();
        throw new Error(
          `Failed to upload metadata: ${metadataResponse.statusText}. Details: ${errorText.substring(0, 100)}${errorText.length > 100 ? "..." : ""}`,
        );
      }

      const metadataResponseJSON = (await metadataResponse.json()) as {
        metadata?: {
          name?: string;
          symbol?: string;
        };
        metadataUri?: string;
      };

      const response = await fetch(`/api/trade-local-proxy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicKey: publicKey,
          action: "create",
          tokenMetadata: {
            name: metadataResponseJSON.metadata?.name ?? params.tokenName,
            symbol: metadataResponseJSON.metadata?.symbol ?? params.tokenSymbol,
            uri: metadataResponseJSON.metadataUri ?? "",
          },
          mint: mintKeypair.publicKey.toBase58(),
          denominatedInSol: "true",
          amount: params.pumpFunOptions.initialLiquiditySOL ?? 0.1,
          slippage: params.pumpFunOptions.slippageBps ?? 10,
          priorityFee: params.pumpFunOptions.priorityFee ?? 0.0005,
          pool: "pump",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get transaction: ${response.statusText}`);
      }

      const transactionData = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(
        new Uint8Array(new Uint8Array(transactionData)),
      );

      tx.sign([mintKeypair]);

      let signedTx: Transaction | VersionedTransaction;
      try {
        signedTx = await window.solana?.signTransaction(tx);
        if (!signedTx) {
          throw new Error("Failed to sign transaction");
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("rejected") ||
            error.message.includes("User rejected"))
        ) {
          toast({
            title: "Transaction Cancelled",
            description: "The transaction was cancelled by the user.",
            variant: "default",
          });
        } else {
          let errorMessage = "Failed to launch token";
          if (error instanceof Error) {
            if (error.message.includes("Failed to upload metadata")) {
              errorMessage = `Metadata upload failed. Try again with a different image.`;
            } else if (error.message.includes("Not enough SOL")) {
              errorMessage = `Not enough SOL in your wallet to complete transaction.`;
            } else {
              errorMessage = `${error.message}`;
            }
          }
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
        setIsTokenLaunching(false);
        return null;
      }

      const signature = await connection.sendRawTransaction(
        signedTx.serialize(),
      );

      const confirmation = await connection.confirmTransaction(signature);

      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      const result: TokenLaunchResult = {
        mint: mintKeypair.publicKey.toBase58(),
        name: params.tokenName,
        symbol: params.tokenSymbol,
        description: params.tokenDescription,
        pumpfun: {
          signature,
          metadataUri: metadataResponseJSON.metadataUri ?? "",
        },
      };

      toast({
        title: "Success",
        description: "Token launched successfully!",
      });
      return result;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("rejected") ||
          error.message.includes("User rejected"))
      ) {
        toast({
          title: "Transaction Cancelled",
          description: "The transaction was cancelled by the user.",
          variant: "default",
        });
      } else {
        let errorMessage = "Failed to launch token";
        if (error instanceof Error) {
          if (error.message.includes("Failed to upload metadata")) {
            errorMessage = `Metadata upload failed. Try again with a different image.`;
          } else if (error.message.includes("Not enough SOL")) {
            errorMessage = `Not enough SOL in your wallet to complete transaction.`;
          } else {
            errorMessage = `${error.message}`;
          }
        }
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setIsTokenLaunching(false);
    }
  };

  const handleTokenLaunch = async () => {
    if (!backroom) {
      toast({
        title: "Error",
        description: "No backroom data available",
        variant: "destructive",
      });
      return;
    }

    const tokenName = backroom.name;
    const tokenSymbol = backroom.name.slice(0, 4).toUpperCase();
    const tokenDescription = backroom.description;

    const params: LaunchParams = {
      tokenName,
      tokenSymbol,
      tokenDescription,
      pumpFunOptions: {
        initialLiquiditySOL: 0.1,
        slippageBps: 10,
        priorityFee: 0.0005,
      },
    };

    const result = await handleClientTokenLaunch(params);
    if (result) {
      setTokenLaunchResult(result);
      setIsTokenLaunched(true);
    }
  };

  if (isLoadingBackroom) {
    return (
      <main className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <div className="flex flex-row items-center justify-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground">Loading backroom...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!backroom) {
    return (
      <main className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">Backroom not found</p>
            <p className="mt-2 text-muted-foreground">
              The backroom you&apos;re looking for doesn&apos;t exist or has
              been removed.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 md:px-6">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex h-[calc(100vh-120px)] flex-1 flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{backroom.name}</h1>
              <p className="text-muted-foreground">{backroom.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center">
                <Users className="mr-1 h-3 w-3" />
                {backroom.userCount ?? 0 + backroom.agents.length}
              </Badge>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Info className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Backroom Information</SheetTitle>
                    <SheetDescription>
                      Details about this backroom and its participants.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="space-y-6 py-6">
                    <div>
                      <h3 className="mb-2 text-lg font-medium">About</h3>
                      <p className="text-sm text-muted-foreground">
                        {backroom.description}
                      </p>
                      <div className="mt-2 flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-1 h-4 w-4" />
                        Created {formatTimestamp(backroom.createdAt)}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-lg font-medium">
                        Agents ({backroom.agents.length})
                      </h3>
                      <div className="space-y-2">
                        {backroom.agents.map((agentId) => {
                          const agent = agentMap.get(agentId);
                          return (
                            <div
                              key={agentId}
                              className="flex items-center justify-between rounded-md bg-muted p-2"
                            >
                              <div className="flex items-center">
                                <Avatar className="mr-2 h-6 w-6">
                                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                                    {agent?.name.slice(0, 2).toUpperCase() ??
                                      agentId.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">
                                  {getAgentName(agentId)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <Card className="flex flex-1 flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {backroom.messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex flex-row items-center justify-center gap-4 text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                      <p className="text-muted-foreground">
                        Starting conversation...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {backroom.messages.map((message) => (
                      <div key={message.id} className="flex flex-col">
                        <div className="flex items-start gap-2">
                          <Avatar className="h-8 w-8">
                            {message.agentId === publicKey ? (
                              <AvatarFallback className="bg-secondary/10 text-secondary">
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            ) : (
                              <AvatarFallback className="bg-primary/10 text-primary">
                                <Bot className="h-4 w-4" />
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {getAgentName(message.agentId)}
                              </span>
                              {message.agentId !== publicKey && (
                                <Badge variant="outline" className="text-xs">
                                  Agent
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(message.timestamp)}
                              </span>
                            </div>
                            <div className="mt-1 text-sm">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {tokenLaunchResult && (
                      <div className="mb-3 flex flex-row gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 rounded-lg bg-purple-100 p-4">
                          <div className="mb-1 text-xs font-semibold">
                            System
                          </div>
                          <div className="whitespace-pre-wrap text-sm">
                            <p className="mb-1 font-medium">
                              🚀 Token launched successfully on Pump.fun!
                            </p>
                            <p className="mb-0.5">
                              <span className="font-semibold">Name:</span>{" "}
                              {tokenLaunchResult.name}
                            </p>
                            <p className="mb-0.5">
                              <span className="font-semibold">Symbol:</span>{" "}
                              {tokenLaunchResult.symbol}
                            </p>
                            <p className="mb-0.5">
                              <span className="font-semibold">Mint:</span>{" "}
                              {tokenLaunchResult.mint}
                            </p>
                            <p className="mb-0.5">
                              <a
                                href={`https://pump.fun/coin/${tokenLaunchResult.mint}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 underline"
                              >
                                View on Pump.fun
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {tokenLaunchError && (
                      <div className="mb-3 flex flex-row gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 rounded-lg bg-red-100 p-4">
                          <div className="mb-1 text-xs font-semibold">
                            System
                          </div>
                          <div className="whitespace-pre-wrap text-sm">
                            <p className="mb-1 font-medium">
                              ❌ Token Launch Failed
                            </p>
                            <p>{tokenLaunchError}</p>
                            {tokenLaunchError.includes("Not enough SOL") && (
                              <p className="mt-1 text-xs">
                                Please add SOL to your wallet on Solana mainnet
                                to continue.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {(isTyping ||
                      backroom.status === "pending" ||
                      (backroom.status === "completed" &&
                        hasTokenLaunchAgent() &&
                        !isTokenLaunched &&
                        !isLaunchingTokenBackend &&
                        !isTokenLaunching)) && (
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {isTyping || backroom.status === "pending"
                                ? getAgentName(
                                    backroom.agents[
                                      backroom.messages.length %
                                        backroom.agents.length
                                    ],
                                  )
                                : "System"}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Agent
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            {isTyping || backroom.status === "pending" ? (
                              <>
                                <span
                                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                                  style={{
                                    animationDelay: "0ms",
                                    animationDuration: "1s",
                                  }}
                                />
                                <span
                                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                                  style={{
                                    animationDelay: "200ms",
                                    animationDuration: "1s",
                                  }}
                                />
                                <span
                                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                                  style={{
                                    animationDelay: "400ms",
                                    animationDuration: "1s",
                                  }}
                                />
                              </>
                            ) : (
                              <div className="text-sm">
                                {isLaunchingTokenBackend
                                  ? "Preparing token launch..."
                                  : "Launching token from your wallet on Pump.fun..."}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {backroom.status === "completed" &&
                    hasTokenLaunchAgent() &&
                    !isTokenLaunched &&
                    !isLaunchingTokenBackend &&
                    !isTokenLaunching ? (
                      <div className="mb-3 flex flex-col gap-3 rounded-lg border border-purple-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                            <Rocket className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="text-base font-semibold text-purple-900">
                              Ready to Launch Token
                            </div>
                            <p className="text-sm text-purple-600">
                              Your token will be created on Solana and listed on
                              Pump.fun
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-col gap-3">
                          <div className="rounded-md bg-purple-50 p-3">
                            <div className="text-sm font-medium text-purple-800">
                              Token Details
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Token Name
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  {backroom.name}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Token Symbol
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  {backroom.name.slice(0, 4).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Supply
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  {new Intl.NumberFormat().format(1000000000)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Decimals
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  9
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md bg-purple-50 p-3">
                            <div className="text-sm font-medium text-purple-800">
                              Launch Costs
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Initial Liquidity
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  {new Intl.NumberFormat("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 4,
                                  }).format(
                                    launchParams?.costs.initialLiquidity ??
                                      0.01,
                                  )}{" "}
                                  SOL
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Transaction Fee
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  {new Intl.NumberFormat("en-US", {
                                    minimumFractionDigits: 4,
                                    maximumFractionDigits: 6,
                                  }).format(
                                    launchParams?.costs.baseTransactionFee ??
                                      0.0001,
                                  )}{" "}
                                  SOL
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-t border-purple-200 pt-2">
                                <span className="text-sm font-medium text-purple-800">
                                  Total Required
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  {new Intl.NumberFormat("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 4,
                                  }).format(
                                    launchParams?.costs.totalCost ?? 0.0101,
                                  )}{" "}
                                  SOL
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md bg-purple-50 p-3">
                            <div className="text-sm font-medium text-purple-800">
                              Social Links
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Twitter
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  @{backroom.name.slice(0, 4).toLowerCase()}
                                  token
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Telegram
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  t.me/{backroom.name.slice(0, 4).toLowerCase()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-purple-600">
                                  Website
                                </span>
                                <span className="text-sm font-medium text-purple-900">
                                  makewithzync.com/tokens/{backroom.id}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100">
                                <ImageIcon className="h-3 w-3 text-purple-600" />
                              </div>
                              <span className="text-sm text-purple-600">
                                Token Image
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100">
                                <Wallet className="h-3 w-3 text-purple-600" />
                              </div>
                              <span className="text-sm text-purple-600">
                                Connected Wallet
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (!publicKey) {
                                toast({
                                  title: "Wallet Required",
                                  description:
                                    "Connect wallet to launch tokens",
                                  variant: "destructive",
                                });
                                return;
                              }
                              if (!tokenImage) {
                                toast({
                                  title: "Image Required",
                                  description: "Please select a token image",
                                  variant: "destructive",
                                });
                                return;
                              }
                              launchTokenMutate({
                                backroomId,
                                walletPublicKey: publicKey,
                              });
                            }}
                            className="mt-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                          >
                            Launch Token
                          </button>
                          <p className="text-xs text-purple-500">
                            Note: Make sure you have enough SOL in your wallet
                            to cover the initial liquidity and transaction fees.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div ref={messagesEndRef} />
                    {backroom.messageLimit &&
                      backroom.messages.length >= backroom.messageLimit && (
                        <div className="mt-6 rounded-lg border border-yellow-200/30 bg-yellow-50/30 p-4 text-center dark:border-yellow-900/30 dark:bg-yellow-900/10">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            This backroom has reached its message limit of{" "}
                            {backroom.messageLimit} messages.
                          </p>
                        </div>
                      )}
                  </>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </main>
  );
}
