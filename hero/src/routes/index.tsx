import { createFileRoute } from "@tanstack/react-router";
import { Journey } from "@/journey/Journey";

// the page itself lives in journey/ so the main app can import it without pulling in this
// app's TanStack route registration
export const Route = createFileRoute("/")({
  component: Journey,
});
