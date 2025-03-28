import { z } from "zod";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import type { Agent, AgentMessage } from "@/types/agent";
import type { HttpRequest } from "@aws-sdk/protocol-http";
import { env } from "@/env";
import type { Backroom, BackroomMessage } from "@/types/backroom";
import { v4 as uuidv4 } from "uuid";

interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    const config: StorageConfig = {
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
      bucketName: env.CLOUDFLARE_BUCKET_NAME,
    };

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });

    this.s3Client.middlewareStack.add(
      (next) => async (args) => {
        const request = args.request as HttpRequest;
        delete request.headers["x-amz-checksum-mode"];
        request.headers["x-amz-checksum-algorithm"] = "CRC32";
        return next(args);
      },
      {
        step: "build",
        name: "r2ChecksumFix",
        priority: "high",
      },
    );

    this.bucketName = config.bucketName;
  }

  async saveObject(key: string, data: unknown): Promise<void> {
    try {
      const jsonData =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);

      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: jsonData,
        ContentType: "application/json",
      };

      const command = new PutObjectCommand(params);

      try {
        await this.s3Client.send(command);
      } catch (err) {
        throw new Error(`Failed to save object to R2: ${key}`);
      }
    } catch (error) {
      throw error;
    }
  }

  async getObject<T>(
    key: string,
    retryCount = 3,
    retryDelay = 500,
  ): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const params = {
          Bucket: this.bucketName,
          Key: key,
        };

        const command = new GetObjectCommand(params);
        try {
          const response = await this.s3Client.send(command);
          const data = await response.Body?.transformToString();

          if (!data) {
            throw new Error(`Object not found: ${key}`);
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch (parseError) {
            throw new Error(`Invalid JSON in object: ${key}`);
          }

          return parsed as T;
        } catch (err) {
          if (
            err &&
            typeof err === "object" &&
            "Code" in err &&
            err.Code === "NoSuchKey"
          ) {
            throw new Error(`Object not found: ${key}`);
          }

          if (
            err &&
            typeof err === "object" &&
            "Code" in err &&
            err.Code === "InternalError"
          ) {
            lastError = err;

            if (attempt < retryCount - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * (attempt + 1)),
              );
              continue;
            }
          }

          throw err;
        }
      } catch (error) {
        lastError = error;

        if (
          attempt < retryCount - 1 &&
          error &&
          typeof error === "object" &&
          (("Code" in error && error.Code === "InternalError") ||
            (error instanceof Error &&
              error.message.includes("internal error")))
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * (attempt + 1)),
          );
          continue;
        }

        if (attempt === retryCount - 1) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  async listObjectsPaginated(
    prefix: string,
    limit = 10,
    continuationToken?: string,
    delimiter?: string,
  ) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: limit,
        ContinuationToken: continuationToken,
        Delimiter: delimiter,
      });

      const response = await this.s3Client.send(command);
      const objects = response.Contents?.map((obj) => ({
        key: obj.Key ?? "",
        lastModified: obj.LastModified,
      })).filter(
        (obj): obj is { key: string; lastModified: Date | undefined } =>
          obj.key !== "",
      );

      return {
        objects,
        nextCursor: response.NextContinuationToken,
      };
    } catch (err) {
      throw err;
    }
  }
}

export const storage = new StorageService();

const BackroomSchema = z.object({
  id: z.string(),
  name: z.string(),
  topic: z.string(),
  description: z.string(),
  agents: z.array(z.string()),
  visibility: z.enum(["public", "private"]),
  creator: z.string(),
  messageLimit: z.number().min(10).max(100),
  messages: z.array(
    z.object({
      id: z.string(),
      agentId: z.string(),
      content: z.string(),
      timestamp: z.coerce.date(),
      metadata: z.any().optional(),
    }),
  ),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  status: z.enum(["active", "completed", "pending"]),
  userCount: z.number().optional(),
  tokenCount: z.number().optional(),
}) satisfies z.ZodType<Backroom>;

const AgentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    description: z.string(),
    status: z.enum(["active", "inactive"]),
    personality: z.string().optional(),
    background: z.string().optional(),
    expertise: z.string().optional(),
    coreBeliefs: z.string().optional(),
    quirks: z.string().optional(),
    communicationStyle: z.string().optional(),
    traits: z.array(z.string()),
    createdAt: z.date(),
    visibility: z.enum(["public", "private"]),
    creator: z.string(),
    price: z.number().min(0).optional(),
    canLaunchToken: z.boolean().optional(),
    likes: z.number().default(0),
  })
  .transform((data) => {
    return {
      ...data,
      visibility: data.visibility ?? "public",
      creator: data.creator ?? "",
      canLaunchToken: data.canLaunchToken ?? false,
      likes: data.likes ?? 0,
    };
  }) as z.ZodType<Agent>;

const MessageSchema = z.object({
  agentId: z.string(),
  content: z.string(),
  response: z.string(),
  timestamp: z.coerce.date(),
  userId: z.string().optional(),
  conversationId: z.string(),
  messageType: z.enum(["user", "agent"]),
  sequence: z.number(),
}) satisfies z.ZodType<AgentMessage>;

const UserProfileSchema = z.object({
  publicKey: z.string(),
  username: z.string(),
  bio: z.string().optional(),
  profilePicture: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const r2Router = createTRPCRouter({
  createBackroom: publicProcedure
    .input(
      BackroomSchema.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        messages: true,
        status: true,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const id = uuidv4();
        const backroom: Backroom = {
          ...input,
          id,
          messages: [],
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await storage.saveObject(`backrooms/${id}.json`, backroom);
        return { success: true, backroomId: id };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create backroom",
          cause: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  listBackrooms: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(10000).default(10000),
        creator: z.string().optional(),
        search: z.string().optional(),
        sortBy: z
          .enum([
            "newest",
            "oldest",
            "most-agents",
            "most-users",
            "most-tokens",
          ])
          .optional(),
        minAgents: z.number().optional(),
        maxAgents: z.number().optional(),
        minUsers: z.number().optional(),
        minTokens: z.number().optional(),
        age: z.enum(["any", "day", "week", "month"]).optional(),
        visibility: z.enum(["public", "private"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        let allBackrooms: Backroom[] = [];
        let nextCursor = input.cursor;

        do {
          const result = await storage.listObjectsPaginated(
            "backrooms/",
            input.limit,
            nextCursor,
            "/",
          );

          const backrooms = await Promise.all(
            (result.objects ?? []).map(async (obj) => {
              if (!obj.key) return null;
              try {
                const data = await storage.getObject<Backroom>(obj.key);
                return BackroomSchema.parse(data);
              } catch (error) {
                return null;
              }
            }),
          );

          const validBackrooms = backrooms.filter((b): b is Backroom => !!b);
          allBackrooms = [...allBackrooms, ...validBackrooms];
          nextCursor = result.nextCursor;
        } while (nextCursor);

        let filteredBackrooms = allBackrooms.filter((b) => {
          const matchesSearch = input.search
            ? b.name.toLowerCase().includes(input.search.toLowerCase()) ||
              b.description.toLowerCase().includes(input.search.toLowerCase())
            : true;

          const matchesAgents =
            input.minAgents || input.maxAgents
              ? (input.minAgents ? b.agents.length >= input.minAgents : true) &&
                (input.maxAgents ? b.agents.length <= input.maxAgents : true)
              : true;

          const matchesUsers = input.minUsers
            ? (b.userCount ?? 0) >= input.minUsers
            : true;

          const matchesTokens = input.minTokens
            ? (b.tokenCount ?? 0) >= input.minTokens
            : true;

          const isCreator =
            input.creator && b.creator
              ? input.creator.toLowerCase() === b.creator.toLowerCase()
              : false;

          const matchesVisibility = input.visibility
            ? (input.visibility === "public" && b.visibility === "public") ||
              (input.visibility === "private" &&
                b.visibility === "private" &&
                isCreator)
            : b.visibility === "public" ||
              (b.visibility === "private" && isCreator);

          return (
            matchesSearch &&
            matchesAgents &&
            matchesUsers &&
            matchesTokens &&
            matchesVisibility
          );
        });

        if (input.age && input.age !== "any") {
          const cutoff = new Date();
          switch (input.age) {
            case "day":
              cutoff.setDate(cutoff.getDate() - 1);
              break;
            case "week":
              cutoff.setDate(cutoff.getDate() - 7);
              break;
            case "month":
              cutoff.setMonth(cutoff.getMonth() - 1);
              break;
          }
          filteredBackrooms = filteredBackrooms.filter(
            (b) => b.createdAt >= cutoff,
          );
        }

        switch (input.sortBy) {
          case "oldest":
            filteredBackrooms.sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            );
            break;
          case "most-agents":
            filteredBackrooms.sort((a, b) => b.agents.length - a.agents.length);
            break;
          case "most-users":
            filteredBackrooms.sort(
              (a, b) => (b.userCount ?? 0) - (a.userCount ?? 0),
            );
            break;
          case "most-tokens":
            filteredBackrooms.sort(
              (a, b) => (b.tokenCount ?? 0) - (a.tokenCount ?? 0),
            );
            break;
          default:
            filteredBackrooms.sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
        }

        return {
          backrooms: filteredBackrooms,
          nextCursor: undefined,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list backrooms",
          cause: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  getBackroom: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const backroom = await storage.getObject<Backroom>(
          `backrooms/${input.id}.json`,
        );
        return BackroomSchema.parse(backroom);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Backroom not found",
        });
      }
    }),

  startBackroomConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const backroom = await storage.getObject<Backroom>(
          `backrooms/${input.id}.json`,
        );
        const updatedBackroom: Backroom = {
          ...backroom,
          status: "active",
          updatedAt: new Date(),
        };
        await storage.saveObject(`backrooms/${input.id}.json`, updatedBackroom);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start conversation",
          cause: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  saveAgent: publicProcedure.input(AgentSchema).mutation(async ({ input }) => {
    try {
      const key = `agents/${input.id}.json`;
      await storage.saveObject(key, input);
      return { success: true, agentId: input.id };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to save agent to R2",
        cause: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }),

  getAgent: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const key = `agents/${input.id}.json`;
        const data = await storage.getObject<Agent>(key);

        const safeDate = (date: unknown): Date => {
          try {
            const d = new Date(z.coerce.date().parse(date));
            return isNaN(d.getTime()) ? new Date() : d;
          } catch {
            return new Date();
          }
        };

        return AgentSchema.parse({
          ...data,
          createdAt: safeDate(data.createdAt),
        });
      } catch (err) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found in R2 storage",
          cause: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }),

  listAgents: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(10000).default(10000),
        creator: z.string().optional(),
        search: z.string().optional(),
        sortBy: z
          .enum(["newest", "oldest", "priceHigh", "priceLow", "popular"])
          .optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        visibility: z.enum(["public", "private"]).optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        let allAgents: Agent[] = [];
        let nextCursor = input.cursor;

        do {
          const result = await storage.listObjectsPaginated(
            "agents/",
            input.limit,
            nextCursor,
            "/",
          );

          const agentObjects = (result.objects ?? []).filter(
            (obj) =>
              obj.key?.endsWith(".json") &&
              obj.key.split("/").length === 2 &&
              obj.key,
          );

          const agentPromises = agentObjects.map(async (obj) => {
            try {
              if (!obj.key) return null;

              try {
                const data = await storage.getObject<Agent>(obj.key);

                let createdAt: Date;
                try {
                  const parsedDate = new Date(data.createdAt);
                  createdAt = isNaN(parsedDate.getTime())
                    ? (obj.lastModified ?? new Date())
                    : parsedDate;
                } catch {
                  createdAt = obj.lastModified ?? new Date();
                }

                try {
                  const parsedAgent = AgentSchema.parse({
                    ...data,
                    createdAt,
                  });
                  return parsedAgent;
                } catch (validationError) {
                  return null;
                }
              } catch (retrievalError) {
                return null;
              }
            } catch (err) {
              return null;
            }
          });

          const settledResults = await Promise.allSettled(agentPromises);
          const agents = settledResults
            .filter(
              (result): result is PromiseFulfilledResult<Agent | null> =>
                result.status === "fulfilled",
            )
            .map((result) => result.value)
            .filter((agent): agent is Agent => agent !== null);

          allAgents = [...allAgents, ...agents];
          nextCursor = result.nextCursor;
        } while (nextCursor);

        const filteredAgents = allAgents.filter((agent) => {
          const matchesSearch = input.search
            ? agent.name.toLowerCase().includes(input.search.toLowerCase()) ||
              agent.description
                .toLowerCase()
                .includes(input.search.toLowerCase())
            : true;

          const matchesPrice =
            (input.minPrice === undefined ||
              (agent.price ?? 0) >= input.minPrice) &&
            (input.maxPrice === undefined ||
              (agent.price ?? 0) <= input.maxPrice);

          const isCreator =
            input.creator && agent.creator
              ? input.creator.toLowerCase() === agent.creator.toLowerCase()
              : false;

          const matchesVisibility = input.visibility
            ? (input.visibility === "public" &&
                agent.visibility === "public") ||
              (input.visibility === "private" &&
                agent.visibility === "private" &&
                isCreator)
            : agent.visibility === "public" ||
              (agent.visibility === "private" && isCreator);

          return matchesSearch && matchesPrice && matchesVisibility;
        });

        switch (input.sortBy) {
          case "oldest":
            filteredAgents.sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            );
            break;
          case "priceHigh":
            filteredAgents.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
            break;
          case "priceLow":
            filteredAgents.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
            break;
          case "popular":
            filteredAgents.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
            break;
          default:
            filteredAgents.sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
        }

        return {
          agents: filteredAgents,
          nextCursor: undefined,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list agents from R2",
          cause: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }),

  saveMessage: publicProcedure
    .input(MessageSchema)
    .mutation(async ({ input }) => {
      try {
        const timestamp = input.timestamp.getTime();
        const randomSuffix = Math.random().toString(36).slice(2, 8);
        const key = `agents/${input.agentId}/messages/${timestamp}_${randomSuffix}.json`;
        await storage.saveObject(key, input);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save message to R2",
          cause: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }),

  getMessages: publicProcedure
    .input(
      z.object({
        agentId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        const prefix = `agents/${input.agentId}/messages/`;
        const result = await storage.listObjectsPaginated(
          prefix,
          input.limit,
          input.cursor,
        );

        const messages = await Promise.all(
          (result.objects ?? []).map(async (obj) => {
            if (!obj.key) return null;
            try {
              const data = await storage.getObject<AgentMessage>(obj.key);
              return MessageSchema.parse(data);
            } catch (err) {
              return null;
            }
          }),
        );

        const validMessages = messages.filter((m): m is AgentMessage => !!m);

        return {
          messages: validMessages.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
          ),
          nextCursor: result.nextCursor,
        };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve messages from R2",
          cause: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }),

  addBackroomMessage: publicProcedure
    .input(
      z.object({
        backroomId: z.string(),
        agentId: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const backroom = await storage.getObject<Backroom>(
          `backrooms/${input.backroomId}.json`,
        );
        const newMessage: BackroomMessage = {
          id: uuidv4(),
          agentId: input.agentId,
          content: input.content,
          timestamp: new Date(),
        };

        backroom.messages.push(newMessage);
        backroom.updatedAt = new Date();

        if (backroom.messages.length >= backroom.messageLimit) {
          backroom.status = "completed";
        }

        await storage.saveObject(
          `backrooms/${input.backroomId}.json`,
          backroom,
        );
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add message to backroom",
          cause: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }),

  getUserProfile: publicProcedure
    .input(z.object({ publicKey: z.string() }))
    .query(async ({ input }) => {
      try {
        return await storage
          .getObject(`users/${input.publicKey}.json`)
          .then((data) => UserProfileSchema.parse(data));
      } catch {
        return null;
      }
    }),

  updateUserProfile: publicProcedure
    .input(UserProfileSchema.omit({ createdAt: true, updatedAt: true }))
    .mutation(async ({ input }) => {
      const existingUser = (await storage
        .getObject(`users/${input.publicKey}.json`)
        .catch(() => null)) as z.infer<typeof UserProfileSchema> | null;
      const createdAt =
        existingUser && "createdAt" in existingUser
          ? existingUser.createdAt
          : new Date();
      const userData: z.infer<typeof UserProfileSchema> = {
        ...input,
        createdAt,
        updatedAt: new Date(),
      };

      await storage.saveObject(`users/${input.publicKey}.json`, userData);
      return { success: true };
    }),

  toggleAgentLike: publicProcedure
    .input(
      z.object({
        agentId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const agent = await storage.getObject<Agent>(
          `agents/${input.agentId}.json`,
        );

        let likes: string[] = [];
        try {
          const data = await storage.getObject<string[]>(
            `agents/${input.agentId}/likes.json`,
          );
          if (data && Array.isArray(data)) {
            likes = data;
          }
        } catch (error) {}

        const userIndex = likes.indexOf(input.userId);
        if (userIndex === -1) {
          likes.push(input.userId);
        } else {
          likes.splice(userIndex, 1);
        }

        await storage.saveObject(`agents/${input.agentId}/likes.json`, likes);

        const updatedAgent: Agent = {
          ...agent,
          likes: likes.length,
        };

        await storage.saveObject(`agents/${input.agentId}.json`, updatedAgent);

        return {
          success: true,
          liked: userIndex === -1,
          likeCount: likes.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle like",
          cause: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }),

  checkAgentLike: publicProcedure
    .input(
      z.object({
        agentId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        let likes: string[] = [];
        try {
          const data = await storage.getObject<string[]>(
            `agents/${input.agentId}/likes.json`,
          );
          if (data && Array.isArray(data)) {
            likes = data;
          }
        } catch (error) {}

        return {
          liked: likes.includes(input.userId),
          likeCount: likes.length,
        };
      } catch (error) {
        return {
          liked: false,
          likeCount: 0,
        };
      }
    }),
});
