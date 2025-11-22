import { sessionsAtom } from "@/state/atoms";
import { Group, Select } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

interface WebsiteAccountSelectorProps {
  playerName: string;
  onWebsiteChange: (website: string | null) => void;
  onAccountChange: (account: string | null) => void;
  allowAll: boolean;
}

const WebsiteAccountSelector = ({
  playerName,
  onWebsiteChange,
  onAccountChange,
  allowAll,
}: WebsiteAccountSelectorProps) => {
  const sessions = useAtomValue(sessionsAtom);

  const websites = [];
  if (sessions.some((s) => s.player === playerName && s.chessCom?.username)) {
    websites.push({ value: "Chess.com", label: "Chess.com" });
  }
  if (
    sessions.some(
      (s) => s.lichess?.username && s.lichess?.username === playerName,
    )
  ) {
    websites.push({ value: "Lichess", label: "Lichess" });
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

  const accounts = ["All accounts"].concat(
    sessions
      .filter(
        (s) =>
          s.player === playerName &&
          ((website === "Chess.com" && s.chessCom?.username) ||
            (website === "Lichess" && s.lichess?.username)),
      )
      .map((s) => s.chessCom?.username || s.lichess?.username)
      .filter(
        (username): username is string =>
          username !== undefined && username !== null,
      ),
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
      {website !== "All websites" && (
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
