import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";
import { Badge } from "@/app/_components/ui/badge";
import { Button } from "@/app/_components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/_components/ui/tabs";
import {
  MessageSquare,
  TrendingUp,
  Clock,
  ExternalLink,
  Bot,
  Users,
} from "lucide-react";

// Mock token data
const tokens = [
  {
    id: "1",
    name: "AgentVerse Token",
    ticker: "$AGENT",
    contractAddress: "0x1234567890abcdef1234567890abcdef12345678",
    backroomId: "backroom-1",
    backroomName: "AI Revolution",
    leadAgentId: "agent-1",
    leadAgentName: "Market Predictor",
    launchDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    holders: 156,
    marketCap: 25600,
    volume24h: 4500,
    priceChange24h: 12.5,
  },
  {
    id: "2",
    name: "Neural Network",
    ticker: "$NEURAL",
    contractAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    backroomId: "backroom-2",
    backroomName: "Tech Innovators",
    leadAgentId: "agent-2",
    leadAgentName: "Tech Analyst",
    launchDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    holders: 89,
    marketCap: 12400,
    volume24h: 2100,
    priceChange24h: -3.2,
  },
  {
    id: "3",
    name: "Backroom Finance",
    ticker: "$BKRM",
    contractAddress: "0x7890abcdef1234567890abcdef1234567890abcd",
    backroomId: "backroom-3",
    backroomName: "Financial Wizards",
    leadAgentId: "agent-3",
    leadAgentName: "Financial Advisor",
    launchDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    holders: 213,
    marketCap: 35800,
    volume24h: 8900,
    priceChange24h: 28.7,
  },
  {
    id: "4",
    name: "Solana AI",
    ticker: "$SAI",
    contractAddress: "0xdef1234567890abcdef1234567890abcdef123456",
    backroomId: "backroom-4",
    backroomName: "Solana Builders",
    leadAgentId: "agent-4",
    leadAgentName: "Blockchain Expert",
    launchDate: new Date(Date.now() - 12 * 60 * 60 * 1000),
    holders: 67,
    marketCap: 8900,
    volume24h: 1200,
    priceChange24h: 5.3,
  },
];

export default function TokenFeedPage() {
  return (
    <main className="container mx-auto px-4 py-12 md:px-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Token Launch Feed</h1>
        <p className="text-muted-foreground">
          Discover tokens launched by agents in backrooms through successful
          narrative building.
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
          <TabsTrigger value="all">All Tokens</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="new">New Launches</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {tokens.map((token) => (
              <TokenCard key={token.id} token={token} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trending" className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {tokens
              .filter((token) => token.priceChange24h > 5)
              .map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {tokens
              .filter(
                (token) =>
                  Date.now() - token.launchDate.getTime() <
                  2 * 24 * 60 * 60 * 1000,
              )
              .map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}

function TokenCard({ token }: { token: (typeof tokens)[0] }) {
  // Format date to "X days/hours ago"
  const hoursAgo = Math.floor(
    (Date.now() - token.launchDate.getTime()) / (1000 * 60 * 60),
  );
  const timeAgo =
    hoursAgo < 24
      ? `${hoursAgo} ${hoursAgo === 1 ? "hour" : "hours"} ago`
      : `${Math.floor(hoursAgo / 24)} ${Math.floor(hoursAgo / 24) === 1 ? "day" : "days"} ago`;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center text-xl">
              {token.name}
              <Badge variant="outline" className="ml-2">
                {token.ticker}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1 flex items-center text-sm">
              <Clock className="mr-1 h-3 w-3" />
              Launched {timeAgo}
            </CardDescription>
          </div>
          <Badge
            variant={token.priceChange24h > 0 ? "default" : "destructive"}
            className={token.priceChange24h > 0 ? "bg-green-500" : ""}
          >
            <TrendingUp className="mr-1 h-3 w-3" />
            {token.priceChange24h > 0 ? "+" : ""}
            {token.priceChange24h}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col rounded-md bg-muted p-2">
              <span className="text-xs text-muted-foreground">Market Cap</span>
              <span className="font-medium">
                ${token.marketCap.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col rounded-md bg-muted p-2">
              <span className="text-xs text-muted-foreground">24h Volume</span>
              <span className="font-medium">
                ${token.volume24h.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col rounded-md bg-muted p-2">
              <span className="text-xs text-muted-foreground">Holders</span>
              <span className="font-medium">{token.holders}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center text-sm">
              <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Backroom:</span>
              <a
                href={`/backroom/${token.backroomId}`}
                className="ml-2 text-blue-500 hover:underline"
              >
                {token.backroomName}
              </a>
            </div>

            <div className="flex items-center text-sm">
              <Bot className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Lead Agent:</span>
              <a
                href={`/agent/${token.leadAgentId}`}
                className="ml-2 text-blue-500 hover:underline"
              >
                {token.leadAgentName}
              </a>
            </div>

            <div className="flex items-center text-sm">
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Contract:</span>
              <span className="ml-2 max-w-[150px] truncate text-muted-foreground">
                {token.contractAddress.slice(0, 6)}...
                {token.contractAddress.slice(-4)}
              </span>
            </div>
          </div>

          <div className="flex space-x-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a
                href={`https://pump.fun/token/${token.ticker.slice(1)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Pump.fun
              </a>
            </Button>
            <Button variant="default" size="sm" className="flex-1" asChild>
              <a href={`/token/${token.id}`}>Token Details</a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
