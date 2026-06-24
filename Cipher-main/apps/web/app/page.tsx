"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { Button } from "@/components/ui/neon-button";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  async function login() {
    await api.login();
    toast.success("Demo analyst session started");
    router.push("/dashboard");
  }

  function requestRegistration(role: string) {
    toast.info(`${role}: registration request flow will be connected to your auth provider.`);
  }

  return (
    <main className="min-h-screen bg-background">
      <BackgroundPaths
        title="ShadowGraph KZ"
        subtitle="Authorized OSINT risk intelligence for public-source evidence, entity extraction, graph context, and reporting."
      >
        <Button
          onClick={login}
          className="min-h-12 rounded-xl px-6 text-base font-semibold shadow-md transition-transform duration-300 hover:-translate-y-0.5"
        >
          Войти в workspace
        </Button>
        <Button
          variant="outline"
          onClick={() => requestRegistration("Регистрация аналитика")}
          className="min-h-12 rounded-xl border-black/10 bg-white/80 px-6 text-base font-semibold text-black transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-black/80 dark:text-white dark:hover:bg-black"
        >
          Регистрация аналитика
        </Button>
        <Button
          variant="ghost"
          onClick={() => requestRegistration("Регистрация организации")}
          className="min-h-12 rounded-xl px-6 text-base font-semibold text-black transition-transform duration-300 hover:-translate-y-0.5 hover:bg-black/5 dark:text-white dark:hover:bg-white/10"
        >
          Регистрация организации
        </Button>
      </BackgroundPaths>
    </main>
  );
}

