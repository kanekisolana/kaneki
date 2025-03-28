import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { storage } from "./r2";
import { TRPCError } from "@trpc/server";
import type { Agent } from "@/types/agent";
import type { Backroom } from "@/types/backroom";

const profileSchema = z
  .object({
    username: z.string().optional(),
    twitterHandle: z.string().optional(),
    bio: z.string().optional(),
    website: z.string().optional(),
    github: z.string().optional(),
    linkedin: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    website: data.website ?? null,
    github: data.github ?? null,
    linkedin: data.linkedin ?? null,
  }));

type Profile = {
  username: string;
  twitterHandle: string | null;
  bio: string | null;
  website: string | null;
  github: string | null;
  linkedin: string | null;
  createdAt: Date;
};

async function getUserAgents(publicKey: string): Promise<Agent[]> {
  const { objects } = await storage.listObjectsPaginated("agents/", 100);
  if (!objects) return [];

  const agentMap = new Map<string, Agent>();
  for (const obj of objects) {
    try {
      const agent = await storage.getObject<Agent>(obj.key);
      if (agent.creator === publicKey) {
        agentMap.set(agent.id, agent);
      }
    } catch (error) {
      console.error(`Failed to fetch agent ${obj.key}:`, error);
    }
  }
  return Array.from(agentMap.values());
}

async function getUserBackrooms(publicKey: string): Promise<Backroom[]> {
  const { objects } = await storage.listObjectsPaginated("backrooms/", 100);
  if (!objects) return [];

  const backroomMap = new Map<string, Backroom>();
  for (const obj of objects) {
    try {
      const backroom = await storage.getObject<Backroom>(obj.key);
      if (backroom.creator === publicKey) {
        backroomMap.set(backroom.id, {
          ...backroom,
          agents: backroom.agents ?? [],
          visibility: backroom.visibility ?? "private",
          createdAt: new Date(backroom.createdAt),
          updatedAt: new Date(backroom.updatedAt),
          status: backroom.status ?? "active",
          messages: backroom.messages ?? [],
          messageLimit: backroom.messageLimit ?? 100,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch backroom ${obj.key}:`, error);
    }
  }
  return Array.from(backroomMap.values());
}

export const profileRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.publicKey) {
      return {
        username: "You",
        walletAddress: "",
        twitterHandle: null,
        bio: null,
        website: null,
        github: null,
        linkedin: null,
        revenue: 0,
        agentsCreated: 0,
        backroomsCreated: 0,
        joinDate: new Date(),
        agents: [],
        backrooms: [],
      };
    }

    try {
      const profile = await storage.getObject<Profile>(
        `profiles/${ctx.session.user.publicKey}.json`,
      );

      // Fetch user's agents and backrooms
      const [userAgents, userBackrooms] = await Promise.all([
        getUserAgents(ctx.session.user.publicKey),
        getUserBackrooms(ctx.session.user.publicKey),
      ]);

      return {
        ...profile,
        walletAddress: ctx.session.user.publicKey,
        revenue: 0, // TODO: Calculate from transactions
        agentsCreated: userAgents.length,
        backroomsCreated: userBackrooms.length,
        joinDate: new Date(profile.createdAt),
        agents: userAgents,
        backrooms: userBackrooms,
      };
    } catch (error) {
      // If profile not found, return default profile
      if (
        error instanceof Error &&
        error.message.includes("Object not found")
      ) {
        return {
          username: "You",
          walletAddress: ctx.session.user.publicKey,
          twitterHandle: null,
          bio: null,
          website: null,
          github: null,
          linkedin: null,
          revenue: 0,
          agentsCreated: 0,
          backroomsCreated: 0,
          joinDate: new Date(),
          agents: [],
          backrooms: [],
        };
      }
      throw error;
    }
  }),

  update: protectedProcedure
    .input(profileSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.publicKey) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Please connect your wallet to update your profile",
        });
      }

      try {
        const existingProfile = await storage.getObject<Profile>(
          `profiles/${ctx.session.user.publicKey}.json`,
        );

        const profile = {
          ...existingProfile,
          ...input,
          createdAt: existingProfile?.createdAt ?? new Date(),
        };

        await storage.saveObject(
          `profiles/${ctx.session.user.publicKey}.json`,
          profile,
        );

        // Fetch user's agents and backrooms for the response
        const [userAgents, userBackrooms] = await Promise.all([
          getUserAgents(ctx.session.user.publicKey),
          getUserBackrooms(ctx.session.user.publicKey),
        ]);

        return {
          ...profile,
          joinDate: new Date(profile.createdAt),
          agents: userAgents,
          backrooms: userBackrooms,
          agentsCreated: userAgents.length,
          backroomsCreated: userBackrooms.length,
        };
      } catch (error) {
        // If profile not found, create new profile
        if (
          error instanceof Error &&
          error.message.includes("Object not found")
        ) {
          const profile = {
            username: input.username ?? "You",
            twitterHandle: input.twitterHandle ?? null,
            bio: input.bio ?? null,
            website: input.website ?? null,
            github: input.github ?? null,
            linkedin: input.linkedin ?? null,
            createdAt: new Date(),
          };

          await storage.saveObject(
            `profiles/${ctx.session.user.publicKey}.json`,
            profile,
          );

          return {
            ...profile,
            joinDate: profile.createdAt,
            agents: [],
            backrooms: [],
            agentsCreated: 0,
            backroomsCreated: 0,
          };
        }
        throw error;
      }
    }),
});
