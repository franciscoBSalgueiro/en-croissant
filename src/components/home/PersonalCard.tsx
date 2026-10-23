import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Flex,
  Group,
  Tooltip as MTTooltip,
  Paper,
  ScrollArea,
  Select,
  Tabs,
  Text,
} from "@mantine/core";
import { IconInfoCircle, IconUser } from "@tabler/icons-react";
import * as Flags from "mantine-flagpack";
import "mantine-flagpack/styles.css";
import useSWRImmutable from "swr/immutable";
import { useAtomValue } from "jotai";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { PlayerGameInfo } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import type { DatabaseViewStore } from "@/state/store/database";
import { getFidePlayer } from "@/utils/lichess/api";
import { isMatchingFidePlayer } from "@/utils/fideMatch";
import COUNTRIES from "../databases/countries.json";
import classes from "./PersonalCard.module.css";
import { DatabaseViewStateContext } from "../databases/DatabaseViewStateContext";
import FideInfo from "../databases/FideInfo";
import OpeningsPanel from "./PersonalCardPanels/OpeningsPanel";
import OverviewPanel from "./PersonalCardPanels/OverviewPanel";
import RatingsPanel from "./PersonalCardPanels/RatingsPanel";

function PersonalPlayerCard({
  name,
  setName,
  info,
  isDatabase,
}: {
  name: string;
  setName?: (name: string) => void;
  info: PlayerGameInfo;
  isDatabase?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const store = useContext(DatabaseViewStateContext)!;
  const activeTab = useStore(store, (s) => s.players.activeTab);
  const setActiveTab = useStore(store, (s) => s.setPlayersActiveTab);

  const [opened, setOpened] = useState(false);
  const { data: fideMatch } = useSWRImmutable(
    isDatabase ? ["fide-profile", name] : null,
    () => getFidePlayer(name),
    { shouldRetryOnError: false },
  );
  const fide = isMatchingFidePlayer(name, fideMatch) ? fideMatch : undefined;
  const country = COUNTRIES.find((c) => c.ioc === fide?.federation);
  const countryName = country
    ? (new Intl.DisplayNames([i18n.resolvedLanguage ?? "en-US"], { type: "region" }).of(
        country.a2,
      ) ?? country.name)
    : undefined;
  const Flag = Object.entries(Flags).find(([key]) => key === `${country?.a2}Flag`)?.[1];
  const sessions = useAtomValue(sessionsAtom);
  // In alphabetical order, as on the rest of the Accounts page
  const players = Array.from(
    new Set(sessions.map((s) => s.player || s.lichess?.username || s.chessCom?.username || "")),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <Paper
      h="100%"
      shadow="sm"
      p="md"
      withBorder
      className={classes.profile}
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <FideInfo key={name} opened={opened} setOpened={setOpened} name={name} />
      <Box pos="relative" mb={isDatabase ? "md" : undefined}>
        {name !== "Stats" && (
          <MTTooltip label={t("Databases.FIDE.Info")}>
            <ActionIcon
              pos="absolute"
              right={0}
              top={isDatabase ? "1rem" : undefined}
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
              allowDeselect={false}
              fw="bold"
              styles={{
                input: {
                  textAlign: "center",
                  fontSize: "1.25rem",
                },
              }}
            />
          </Flex>
        ) : isDatabase ? (
          <Group wrap="nowrap" pr="xl" gap="md">
            <Avatar src={fide?.photo?.small} size={64} radius="sm">
              <IconUser size={30} />
            </Avatar>
            <Box style={{ minWidth: 0 }}>
              <Group gap="sm">
                <Text className={classes.name}>{name}</Text>
                {fide?.title && (
                  <Badge variant="default" size="sm">
                    {fide.title}
                  </Badge>
                )}
              </Group>
              <Group gap="sm" mt={4}>
                {country && (
                  <Group gap={6}>
                    {Flag && <Flag size={20} />}
                    <Text c="dimmed" size="sm">
                      {t("Home.Personal.Federation", { country: countryName })}
                    </Text>
                  </Group>
                )}
                {fide?.year && (
                  <Text c="dimmed" size="sm">
                    {t("Databases.FIDE.Born", { year: fide.year })}
                  </Text>
                )}
              </Group>
            </Box>
          </Group>
        ) : (
          <Text fz="lg" fw={500} ta="center">
            {name}
          </Text>
        )}
      </Box>
      <Tabs
        className={classes.tabs}
        mt="xs"
        keepMounted={false}
        value={activeTab}
        onChange={(v) => setActiveTab(v as DatabaseViewStore["players"]["activeTab"])}
        variant="outline"
        flex={1}
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview">{t("Home.Personal.Overview")}</Tabs.Tab>
          <Tabs.Tab value="ratings">{t("Home.Personal.Ratings")}</Tabs.Tab>
          <Tabs.Tab value="openings">{t("Home.Personal.Openings")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview" className={classes.panel}>
          <ScrollArea
            h="100%"
            type="auto"
            offsetScrollbars="y"
            scrollbarSize={6}
            classNames={{ viewport: classes.overviewViewport }}
          >
            <OverviewPanel playerName={name} info={info} isDatabase={isDatabase} />
          </ScrollArea>
        </Tabs.Panel>
        <Tabs.Panel value="openings" className={classes.panel} style={{ overflow: "hidden" }}>
          <OpeningsPanel playerName={name} info={info} isDatabase={isDatabase} />
        </Tabs.Panel>
        <Tabs.Panel value="ratings" className={classes.panel}>
          <ScrollArea
            h="100%"
            type="auto"
            offsetScrollbars="y"
            scrollbarSize={6}
            classNames={{ viewport: classes.overviewViewport }}
          >
            <RatingsPanel playerName={name} info={info} isDatabase={isDatabase} />
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}

export default PersonalPlayerCard;
