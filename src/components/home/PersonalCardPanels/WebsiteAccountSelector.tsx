import { Group, Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import type { PlayerGameInfo } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";

interface WebsiteAccountSelectorProps {
  playerName: string;
  onWebsiteChange: (website: string | null) => void;
  onAccountChange: (account: string | null) => void;
  allowAll: boolean;
  /** Usernames that have En Croissant engine games tracked locally */
  encUsernames?: string[];
  /** When stats already include En Croissant (e.g. after merge), show the card even if username list is stale */
  info?: PlayerGameInfo;
}

const WebsiteAccountSelector = ({
  playerName,
  onWebsiteChange,
  onAccountChange,
  allowAll,
  encUsernames = [],
  info,
}: WebsiteAccountSelectorProps) => {
  const sessions = useAtomValue(sessionsAtom);

  const websites = [];
  if (sessions.some((s) => s.player === playerName && s.chessCom?.username)) {
    websites.push({ value: "Chess.com", label: "Chess.com" });
  }
  if (sessions.some((s) => s.player === playerName && s.lichess?.username)) {
    websites.push({ value: "Lichess", label: "Lichess" });
  }
  const matchedEncUser = encUsernames.find((u) => u.toLowerCase() === playerName.toLowerCase());
  const encInStats = info?.site_stats_data.some((s) => s.site === "En Croissant");
  if (matchedEncUser !== undefined || encInStats) {
    websites.push({ value: "En Croissant", label: "En Croissant" });
  }

  if (allowAll) {
    websites.unshift({ value: "All websites", label: "All websites" });
  }

  const [website, setWebsite] = useState<string | null>(websites[0]?.value);
  const [account, setAccount] = useState<string | null>("All accounts");

  useEffect(() => {
    onWebsiteChange(website);
  }, [website]);

  useEffect(() => {
    onAccountChange(account);
  }, [account]);

  const encAccountLabel =
    matchedEncUser ??
    info?.site_stats_data.find((s) => s.site === "En Croissant")?.player ??
    playerName;

  const accounts = ["All accounts"].concat(
    website === "En Croissant"
      ? [encAccountLabel]
      : sessions
          .filter(
            (s) =>
              s.player === playerName &&
              ((website === "Chess.com" && s.chessCom?.username) ||
                (website === "Lichess" && s.lichess?.username)),
          )
          .map((s) => s.chessCom?.username || s.lichess?.username)
          .filter((username): username is string => username !== undefined && username !== null),
  );

  return (
    <Group grow>
      <Select
        pt="lg"
        label="Website"
        value={website}
        onChange={(value) => {
          setWebsite(value);
          setAccount("All accounts");
        }}
        data={websites}
        allowDeselect={false}
      />
      {website !== "All websites" && accounts.filter((a) => a !== "All accounts").length > 1 && (
        <Select
          pt="lg"
          label="Account"
          value={account}
          onChange={(value) => setAccount(value)}
          data={accounts}
          allowDeselect={false}
        />
      )}
    </Group>
  );
};

export default WebsiteAccountSelector;
