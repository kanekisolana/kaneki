"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AgentCard } from "./agent-card";
import { BackroomCard } from "./backroom-card";
import { AgentFilters } from "./agent-filter";
import { BackroomFilters } from "./backroom-filters";
import { WalletButton } from "./wallet-button";
import { HeroSection } from "./hero-section";
import { api } from "@/trpc/react";
import { NoResults } from "./no-results";
import { AgentCardSkeleton, BackroomCardSkeleton } from "./skeletons";
import { useUser } from "@/hooks/use-user";
import { User } from "lucide-react";
import Link from "next/link";

export function HomeContent() {
  const { publicKey } = useUser();
  const { data: profile } = api.profile.get.useQuery(undefined, {
    enabled: !!publicKey,
  });

  const [agentFilters, setAgentFilters] = useState<{
    search: string;
    sortBy: "newest" | "oldest" | "priceHigh" | "priceLow" | "popular";
    minPrice: number;
    maxPrice: number;
    visibility?: "public" | "private" | undefined;
  }>({
    search: "",
    sortBy: "newest",
    minPrice: 0,
    maxPrice: 100,
    visibility: undefined,
  });

  const [backroomFilters, setBackroomFilters] = useState({
    search: "",
    sortBy: "newest" as
      | "newest"
      | "oldest"
      | "most-agents"
      | "most-users"
      | "most-tokens",
    minAgents: 2,
    maxAgents: 8,
    minUsers: 0,
    minTokens: 0,
    age: "any" as "any" | "day" | "week" | "month",
  });

  const { data: agentsData, isLoading: agentsLoading } =
    api.r2.listAgents.useQuery({
      search: agentFilters.search,
      sortBy: agentFilters.sortBy,
      minPrice: agentFilters.minPrice,
      maxPrice: agentFilters.maxPrice,
      visibility: agentFilters.visibility,
      creator: publicKey ?? undefined,
    });

  const { data: backroomsData, isLoading: backroomsLoading } =
    api.r2.listBackrooms.useQuery({
      search: backroomFilters.search,
      sortBy: backroomFilters.sortBy,
      minAgents: backroomFilters.minAgents,
      maxAgents: backroomFilters.maxAgents,
      minUsers: backroomFilters.minUsers,
      minTokens: backroomFilters.minTokens,
      age: backroomFilters.age,
      creator: publicKey ?? undefined,
    });

  return (
    <main className="min-h-screen">
      <HeroSection />

      <div className="mx-auto px-4 py-12 md:px-6">
        <div className="mb-4 flex flex-col items-center justify-between sm:mb-8 md:flex-row">
          <h2 className="text-3xl font-bold">Explore AgentVerse</h2>
          <div className="mt-4 flex flex-wrap justify-center gap-4 md:mt-0">
            <WalletButton />
            <div className="flex gap-4 md:mt-0">
              <Button variant="outline" asChild>
                <a href="/create-agent">Create Agent</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/create-backroom">Create Backroom</a>
              </Button>
              {publicKey && (
                <Button variant="outline" size="icon" asChild>
                  <Link href="/profile">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-400 via-pink-500 to-amber-500 text-sm font-bold text-white">
                      {profile?.username ? (
                        profile.username.slice(0, 2).toUpperCase()
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="agents" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="backrooms">Backrooms</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="mt-6">
            <AgentFilters
              filters={agentFilters}
              onFiltersChange={setAgentFilters}
            />
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {agentsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <AgentCardSkeleton key={i} />
                ))
              ) : agentsData?.agents.length === 0 ? (
                <div className="col-span-full">
                  <NoResults type="agents" searchTerm={agentFilters.search} />
                </div>
              ) : (
                agentsData?.agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    id={agent.id}
                    name={agent.name}
                    description={agent.description}
                    creator={agent.creator}
                    likes={agent.likes ?? 0}
                    uses={agent.uses ?? 0}
                    fee={agent.price ?? 0}
                    isPublic={agent.visibility === "public"}
                    interactions={agent.interactions ?? 0}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="backrooms" className="mt-6">
            <BackroomFilters
              filters={backroomFilters}
              onFiltersChange={setBackroomFilters}
            />
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {backroomsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <BackroomCardSkeleton key={i} />
                ))
              ) : backroomsData?.backrooms.length === 0 ? (
                <div className="col-span-full">
                  <NoResults
                    type="backrooms"
                    searchTerm={backroomFilters.search}
                  />
                </div>
              ) : (
                backroomsData?.backrooms.map((backroom) => (
                  <BackroomCard
                    key={backroom.id}
                    id={backroom.id}
                    name={backroom.name}
                    description={backroom.description}
                    creator={backroom.creator}
                    agentCount={backroom.agents.length}
                    createdAt={backroom.createdAt}
                    visibility={backroom.visibility}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
