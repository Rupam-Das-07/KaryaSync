import { createClient, API_BASE_URL } from "@/utils/supabase/client";

export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  const apiBase = API_BASE_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Run checks in parallel for better performance
    const [userRes, prefsRes] = await Promise.all([
      fetch(`${apiBase}/users/${userId}`, { signal: controller.signal }),
      fetch(`${apiBase}/users/${userId}/job-preferences`, { signal: controller.signal })
    ]);

    clearTimeout(timeoutId);

    if (!userRes.ok) return false;
    const userData = await userRes.json();

    // Check if full_name is set
    if (!userData.full_name) return false;

    // Check if job preferences exist (prefsRes.ok means 200 OK, so it exists)
    // If 404, it returns false
    if (!prefsRes.ok) return false;

    return true;
  } catch (error: any) {
    // If it's a timeout or network error, fail open (allow access to dashboard)
    // instead of forcing user back to onboarding.
    if (error.name === 'AbortError') {
      // Silently fail open on timeout
      return true;
    }
    console.warn("Soft fail checking onboarding status (Backend offline?):", error);
    // For other errors (like network failure), also fail open to avoid blocking the user.
    return true;
  }
}
