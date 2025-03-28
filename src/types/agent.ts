export interface Agent {
  id: string;
  name: string;
  type: string;
  description: string;
  status: "active" | "inactive";
  personality?: string;
  background?: string;
  expertise?: string;
  coreBeliefs?: string;
  quirks?: string;
  communicationStyle?: string;
  traits: string[];
  createdAt: Date;
  visibility: "public" | "private";
  creator: string;
  price?: number;
  canLaunchToken?: boolean;
  likes?: number;
  uses?: number;
  interactions?: number;
}

export interface AgentMessage {
  agentId: string;
  content: string;
  response: string;
  timestamp: Date;
  userId?: string;
  conversationId: string;
  messageType: "user" | "agent";
  sequence: number;
}

export interface CreateAgentFormData {
  name: string;
  personality: string;
  background: string;
  expertise: string;
  coreBeliefs: string;
  quirks: string;
  communicationStyle: string;
  isRandom: boolean;
  conversationTopic: string;
  traits?: string[];
  visibility: "public" | "private";
  price?: number;
  canLaunchToken?: boolean;
}
