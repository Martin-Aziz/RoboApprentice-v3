"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import { CommandPalette } from "@/components/command-palette";
import { useSessionStore } from "@/lib/store";
import { startExecutionSimulator } from "@/lib/execution-simulator";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <TooltipProvider delayDuration={200}>
          <ThemeBoot />
          <SessionBoot queryClient={queryClient} />
          {children}
          <CommandPalette />
        </TooltipProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function ThemeBoot() {
  return null;
}

function SessionBoot({ queryClient }: { queryClient: QueryClient }) {
  const initialize = useSessionStore((state) => state.initialize);
  useEffect(() => {
    let stopSimulator: (() => void) | undefined;
    initialize().then(() => {
      queryClient.invalidateQueries();
      stopSimulator = startExecutionSimulator(queryClient);
    });
    return () => stopSimulator?.();
  }, [initialize, queryClient]);
  return null;
}
