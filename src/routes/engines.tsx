import { createFileRoute } from "@tanstack/react-router";

function EnginesRemoved() {
  return null;
}

export const Route = createFileRoute("/engines")({
  component: EnginesRemoved,
});
