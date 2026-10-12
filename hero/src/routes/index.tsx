import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/landing/Landing";

// the page itself lives in landing/Landing so the main app can import it without pulling in
// this app's TanStack route registration
export const Route = createFileRoute("/")({
  component: Landing,
});
