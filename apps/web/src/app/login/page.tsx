import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[rgb(var(--ink))] p-6">
      <div className="max-w-md rounded-lg border border-[rgb(var(--steel))] bg-[rgb(var(--ink-2))] p-8 text-center">
        <h1 className="text-2xl font-semibold">Authentication is disabled in demo mode.</h1>
        <p className="mt-3 text-[rgb(var(--bone-2))]">The v2 demo opens directly into the console.</p>
        <Button asChild className="mt-6">
          <Link href="/app">Go to console</Link>
        </Button>
      </div>
    </main>
  );
}

