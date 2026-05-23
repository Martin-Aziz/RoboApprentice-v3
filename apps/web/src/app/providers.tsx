"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import { CommandPalette } from "@/components/command-palette";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
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
          {children}
          <CommandPalette />
        </TooltipProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function ThemeBoot() {
  useEffect(() => {
    const stored = localStorage.getItem("aurevix_theme");
    const theme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  }, []);
  return null;
}
