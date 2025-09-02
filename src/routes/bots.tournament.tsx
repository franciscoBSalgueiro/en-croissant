import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useAtom } from "jotai";
import { botsAtom, tabsAtom, activeTabAtom } from "@/state/atoms";
import type { Bot } from "@/utils/bots";
import { genID } from "@/utils/tabs";
import { useEffect, useMemo } from "react";

const searchSchema = z.object({
  ids: z.string().optional(), // comma-separated bot ids
});

export const Route = createFileRoute("/bots/tournament")({
  component: BotTournamentRedirect,
  validateSearch: searchSchema,
});

function BotTournamentRedirect() {
  const { ids } = Route.useSearch();
  const [bots] = useAtom(botsAtom);
  const [, setTabs] = useAtom(tabsAtom);
  const [, setActiveTab] = useAtom(activeTabAtom);
  const navigate = useNavigate();

  const selected: Bot[] = useMemo(() => {
    const idList = (ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    const set = new Set(idList);
    const list = (Array.isArray(bots) ? bots : []).filter((b) => set.has(b.id));
    return list;
  }, [ids, bots]);

  useEffect(() => {
    const idsArr = selected.map((b) => b.id);
    if (!idsArr || idsArr.length < 2) {
      navigate({ to: "/bots" });
      return;
    }
    const id = genID();
    sessionStorage.setItem(`tournament-${id}`, JSON.stringify({ botIds: idsArr }));
    setTabs((prev) => [...prev, { name: "Tournament", value: id, type: "play" } as any]);
    setActiveTab(id);
    navigate({ to: "/" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.length]);

  return null;
}
export default function Dummy() { return null; }
