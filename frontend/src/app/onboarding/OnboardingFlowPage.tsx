"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import OnboardingWizard from "@/components/OnboardingWizard";
import { Loader2 } from "lucide-react";
import { checkOnboardingStatus } from "@/utils/onboarding";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const isComplete = await checkOnboardingStatus(user.id);
        if (isComplete) {
          router.push("/dashboard");
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error("Auth check failed", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return <OnboardingWizard />;
}
