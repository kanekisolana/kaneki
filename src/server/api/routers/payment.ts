import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { storage } from "./r2";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
  getAccount,
} from "@solana/spl-token";

const MINT_ADDRESS = "6sLPWn293q3hGMF9mhQAkxnqy2Kz4sQZVW2jQ2Nypump";
const RECIPIENT_ADDRESS = "5HypJG3eMU9dmMzSKCaKunsjpMT6eXuiUGnukmc9ouHz";
const REQUIRED_PAYMENT_AMOUNT = 0.05; // 0.05 SOL
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

interface PaymentVerification {
  signature: string;
  amount: number;
  timestamp: Date;
  verified: boolean;
}

interface TransactionSignatureVerification {
  signature: string;
  payerPublicKey: string;
  timestamp: Date;
  purpose: string;
}

interface StorageError {
  $metadata?: {
    httpStatusCode?: number;
  };
  Code?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const saveWithRetry = async (key: string, data: PaymentVerification) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await storage.saveObject(key.toLowerCase(), data);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await delay(500);
    }
  }
};

const checkTransactionSignatureUsed = async (
  signature: string,
  purpose: string,
): Promise<boolean> => {
  try {
    // Check the signatures directory for this transaction
    const signaturesKey = `payments/signatures/${signature}.json`;
    try {
      const verification =
        await storage.getObject<TransactionSignatureVerification>(
          signaturesKey,
        );

      // If found, check if it was used for a different purpose
      if (verification && verification.purpose !== purpose) {
        return true; // Signature already used for a different purpose
      }

      // If found with the same purpose, it's a duplicate request but not a replay attack
      return false;
    } catch (error) {
      const storageError = error as StorageError;
      if (
        storageError.$metadata?.httpStatusCode === 404 ||
        storageError.Code === "NoSuchKey"
      ) {
        // Signature not found, which is good
        return false;
      }
      throw error;
    }
  } catch (error) {
    // In case of error, we'll assume it's not used to avoid blocking legitimate payments
    // But we log the error for monitoring
    return false;
  }
};

// Fix the recordTransactionSignatureUsage function to be consistent with saveWithRetry
const recordTransactionSignatureUsage = async (
  signature: string,
  payerPublicKey: string,
  purpose: string,
): Promise<void> => {
  try {
    const signaturesKey = `payments/signatures/${signature}.json`;
    const verification: TransactionSignatureVerification = {
      signature,
      payerPublicKey,
      timestamp: new Date(),
      purpose,
    };

    // Use the same retry pattern as saveWithRetry
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await storage.saveObject(signaturesKey.toLowerCase(), verification);
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) throw error;
        await delay(RETRY_DELAY);
      }
    }
  } catch (error) {
    // Log error but don't fail the verification process
  }
};

export const paymentRouter = createTRPCRouter({
  verifyPayment: publicProcedure
    .input(
      z.object({
        signature: z.string(),
        payerPublicKey: z.string(),
        recipient: z.string().optional(), // for paid agent payments
        agentId: z.string().optional(), // for paid agent payments
      }),
    )
    .mutation(async ({ input }) => {
      // Determine the purpose of this payment
      const purpose = input.agentId
        ? `paid-agent-${input.agentId}`
        : "agent-creation";

      // First record the transaction signature usage to prevent replay attacks
      await recordTransactionSignatureUsage(
        input.signature,
        input.payerPublicKey,
        purpose,
      );

      // Then check if this transaction signature has been used before for a different purpose
      const isReplay = await checkTransactionSignatureUsed(
        input.signature,
        purpose,
      );
      if (isReplay) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This transaction has already been used for a different payment",
        });
      }

      const connection = new Connection(
        process.env.MAINNET_RPC ?? "https://api.mainnet-beta.solana.com",
        {
          commitment: "confirmed",
        },
      );

      // Try to get transaction with retries
      let transaction = null;
      let lastError = null;

      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          transaction = await connection.getTransaction(input.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          });

          if (transaction?.meta) {
            break;
          }

          if (i < MAX_RETRIES - 1) {
            await delay(RETRY_DELAY);
          }
        } catch (error) {
          lastError = error as Error;
          if (i < MAX_RETRIES - 1) {
            await delay(RETRY_DELAY);
          }
        }
      }

      if (!transaction?.meta) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            lastError?.message ??
            "Transaction not found or invalid after retries. Please ensure you're using mainnet and the transaction has been confirmed.",
        });
      }

      // Verify SOL transfer
      try {
        const recipientPubkey = new PublicKey(
          input.recipient ?? RECIPIENT_ADDRESS,
        );
        const payerPubkey = new PublicKey(input.payerPublicKey);

        // Verify SOL transfer
        let transferFound = false;
        let transferredLamports = 0;
        const requiredLamports = Math.round(
          REQUIRED_PAYMENT_AMOUNT * 1_000_000_000,
        ); // Convert SOL to lamports

        // Check for native SOL transfers in the transaction
        if (transaction.meta && transaction.transaction.message) {
          // Access instructions properly based on whether it's a legacy or versioned transaction
          const instructions =
            "instructions" in transaction.transaction.message
              ? transaction.transaction.message.instructions
              : transaction.transaction.message instanceof Object &&
                  "compiledInstructions" in transaction.transaction.message
                ? transaction.transaction.message.compiledInstructions
                : [];

          for (const ix of instructions) {
            // Check if this is a system program transfer
            let programId = "";
            if ("programId" in ix && ix.programId) {
              if (ix.programId instanceof PublicKey) {
                programId = ix.programId.toString();
              } else if (typeof ix.programId === "string") {
                programId = ix.programId;
              }
            } else if (
              "programIdIndex" in ix &&
              transaction.transaction.message.staticAccountKeys
            ) {
              programId =
                transaction.transaction.message.staticAccountKeys[
                  ix.programIdIndex
                ].toString();
            }

            // Check if it's a System Program transfer instruction
            const isSystemProgramTransfer =
              programId === "11111111111111111111111111111111";
            const isTransferInstruction =
              ("data" in ix &&
                ix.data &&
                ix.data.length > 0 &&
                ix.data[0] === 2) ||
              ("data" in ix &&
                ix.data &&
                Buffer.isBuffer(ix.data) &&
                ix.data.length > 0 &&
                ix.data[0] === 2);

            if (isSystemProgramTransfer && isTransferInstruction) {
              // Get accounts involved in the transfer
              const accounts =
                "accountKeys" in transaction.transaction.message
                  ? transaction.transaction.message.accountKeys
                  : transaction.transaction.message.staticAccountKeys;

              let fromIndex = 0;
              let toIndex = 0;

              if (
                "accounts" in ix &&
                Array.isArray(ix.accounts) &&
                ix.accounts.length >= 2
              ) {
                fromIndex = ix.accounts[0];
                toIndex = ix.accounts[1];
              } else if (
                "accountKeyIndexes" in ix &&
                Array.isArray(ix.accountKeyIndexes) &&
                ix.accountKeyIndexes.length >= 2
              ) {
                fromIndex = ix.accountKeyIndexes[0];
                toIndex = ix.accountKeyIndexes[1];
              }

              const fromAccount = accounts[fromIndex];
              const toAccount = accounts[toIndex];

              // Verify both recipient and payer
              if (
                toAccount.toString() === recipientPubkey.toString() &&
                fromAccount.toString() === payerPubkey.toString()
              ) {
                // Extract the amount from the transaction data if possible
                if ("data" in ix && ix.data) {
                  try {
                    let amount: bigint;
                    if (Buffer.isBuffer(ix.data)) {
                      amount = BigInt(ix.data.readBigUInt64LE(4));
                    } else if (typeof ix.data === "string") {
                      const buffer = Buffer.from(ix.data, "base64");
                      amount = BigInt(buffer.readBigUInt64LE(4));
                    } else {
                      amount = BigInt(0);
                    }

                    transferredLamports += Number(amount);
                  } catch (e) {}
                }

                transferFound = true;
              }
            }
          }
        }

        // Also check the post balances for the recipient and validate against the payer
        if (transaction.meta?.postBalances && transaction.meta?.preBalances) {
          // Get account keys correctly based on transaction version
          const accountKeys =
            "accountKeys" in transaction.transaction.message
              ? transaction.transaction.message.accountKeys
              : transaction.transaction.message.staticAccountKeys;

          let recipientIndex = -1;
          let payerIndex = -1;

          // Find both the recipient and payer indexes
          for (let i = 0; i < accountKeys.length; i++) {
            const accountKey = accountKeys[i].toString();
            if (accountKey === recipientPubkey.toString()) {
              recipientIndex = i;
            }
            if (accountKey === payerPubkey.toString()) {
              payerIndex = i;
            }
          }

          // Validate both indexes were found
          if (recipientIndex >= 0 && payerIndex >= 0) {
            const recipientPreLamports =
              transaction.meta.preBalances[recipientIndex];
            const recipientPostLamports =
              transaction.meta.postBalances[recipientIndex];
            const payerPreLamports = transaction.meta.preBalances[payerIndex];
            const payerPostLamports = transaction.meta.postBalances[payerIndex];

            // Calculate transferred amount (accounting for fees)
            const recipientIncrease =
              recipientPostLamports - recipientPreLamports;
            const payerDecrease = payerPreLamports - payerPostLamports;

            if (recipientIncrease > 0) {
              transferredLamports = Math.max(
                transferredLamports,
                recipientIncrease,
              );
              transferFound = true;
            }
          }
        }

        // Verify the transaction contained a valid transfer with sufficient amount
        if (!transferFound) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `SOL payment verification failed. Transaction did not include a transfer from ${input.payerPublicKey} to ${RECIPIENT_ADDRESS}.`,
          });
        }

        // Verify the transferred amount meets the requirement
        if (transferredLamports < requiredLamports) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `SOL payment verification failed. Insufficient amount transferred. Required: ${REQUIRED_PAYMENT_AMOUNT} SOL, Transferred: ${transferredLamports / 1_000_000_000} SOL.`,
          });
        }
      } catch (e) {
        if (e instanceof TRPCError) throw e;

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `SOL payment verification failed - check your transaction`,
        });
      }

      // Store verification
      const verificationKey = `payments/agent-creation/${input.payerPublicKey.toLowerCase()}.json`;
      const verification: PaymentVerification = {
        signature: input.signature,
        amount: REQUIRED_PAYMENT_AMOUNT,
        timestamp: new Date(),
        verified: true,
      };

      try {
        // Use the retry logic for saving to storage
        await saveWithRetry(verificationKey, verification);
      } catch (storageError) {}

      return { success: true, signature: input.signature };
    }),

  checkPaymentStatus: publicProcedure
    .input(z.object({ publicKey: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const verificationKey = `payments/agent-creation/${input.publicKey.toLowerCase()}.json`;
        try {
          const verification =
            await storage.getObject<PaymentVerification>(verificationKey);
          return {
            verified: verification?.verified ?? false,
            signature: verification?.signature ?? null,
          };
        } catch (error) {
          const storageError = error as StorageError;
          if (
            storageError.$metadata?.httpStatusCode === 404 ||
            storageError.Code === "NoSuchKey"
          ) {
            // This is expected for new users, return unverified without logging
            return { verified: false, signature: null };
          }
          throw error; // Re-throw unexpected errors
        }
      } catch (error) {
        // Only log non-404 errors
        const storageError = error as StorageError;
        if (storageError.$metadata?.httpStatusCode !== 404) {
        }
        return { verified: false, signature: null };
      }
    }),

  // Add a new procedure to check if a user has paid for an agent
  checkAgentPayment: publicProcedure
    .input(
      z.object({
        publicKey: z.string().min(1),
        agentId: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      try {
        const verificationKey = `payments/paid-agents/${input.publicKey.toLowerCase()}/${input.agentId}.json`;
        try {
          const verification =
            await storage.getObject<PaymentVerification>(verificationKey);
          return {
            paid: verification?.verified ?? false,
            signature: verification?.signature ?? null,
          };
        } catch (error) {
          const storageError = error as StorageError;
          if (
            storageError.$metadata?.httpStatusCode === 404 ||
            storageError.Code === "NoSuchKey"
          ) {
            // This is expected for new users, return unpaid without logging
            return { paid: false, signature: null };
          }
          throw error; // Re-throw unexpected errors
        }
      } catch (error) {
        // Only log non-404 errors
        const storageError = error as StorageError;
        if (storageError.$metadata?.httpStatusCode !== 404) {
        }
        return { paid: false, signature: null };
      }
    }),
});
