"use client";

import { Wallet, Loader2 } from "lucide-react";
import {
  useUnifiedWallet,
  useUnifiedWalletContext,
} from "@jup-ag/wallet-adapter";
import React, { useState, useEffect } from "react";
import { useToast, handleWalletState } from "@/hooks/use-toast";

export const WalletButton = () => {
  const {
    wallet,
    publicKey,
    connected,
    connecting,
    disconnect,
    disconnecting,
  } = useUnifiedWallet();
  const { setShowModal } = useUnifiedWalletContext();
  const [isHovering, setIsHovering] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    if (connected && wallet) {
      await disconnect();
    } else {
      setShowModal(true);
    }
  };

  useEffect(() => {
    try {
      if (connected && publicKey) {
        handleWalletState.onConnect(publicKey.toString());
        toast({
          title: "Wallet Connected",
          description: `Connected to ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`,
        });
      } else if (!connected) {
        handleWalletState.onDisconnect();
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    }
  }, [connected, publicKey, toast]);

  return (
    <button
      onClick={handleClick}
      disabled={connecting || disconnecting}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        backgroundColor: "white",
        color: "black",
        borderRadius: "6px",
        padding: "8px 16px",
        fontWeight: "500",
        display: "inline-flex",
        alignItems: "center",
        fontSize: "12px",
        cursor: "pointer",
        border: "none",
        opacity: isHovering ? 0.75 : 1,
        transition: "opacity 300ms ease-in-out",
      }}
    >
      <Wallet
        style={{ marginRight: "8px", color: "black" }}
        className="h-4 w-4"
      />
      {connecting ? (
        <span className="flex flex-row">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
        </span>
      ) : connected && publicKey ? (
        `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
      ) : disconnecting ? (
        <span className="flex flex-row">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disconnecting...
        </span>
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
};
