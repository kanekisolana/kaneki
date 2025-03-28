export interface Backroom {
  id: string;
  name: string;
  topic: string;
  description: string;
  agents: string[];
  visibility: "public" | "private";
  creator: string;
  messageLimit: number;
  messages: BackroomMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: "active" | "completed" | "pending";
  userCount?: number;
  tokenCount?: number;
}

export interface BackroomMessage {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  metadata?: {
    latency?: number;
    tokensUsed?: number;
  };
}
