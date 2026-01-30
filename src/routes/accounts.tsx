import AccountsPage from "@/components/home/AccountsPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/accounts")({
  component: AccountsPage,
});
