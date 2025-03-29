import { Button } from "@/app/_components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function TokenInfo() {
  const { toast } = useToast();
  const contractAddress = "8SFA7dR3oHsdG4H7DSBar92m8UqTEUy5F2Wxc5Ufpump";
  const tokenName = "$KANEKI";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      toast({
        title: "Copied!",
        description: "Contract address copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-lg bg-card p-4 shadow-lg sm:flex-row">
      <span className="whitespace-nowrap text-lg font-semibold">
        {tokenName}
      </span>
      <div className="hidden h-4 w-px bg-border sm:block" />
      <div className="h-px w-full bg-border sm:hidden" />
      <div className="flex w-full items-center justify-center gap-2 sm:w-auto">
        <code className="break-all rounded bg-muted px-2 py-1 text-sm">
          {contractAddress}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
