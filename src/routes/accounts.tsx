import { createFileRoute } from "@tanstack/react-router";
import AccountsPage from "@/components/home/AccountsPage";

export const Route = createFileRoute("/accounts")({
  component: AccountsPage,
});
