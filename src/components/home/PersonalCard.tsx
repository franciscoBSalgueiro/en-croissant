import type { PlayerGameInfo } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import type { DatabaseViewStore } from "@/state/store/database";
import {
  ActionIcon,
  Box,
  Flex,
  Tooltip as MTTooltip,
  Paper,
  Select,
  Tabs,
  Text,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useContext, useState } from "react";
import { useStore } from "zustand";
import { DatabaseViewStateContext } from "../databases/DatabaseViewStateContext";
import FideInfo from "../databases/FideInfo";
import OpeningsPanel from "./PersonalCardPanels/OpeningsPanel";
import OverviewPanel from "./PersonalCardPanels/OverviewPanel";
import RatingsPanel from "./PersonalCardPanels/RatingsPanel";

function PersonalPlayerCard({
  name,
  setName,
  info,
}: {
  name: string;
  setName?: (name: string) => void;
  info: PlayerGameInfo;
}) {
  const store = useContext(DatabaseViewStateContext)!;
  const activeTab = useStore(store, (s) => s.players.activeTab);
  const setActiveTab = useStore(store, (s) => s.setPlayersActiveTab);

  const [opened, setOpened] = useState(false);
  const sessions = useAtomValue(sessionsAtom);
  const players = Array.from(
    new Set(
      sessions.map(
        (s) => s.player || s.lichess?.username || s.chessCom?.username || "",
      ),
    ),
  );

  return (
    <Paper
      h="100%"
      shadow="sm"
      p="md"
      withBorder
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <FideInfo key={name} opened={opened} setOpened={setOpened} name={name} />
      <Box pos="relative">
        {name !== "Stats" && (
          <MTTooltip label="FIDE info">
            <ActionIcon
              pos="absolute"
              right={0}
              onClick={() => setOpened(true)}
            >
              <IconInfoCircle />
            </ActionIcon>
          </MTTooltip>
        )}
        {setName ? (
          <Flex justify="center">
            <Select
              value={name}
              data={players}
              onChange={(e) => setName(e || "")}
              clearable={false}
              fw="bold"
              styles={{
                input: {
                  textAlign: "center",
                  fontSize: "1.25rem",
                },
              }}
            />
          </Flex>
        ) : (
          <Text fz="lg" fw={500} ta="center">
            {name}
          </Text>
        )}
      </Box>
      <Tabs
        mt="xs"
        keepMounted={false}
        value={activeTab}
        onChange={(v) =>
          setActiveTab(v as DatabaseViewStore["players"]["activeTab"])
        }
        variant="outline"
        flex={1}
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="ratings">Ratings</Tabs.Tab>
          <Tabs.Tab value="openings">Openings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">
          <OverviewPanel playerName={name} info={info} />
        </Tabs.Panel>
        <Tabs.Panel value="openings" style={{ overflow: "hidden" }}>
          <OpeningsPanel playerName={name} info={info} />
        </Tabs.Panel>
        <Tabs.Panel value="ratings">
          <RatingsPanel playerName={name} info={info} />
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}

export default PersonalPlayerCard;
