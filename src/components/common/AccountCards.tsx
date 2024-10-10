import type { DatabaseInfo } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import { getChessComAccount, getStats } from "@/utils/chess.com/api";
import { getLichessAccount } from "@/utils/lichess/api";
import type { Session } from "@/utils/session";
import {
  Accordion,
  ActionIcon,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCheck, IconEdit, IconX } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { AccountCard } from "../home/AccountCard";

function AccountCards({
  databases,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
}) {
  const sessions = useAtomValue(sessionsAtom);
  const playerNames = Array.from(
    new Set(
      sessions.map(
        (s) => s.player ?? s.lichess?.username ?? s.chessCom?.username,
      ),
    ),
  );

  const playerSessions = playerNames.map((name) => ({
    name,
    sessions: sessions.filter(
      (s) =>
        s.player === name ||
        s.lichess?.username === name ||
        s.chessCom?.username === name,
    ),
  }));

  return (
    <ScrollArea offsetScrollbars>
      <Stack>
        {playerSessions.map(({ name, sessions }) => (
          <PlayerSession
            key={name}
            name={name!}
            sessions={sessions}
            databases={databases}
            setDatabases={setDatabases}
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
}: {
  name: string;
  sessions: Session[];
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
}) {
  const [, setSessions] = useAtom(sessionsAtom);
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(name);
  useEffect(() => {
    setText(name);
  }, [name]);
  const ref = useRef(null);

  return (
    <Paper withBorder>
      <Group justify="space-between" py="xs" px="md">
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
              onClick={() => {
                setEdit(true);
              }}
            >
              <IconEdit />
            </ActionIcon>
          )}
          <ActionIcon
            size="sm"
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
      <Accordion multiple chevronSize={0}>
        {sessions.map((session, i) => (
          <LichessOrChessCom
            key={i}
            session={session}
            databases={databases}
            setDatabases={setDatabases}
            setSessions={setSessions}
          />
        ))}
      </Accordion>
    </Paper>
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
        database={
          databases.find(
            (db) => db.filename === `${account.username}_lichess.db3`,
          ) ?? null
        }
        title={account.username}
        updatedAt={session.updatedAt}
        total={totalGames}
        logout={() => {
          setSessions((sessions) =>
            sessions.filter((s) => s.lichess?.account.id !== account.id),
          );
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
          databases.find(
            (db) =>
              db.filename === `${session.chessCom?.username}_chesscom.db3`,
          ) ?? null
        }
        updatedAt={session.updatedAt}
        total={totalGames}
        stats={getStats(session.chessCom.stats)}
        logout={() => {
          setSessions((sessions) =>
            sessions.filter(
              (s) => s.chessCom?.username !== session.chessCom?.username,
            ),
          );
        }}
        reload={async () => {
          if (!session.chessCom) return;
          const stats = await getChessComAccount(session.chessCom?.username);
          if (!stats) return;
          setSessions((sessions) =>
            sessions.map((s) =>
              session.chessCom &&
              s.chessCom?.username === session.chessCom?.username
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
