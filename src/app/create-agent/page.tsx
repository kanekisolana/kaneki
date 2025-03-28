"use client";

import type React from "react";

import { useState } from "react";
import { Button } from "@/app/_components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/_components/ui/card";
import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";
import { Textarea } from "@/app/_components/ui/textarea";
import { Switch } from "@/app/_components/ui/switch";
import { Slider } from "@/app/_components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/app/_components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { usePaymentStore } from "@/store/payment-store";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import type { VersionedTransaction } from "@solana/web3.js";

interface SolanaWallet {
  signTransaction(transaction: Transaction): Promise<Transaction>;
  isConnected?: boolean;
  connect?: () => Promise<void>;
}

const PAYMENT_AMOUNT = 0.05;
const RECIPIENT_ADDRESS = "5HypJG3eMU9dmMzSKCaKunsjpMT6eXuiUGnukmc9ouHz";

export default function CreateAgentPage() {
  const { publicKey } = useUser();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();
  const { isWalletVerified } = usePaymentStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [fee, setFee] = useState([0]);
  const [personality, setPersonality] = useState("helpful");
  const [knowledge, setKnowledge] = useState("");
  const [goals, setGoals] = useState("");
  const [canLaunchToken, setCanLaunchToken] = useState(false);

  const verifyPayment = api.payment.verifyPayment.useMutation({
    onSuccess: () => {
      toast({
        title: "Payment Verified",
        description: "Payment verified successfully! Creating your agent...",
      });
      if (publicKey) {
        usePaymentStore
          .getState()
          .addVerifiedTransaction(publicKey, "agent-creation");
      }
      void handleCreateAgent();
    },
    onError: (error) => {
      toast({
        title: "Payment Failed",
        description: "Payment verification failed: " + error.message,
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    },
  });

  const createAgent = api.ai.createAgent.useMutation({
    onSuccess: async (data) => {
      await utils.r2.listAgents.invalidate();
      await utils.r2.listAgents.refetch();

      toast({
        title: "Agent Created",
        description: `${data.agent.name} has been successfully created.`,
      });

      if (publicKey) {
        usePaymentStore
          .getState()
          .addVerifiedTransaction(publicKey, "agent-creation");
      }
      router.push("/");
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create agent: " + error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateAgent = async () => {
    try {
      setIsCreating(true);

      await createAgent.mutateAsync({
        name,
        personality,
        background: description,
        expertise: knowledge,
        coreBeliefs: goals,
        quirks: "",
        communicationStyle: personality,
        isRandom: false,
        conversationTopic: "",
        visibility: isPublic ? "public" : "private",
        price: isPublic ? fee[0] : undefined,
        canLaunchToken,
        creator: publicKey!,
      });

      setName("");
      setDescription("");
      setIsPublic(false);
      setFee([0]);
      setPersonality("helpful");
      setKnowledge("");
      setGoals("");
      setCanLaunchToken(false);
    } catch (_error) {
      /* eslint-disable-line @typescript-eslint/no-unused-vars */
      toast({
        title: "Creation Failed",
        description: "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePayment = async () => {
    if (!publicKey || !window.solana) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to create an agent.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessingPayment(true);

      const wallet = window.solana as SolanaWallet | undefined;
      if (
        wallet?.isConnected === false &&
        typeof wallet?.connect === "function"
      ) {
        try {
          await wallet.connect();
        } catch (error) {
          toast({
            title: "Connection Failed",
            description: "Failed to connect to wallet. Please try again.",
            variant: "destructive",
          });
          setIsProcessingPayment(false);
          return;
        }
      }

      const connection = new Connection(process.env.MAINNET_RPC!, {
        commitment: "confirmed",
      });

      const sender = new PublicKey(publicKey);
      const recipient = new PublicKey(RECIPIENT_ADDRESS);
      const lamportsToSend = Math.round(PAYMENT_AMOUNT * LAMPORTS_PER_SOL);

      const balance = await connection.getBalance(sender);
      if (balance < lamportsToSend) {
        toast({
          title: "Insufficient Balance",
          description: `You need at least ${PAYMENT_AMOUNT} SOL to create an agent.`,
          variant: "destructive",
        });
        setIsProcessingPayment(false);
        return;
      }

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: recipient,
          lamports: lamportsToSend,
        }),
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sender;

      let signed: Transaction | VersionedTransaction;
      try {
        signed = await window.solana?.signTransaction(transaction);
        if (!signed) {
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
            description: "Transaction was cancelled by user",
          });
        } else {
          toast({
            title: "Transaction Failed",
            description: "Failed to sign transaction. Please try again.",
            variant: "destructive",
          });
        }
        setIsProcessingPayment(false);
        return;
      }

      let signature;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
          });
          break;
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }
          toast({
            title: "Retrying Transaction",
            description: `Retrying transaction (attempt ${attempt + 1}/3)...`,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!signature) {
        throw new Error("Failed to send transaction after retries");
      }

      toast({
        title: "Transaction Pending",
        description: "Your transaction is being processed...",
      });

      const confirmationStatus = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      if (confirmationStatus.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmationStatus.value.err)}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      let txInfo = null;
      for (let i = 0; i < 3; i++) {
        try {
          txInfo = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          });

          if (txInfo?.meta) break;

          if (i < 2) {
            toast({
              title: "Verifying Transaction",
              description: `Verifying transaction (attempt ${i + 1}/3)...`,
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (_error) {
          /* eslint-disable-line @typescript-eslint/no-unused-vars */
          if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!txInfo?.meta) {
        throw new Error(
          "Transaction verification timeout - please check your wallet for status",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast({
        title: "Verifying Payment",
        description: "Verifying your payment...",
      });

      try {
        await verifyPayment.mutateAsync({
          signature,
          payerPublicKey: publicKey,
          recipient: RECIPIENT_ADDRESS,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Transaction not found")
        ) {
          toast({
            title: "Payment Successful",
            description:
              "Transaction confirmed but verification pending. Creating your agent...",
          });
          await handleCreateAgent();
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("rejected") ||
          error.message.includes("User rejected"))
      ) {
        toast({
          title: "Transaction Cancelled",
          description: "Transaction was cancelled by user",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: `Payment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          variant: "destructive",
        });
      }
      setIsProcessingPayment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create an agent.",
        variant: "destructive",
      });
      return;
    }

    if (!name || !description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const verified = isWalletVerified(publicKey);

    if (verified) {
      await handleCreateAgent();
    } else {
      await handlePayment();
    }
  };

  return (
    <main className="container mx-auto px-4 py-12 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold">Create a New AI Agent</h1>
          <p className="text-muted-foreground">
            Design your custom AI agent by setting specific parameters and
            behaviors.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <div className="flex items-center justify-between">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Define the core attributes of your AI agent.
                </CardDescription>
              </CardHeader>
              <button
                className="mr-6 flex h-8 w-8 items-center justify-center rounded-lg border border-[0.5px] border-white border-opacity-50"
                onClick={() => router.back()}
              >
                <ChevronLeft />
              </button>
            </div>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter a name for your agent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your agent does and its purpose"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="public">Make Agent Public</Label>
                  <p className="text-sm text-muted-foreground">
                    Public agents can be discovered and used by other users
                  </p>
                </div>
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>

              {isPublic && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fee">Usage Fee (SOL)</Label>
                    <span className="text-sm font-medium">{fee[0]} SOL</span>
                  </div>
                  <Slider
                    id="fee"
                    value={fee}
                    onValueChange={setFee}
                    max={1}
                    step={0.01}
                    disabled={!isPublic}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set a fee for others to use your agent (0 SOL for free)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="canLaunchToken">Can Launch Tokens</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this agent to launch tokens after backroom discussions
                  </p>
                </div>
                <Switch
                  id="canLaunchToken"
                  checked={canLaunchToken}
                  onCheckedChange={setCanLaunchToken}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Agent Personality & Behavior</CardTitle>
              <CardDescription>
                Define how your agent will interact and behave.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Personality Type</Label>
                <RadioGroup value={personality} onValueChange={setPersonality}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="helpful" id="helpful" />
                    <Label htmlFor="helpful">Helpful & Informative</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="creative" id="creative" />
                    <Label htmlFor="creative">Creative & Imaginative</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="analytical" id="analytical" />
                    <Label htmlFor="analytical">Analytical & Logical</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="friendly" id="friendly" />
                    <Label htmlFor="friendly">Friendly & Conversational</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="knowledge">Knowledge Base</Label>
                <Textarea
                  id="knowledge"
                  placeholder="Enter specific knowledge or information your agent should have"
                  rows={4}
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Provide domain-specific knowledge your agent should use
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals">Agent Goals</Label>
                <Textarea
                  id="goals"
                  placeholder="Define the primary goals and objectives of your agent"
                  rows={4}
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  What should your agent aim to accomplish in conversations?
                </p>
              </div>
            </CardContent>
          </Card>

          {publicKey && !isWalletVerified(publicKey) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
                <CardDescription>
                  Creating an agent requires a base fee of {PAYMENT_AMOUNT} SOL.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4">
                  <span>Base Creation Fee</span>{" "}
                  <span>{PAYMENT_AMOUNT} SOL</span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isCreating || isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    `Pay ${PAYMENT_AMOUNT} SOL`
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {publicKey && isWalletVerified(publicKey) && (
            <div className="mt-6">
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Agent...
                  </>
                ) : (
                  "Create Agent"
                )}
              </Button>
            </div>
          )}

          {!publicKey && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Please connect your wallet to create an agent.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
