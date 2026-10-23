import {
  ActionIcon,
  Box,
  Divider,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCheck, IconEdit, IconX } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DatabaseInfo } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import { cardGrid } from "@/utils/cardGrid";
import { getChessComAccount, getStats } from "@/utils/chess.com/api";
import { getLichessAccount } from "@/utils/lichess/api";
import type { Session } from "@/utils/session";
import { AccountCard } from "../home/AccountCard";
import { EmptyAccounts } from "../home/EmptyAccounts";

// The cards' width, in rem so it follows the app's font size. The narrowest a card can be: its
// header (logo, name, buttons) still fits
const MIN_CARD_SIZE = 18;
// The widest, so a wide window fits more cards rather than wider ones
const MAX_CARD_SIZE = 21;
// The Group's gap between the cards: Mantine's md spacing
const GAP = 1;
// A player's Lichess and Chess.com cards side by side
const CARDS_PER_ROW = 2;

function remToPx(rem: number) {
  return rem * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
}

// An element's width, measured as the element appears, before it's painted (Mantine's
// useElementSize reports it a frame later, and never for an element that appears after its
// component first rendered), then again whenever it changes
function useMeasuredWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function AccountCards({
  databases,
  setDatabases,
  onAddAccount,
}: {
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
  onAddAccount: () => void;
}) {
  const sessions = useAtomValue(sessionsAtom);
  const playerNames = Array.from(
    new Set(sessions.map((s) => s.player ?? s.lichess?.username ?? s.chessCom?.username)),
  );

  const playerSessions = playerNames.map((name) => ({
    name,
    sessions: sessions.filter(
      (s) => s.player === name || s.lichess?.username === name || s.chessCom?.username === name,
    ),
  }));

  if (sessions.length === 0) {
    return <EmptyAccounts onAddAccount={onAddAccount} />;
  }

  return (
    <PlayerSessions
      playerSessions={playerSessions}
      databases={databases}
      setDatabases={setDatabases}
    />
  );
}

// Every player's cards, measured as they're first shown, so the first account added gets its
// card at once and no card is ever drawn without its width
function PlayerSessions({
  playerSessions,
  databases,
  setDatabases,
}: {
  playerSessions: { name: string | undefined; sessions: Session[] }[];
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
}) {
  // Every card is as wide, sized for the width they have (and as tall: see AccountCard)
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const { cardSize } = cardGrid(
    width,
    remToPx(GAP),
    remToPx(MIN_CARD_SIZE),
    remToPx(MAX_CARD_SIZE),
    CARDS_PER_ROW,
  );

  return (
    <ScrollArea offsetScrollbars>
      <Stack ref={ref}>
        {/* Once its width is known, which is before it's painted */}
        {width > 0 &&
          playerSessions.map(({ name, sessions }) => (
            <PlayerSession
              key={name}
              name={name!}
              sessions={sessions}
              databases={databases}
              setDatabases={setDatabases}
              cardSize={cardSize}
            />
          ))}
      </Stack>
    </ScrollArea>
  );
}

function PlayerSession({
  name,
  sessions,
  databases,
  setDatabases,
  cardSize,
}: {
  name: string;
  sessions: Session[];
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
  cardSize: number;
}) {
  const [, setSessions] = useAtom(sessionsAtom);
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(name);
  useEffect(() => {
    setText(name);
  }, [name]);
  const ref = useRef(null);

  return (
    <Stack mt="sm">
      <Group justify="space-between" align="center">
        {edit ? (
          <TextInput
            ref={ref}
            variant="unstyled"
            fw="bold"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            styles={{
              input: {
                fontSize: "1.1rem",
                textDecoration: "underline",
              },
            }}
            autoFocus
          />
        ) : (
          <Text fz="lg" fw="bold">
            {name}
          </Text>
        )}
        <Group>
          {edit ? (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="green"
              onClick={() => {
                setEdit(false);
                setSessions((prev) =>
                  prev.map((s) => {
                    if (sessions.includes(s)) {
                      return {
                        ...s,
                        player: text,
                      };
                    }
                    return s;
                  }),
                );
              }}
            >
              <IconCheck />
            </ActionIcon>
          ) : (
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => {
                setEdit(true);
              }}
            >
              <IconEdit />
            </ActionIcon>
          )}
          <ActionIcon
            size="sm"
            variant="subtle"
            color="red"
            onClick={() =>
              setSessions((sessions) =>
                sessions.filter(
                  (s) =>
                    s.player !== name &&
                    s.lichess?.username !== name &&
                    s.chessCom?.username !== name,
                ),
              )
            }
          >
            <IconX />
          </ActionIcon>
        </Group>
      </Group>
      <Divider />
      <Group>
        {sessions.map((session, i) => (
          <Box key={i} style={{ width: cardSize }}>
            <LichessOrChessCom
              session={session}
              databases={databases}
              setDatabases={setDatabases}
              setSessions={setSessions}
            />
          </Box>
        ))}
      </Group>
    </Stack>
  );
}

function LichessOrChessCom({
  session,
  databases,
  setDatabases,
  setSessions,
}: {
  session: Session;
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
}) {
  if (session.lichess?.account) {
    const account = session.lichess.account;
    const lichessSession = session.lichess;
    const totalGames =
      (account.perfs?.ultraBullet?.games ?? 0) +
      (account.perfs?.bullet?.games ?? 0) +
      (account.perfs?.blitz?.games ?? 0) +
      (account.perfs?.rapid?.games ?? 0) +
      (account.perfs?.classical?.games ?? 0) +
      (account.perfs?.correspondence?.games ?? 0);

    const stats = [];
    const speeds = ["bullet", "blitz", "rapid", "classical"] as const;

    if (account.perfs) {
      for (const speed of speeds) {
        const perf = account.perfs[speed];
        if (perf) {
          stats.push({
            value: perf.rating,
            label: speed,
            diff: perf.prog,
          });
        }
      }
    }

    return (
      <AccountCard
        key={account.id}
        token={lichessSession.accessToken}
        type="lichess"
        database={databases.find((db) => db.filename === `${account.username}_lichess.db3`) ?? null}
        title={account.username}
        updatedAt={session.updatedAt}
        total={totalGames}
        logout={() => {
          setSessions((sessions) => sessions.filter((s) => s.lichess?.account.id !== account.id));
        }}
        setDatabases={setDatabases}
        reload={async () => {
          const account = await getLichessAccount({
            token: lichessSession.accessToken,
            username: lichessSession.username,
          });
          if (!account) return;
          setSessions((sessions) =>
            sessions.map((s) =>
              s.lichess?.account.id === account.id
                ? {
                    ...s,
                    lichess: {
                      account: account,
                      username: lichessSession.username,
                      accessToken: lichessSession.accessToken,
                    },
                    updatedAt: Date.now(),
                  }
                : s,
            ),
          );
        }}
        stats={stats}
      />
    );
  }
  if (session.chessCom?.stats) {
    let totalGames = 0;
    for (const stat of Object.values(session.chessCom.stats)) {
      if (stat.record) {
        totalGames += stat.record.win + stat.record.loss + stat.record.draw;
      }
    }
    return (
      <AccountCard
        key={session.chessCom.username}
        type="chesscom"
        title={session.chessCom.username}
        database={
          databases.find((db) => db.filename === `${session.chessCom?.username}_chesscom.db3`) ??
          null
        }
        updatedAt={session.updatedAt}
        total={totalGames}
        stats={getStats(session.chessCom.stats)}
        logout={() => {
          setSessions((sessions) =>
            sessions.filter((s) => s.chessCom?.username !== session.chessCom?.username),
          );
        }}
        reload={async () => {
          if (!session.chessCom) return;
          const stats = await getChessComAccount(session.chessCom?.username);
          if (!stats) return;
          setSessions((sessions) =>
            sessions.map((s) =>
              session.chessCom && s.chessCom?.username === session.chessCom?.username
                ? {
                    ...s,
                    chessCom: {
                      username: session.chessCom?.username,
                      stats,
                    },
                    updatedAt: Date.now(),
                  }
                : s,
            ),
          );
        }}
        setDatabases={setDatabases}
      />
    );
  }
}

export default AccountCards;
