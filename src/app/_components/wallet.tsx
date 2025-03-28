"use client";

import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import type { Cluster } from "@solana/web3.js";
import type { WalletProviderProps } from "@/types/wallet";

const WALLET_CONFIG = {
  autoConnect: true,
  env: "mainnet-beta" as Cluster,
  metadata: {
    name: "Kaneki",
    description:
      "Kaneki - Create AI Agents & Backroom on the Solana blockchain.",
    url: "https://kaneki.fun/",
    iconUrls: ["/favicon.ico"] as string[],
  },
  theme: "dark" as const,
  lang: "en" as const,
};

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <UnifiedWalletProvider wallets={[]} config={WALLET_CONFIG}>
      {children}
    </UnifiedWalletProvider>
  );
}
