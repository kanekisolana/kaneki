import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PaymentVerification {
  type: string;
  timestamp: Date;
}

interface PaymentState {
  verifiedTransactions: Map<string, PaymentVerification[]>;
  addVerifiedTransaction: (publicKey: string, type: string) => void;
  isWalletVerified: (publicKey: string) => boolean;
}

interface StorageValue {
  state: {
    verifiedTransactions: Map<string, PaymentVerification[]>;
  };
}

interface SerializedStorageValue {
  state: {
    verifiedTransactions: [string, PaymentVerification[]][];
  };
}

export const usePaymentStore = create<PaymentState>()(
  persist(
    (set, get) => ({
      verifiedTransactions: new Map(),
      addVerifiedTransaction: (publicKey: string, type: string) =>
        set((state) => {
          const transactions = state.verifiedTransactions.get(publicKey) ?? [];
          const newMap = new Map(state.verifiedTransactions);
          newMap.set(publicKey, [
            ...transactions,
            { type, timestamp: new Date() },
          ]);
          return { verifiedTransactions: newMap };
        }),
      isWalletVerified: (publicKey: string) => {
        const transactions = get().verifiedTransactions.get(publicKey);
        if (!transactions) return false;

        return transactions.some((tx) => tx.type === "agent-creation");
      },
    }),
    {
      name: "payment-store",
      storage: {
        getItem: (name): StorageValue | null => {
          const str = localStorage.getItem(name);
          if (!str) return null;

          const data = JSON.parse(str) as SerializedStorageValue;
          if (!data.state?.verifiedTransactions) return null;

          const entries = data.state.verifiedTransactions;
          const map = new Map(
            entries.map(([key, txs]) => [
              key,
              txs.map((tx) => ({
                ...tx,
                timestamp: new Date(tx.timestamp),
              })),
            ]),
          );

          return {
            state: {
              verifiedTransactions: map,
            },
          };
        },
        setItem: (name, value: StorageValue): void => {
          const data: SerializedStorageValue = {
            state: {
              verifiedTransactions: Array.from(
                value.state.verifiedTransactions.entries(),
              ),
            },
          };
          localStorage.setItem(name, JSON.stringify(data));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
