import { Routes, Route } from "react-router-dom";
import { ClerkProvider, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import { BrandSplash } from "./components/BrandSplash";
import { hasClerk, hasSupabase } from "./lib/saath/config";
import { UnconfiguredApp } from "./auth/UnconfiguredApp";
import { SignInPage, SignUpPage } from "./auth/AuthPages";
import { clerkAppearance } from "./components/saath/clerkAppearance";
import { RootGate } from "./auth/RootGate";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/** everything behind the landing page: auth, the dashboard and their heavy dependencies
 * (maps, charts, Supabase, Clerk). Loaded on demand so the landing route never pays for it. */
export default function AppShell() {
  const isFakeKey = clerkKey === "pk_test_Y2xlcmsuZmFrZS5jb20k";
  if (!hasClerk || !hasSupabase || isFakeKey) return <UnconfiguredApp />;
  return (
    <ClerkProvider
      publishableKey={clerkKey as string}
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
    >
      <ClerkLoading>
        <BrandSplash />
      </ClerkLoading>
      <ClerkLoaded>
        <Routes>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="*" element={<RootGate />} />
        </Routes>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
