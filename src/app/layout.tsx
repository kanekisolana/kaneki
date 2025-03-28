import type React from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "./_components/theme-provider";
import { Toaster } from "./_components/ui/toaster";
import { TRPCReactProvider } from "@/trpc/react";
import { WalletProvider } from "./_components/wallet";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Kaneki - AI Agents on Solana",
  description: "Create and interact with AI agents on the Solana blockchain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <TRPCReactProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <WalletProvider>{children}</WalletProvider>
            <Toaster />
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
