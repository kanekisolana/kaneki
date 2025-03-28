"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/app/_components/ui/button";
import { Card } from "@/app/_components/ui/card";
import { Badge } from "@/app/_components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/_components/ui/avatar";
import { ScrollArea } from "@/app/_components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { Bot, User, Clock, Info, Moon } from "lucide-react";
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
import type { AgentMessage } from "@/types/agent";

const TypingIndicator = () => (
  <div className="flex flex-col">
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex space-x-2">
        <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/25"></div>
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/25"
          style={{ animationDelay: "0.2s" }}
        ></div>
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/25"
          style={{ animationDelay: "0.4s" }}
        ></div>
      </div>
    </div>
  </div>
);

export default function AgentPage() {
  const { publicKey } = useUser();
  const { toast } = useToast();
  const params = useParams();
  const agentId = params.id as string;

  const utils = api.useUtils();
  const { data: agent, isLoading: isLoadingAgent } = api.r2.getAgent.useQuery(
    { id: agentId },
    { enabled: !!agentId },
  );

  const { data: profile } = api.profile.get.useQuery(undefined, {
    enabled: !!publicKey,
  });

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const { data: chatHistory, isLoading: isLoadingHistory } =
    api.ai.getAgentChatHistory.useQuery(
      { agentId, userId: publicKey ?? "", limit: 50 },
      {
        enabled: !!agentId && !!publicKey,
        refetchOnWindowFocus: false,
      },
    );

  useEffect(() => {
    if (chatHistory?.messages) {
      const parsedMessages = chatHistory.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        messageType:
          msg.userId === publicKey ? ("user" as const) : ("agent" as const),
      }));

      setMessages(parsedMessages);
    }
  }, [chatHistory?.messages, publicKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (date: Date | string) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffInHours = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return dateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return (
        dateObj.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " " +
        dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    }
  };

  const { mutateAsync } = api.ai.sendMessage.useMutation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input || !publicKey || !agentId) return;

    const conversationId = Math.random().toString(36).slice(2, 8);
    const userMessage: AgentMessage = {
      content: input,
      response: "",
      timestamp: new Date(),
      agentId,
      userId: publicKey,
      conversationId,
      messageType: "user",
      sequence: messages.length + 1,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setIsTyping(true);

    try {
      const result = await mutateAsync({
        agentId,
        userId: publicKey,
        content: userMessage.content,
      });

      if (result.success) {
        const agentMessage: AgentMessage = {
          content: result.message.content,
          response: "",
          timestamp: new Date(),
          agentId,
          userId: undefined,
          conversationId,
          messageType: "agent",
          sequence: messages.length + 2,
        };

        setMessages((prev) => [...prev, agentMessage]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  if (isLoadingAgent) {
    return (
      <main className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <div className="flex flex-row items-center justify-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground">Loading agent...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!publicKey) {
    return (
      <main className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">Please connect your wallet</p>
            <p className="mt-2 text-muted-foreground">
              You need to connect your wallet to chat with this agent.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="container mx-auto px-4 py-6 md:px-6">
        <div className="flex h-[calc(100vh-120px)] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium">Agent not found</p>
            <p className="mt-2 text-muted-foreground">
              The agent you&apos;re looking for doesn&apos;t exist or has been
              removed.
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
          <div className="mb-4 flex flex-col items-center justify-between sm:flex-row">
            <div>
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <p className="text-muted-foreground">{agent.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center p-2">
                <Bot className="mr-1 h-3 w-3" />
                <span className="text-nowrap">{agent.type}</span>
              </Badge>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Info className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Agent Information</SheetTitle>
                    <SheetDescription>
                      Details about this agent and its capabilities.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="space-y-6 py-6">
                    <div>
                      <h3 className="mb-2 text-lg font-medium">About</h3>
                      <p className="text-sm text-muted-foreground">
                        {agent.description}
                      </p>
                      <div className="mt-2 flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-1 h-4 w-4" />
                        Created {formatTimestamp(agent.createdAt)}
                      </div>
                    </div>

                    {agent.personality && (
                      <div>
                        <h3 className="mb-2 text-lg font-medium">
                          Personality
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.personality}
                        </p>
                      </div>
                    )}

                    {agent.expertise && (
                      <div>
                        <h3 className="mb-2 text-lg font-medium">Expertise</h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.expertise}
                        </p>
                      </div>
                    )}

                    {agent.coreBeliefs && (
                      <div>
                        <h3 className="mb-2 text-lg font-medium">
                          Core Beliefs
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.coreBeliefs}
                        </p>
                      </div>
                    )}

                    {agent.quirks && (
                      <div>
                        <h3 className="mb-2 text-lg font-medium">Quirks</h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.quirks}
                        </p>
                      </div>
                    )}

                    {agent.communicationStyle && (
                      <div>
                        <h3 className="mb-2 text-lg font-medium">
                          Communication Style
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {agent.communicationStyle}
                        </p>
                      </div>
                    )}

                    {agent.traits && agent.traits.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-lg font-medium">Traits</h3>
                        <div className="flex flex-wrap gap-2">
                          {agent.traits.map((trait) => (
                            <Badge key={trait} variant="secondary">
                              {trait}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <Card className="flex flex-1 flex-col">
            <ScrollArea className="flex-1 p-4">
              {isLoadingHistory ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-row items-center gap-4 text-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-muted-foreground">
                      Loading conversation history...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.length === 0 && !isTyping && (
                    <div className="flex flex-row items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                      <Moon className="h-8 w-8 animate-pulse" />
                      <p className="text-lg">
                        Looks silent here, this could be the beginning of a
                        really deep conversation!
                      </p>
                    </div>
                  )}
                  {messages.map((message, index) => (
                    <div
                      key={`${index}-${message.timestamp.getTime()}`}
                      className="flex flex-col"
                    >
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8">
                          {message.messageType === "user" ? (
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
                              {message.messageType === "user"
                                ? (profile?.username ?? "You")
                                : agent.name}
                            </span>
                            {message.messageType === "agent" && (
                              <Badge variant="outline" className="text-xs">
                                Agent
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(message.timestamp)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm">{message.content}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isTyping && <TypingIndicator />}
                </div>
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>
            <form onSubmit={handleSubmit} className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    isLoadingHistory
                      ? "Loading conversation history..."
                      : "Type your message..."
                  }
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isTyping || isLoadingHistory}
                />
                <Button
                  type="submit"
                  disabled={isTyping || !input.trim() || isLoadingHistory}
                >
                  Send
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
