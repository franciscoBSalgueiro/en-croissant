import { events, type MonthData, type Results, commands } from "@/bindings";
import type { DatabaseInfo as PlainDatabaseInfo, Player } from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import { type PlayerGameInfo, getDatabases, query_players } from "@/utils/db";
import type { Session } from "@/utils/session";
import { unwrap } from "@/utils/unwrap";
import { Flex, Progress, Select, Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import PersonalPlayerCard from "./PersonalCard";

type DatabaseInfo = PlainDatabaseInfo & {
  username?: string;
};

function getSessionUsername(session: Session): string {
  const username =
    session.lichess?.account.username || session.chessCom?.username;
  if (username === undefined) {
    throw new Error("Session does not have a username");
  }
  return username;
}

function isDatabaseFromSession(db: DatabaseInfo, sessions: Session[]) {
  const session = sessions.find((session) =>
    db.filename.includes(getSessionUsername(session)),
  );

  if (session !== undefined) {
    db.username = getSessionUsername(session);
  }
  return session !== undefined;
}

interface PersonalInfo {
  db: DatabaseInfo;
  info: PlayerGameInfo;
}

function sumGamesPlayed(lists: [string, Results][][]) {
  const openingCounts = new Map<string, Results>();

  for (const list of lists) {
    for (const [opening, count] of list) {
      const prev = openingCounts.get(opening) || { won: 0, draw: 0, lost: 0 };
      openingCounts.set(opening, {
        won: prev.won + count.won,
        draw: prev.draw + count.draw,
        lost: prev.lost + count.lost,
      });
    }
  }

  return Array.from(openingCounts.entries()).sort(
    (a, b) =>
      b[1].won + b[1].draw + b[1].lost - a[1].won - a[1].draw - a[1].lost,
  );
}

function joinMonthData(data: [string, MonthData][][]) {
  const monthCounts = new Map<string, MonthData & { avg_count: number }>();

  for (const list of data) {
    for (const [month, monthData] of list) {
      if (monthCounts.has(month)) {
        const oldData = monthCounts.get(month);
        if (oldData) {
          monthCounts.set(month, {
            count: oldData.count + monthData.count,
            avg_elo: oldData.avg_elo + monthData.avg_elo,
            avg_count: oldData.avg_count + 1,
          });
        }
      } else {
        monthCounts.set(month, { ...monthData, avg_count: 1 });
      }
    }
  }
  for (const [month, monthData] of monthCounts) {
    monthCounts.set(month, {
      count: monthData.count,
      avg_elo: monthData.avg_elo / monthData.avg_count,
      avg_count: monthData.avg_count,
    });
  }

  return Array.from(monthCounts.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
}

function combinePlayerInfo(playerInfos: PlayerGameInfo[]) {
  const combined: PlayerGameInfo = {
    won: playerInfos.reduce((acc, i) => acc + i.won, 0),
    lost: playerInfos.reduce((acc, i) => acc + i.lost, 0),
    draw: playerInfos.reduce((acc, i) => acc + i.draw, 0),
    data_per_month: joinMonthData(playerInfos.map((i) => i.data_per_month)),
    white_openings: sumGamesPlayed(playerInfos.map((i) => i.white_openings)),
    black_openings: sumGamesPlayed(playerInfos.map((i) => i.black_openings)),
  };
  return combined;
}

function Databases() {
  const sessions = useAtomValue(sessionsAtom);

  const players = Array.from(
    new Set(
      sessions.map(
        (s) => s.player || s.lichess?.username || s.chessCom?.username || "",
      ),
    ),
  );
  const playerDbNames = players.map((name) => ({
    name,
    databases: sessions
      .filter(
        (s) =>
          s.player === name ||
          s.lichess?.username === name ||
          s.chessCom?.username === name,
      )
      .map((s) =>
        s.chessCom
          ? `${s.chessCom.username} Chess.com`
          : `${s.lichess?.username} Lichess`,
      ),
  }));

  const [name, setName] = useState("");
  useEffect(() => {
    if (sessions.length > 0) {
      setName(sessions[0].player || getSessionUsername(sessions[0]));
    }
  }, [sessions]);

  const { data: databases } = useSWRImmutable<DatabaseInfo[]>(
    sessions.length === 0 ? null : ["personalDatabases", sessions],
    async () => {
      const dbs = (await getDatabases()).filter((db) => db.type === "success");
      return dbs.filter((db) => isDatabaseFromSession(db, sessions));
    },
  );

  const {
    data: personalInfo,
    isLoading,
    error,
  } = useSWRImmutable<PersonalInfo[]>(
    databases && name ? ["personalInfo", name, databases] : null,
    async () => {
      const playerDbs = playerDbNames.find((p) => p.name === name)?.databases;
      if (!databases || !playerDbs) return [];
      const results = await Promise.allSettled(
        databases
          .filter((db) =>
            playerDbs.includes((db.type === "success" && db.title) || ""),
          )
          .map(async (db, i) => {
            const players = await query_players(db.file, {
              name: db.username,
              options: {
                pageSize: 1,
                direction: "asc",
                sort: "id",
                skipCount: false,
              },
            });
            if (players.data.length === 0) {
              throw new Error("Player not found in database");
            }
            const player = players.data[0];
            const info = unwrap(
              await commands.getPlayersGameInfo(db.file, player.id),
            );
            return { db, info };
          }),
      );
      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<PersonalInfo>).value);
    },
  );

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const unlisten = events.databaseProgress.listen((e) => {
      setProgress(e.payload.progress);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <>
      {isLoading && databases && (
        <>
          <Text ta="center" fw="bold" my="auto" fz="lg">
            Processing Games...
          </Text>

          <Progress value={progress} />
        </>
      )}
      {error && <Text ta="center">Error loading databases: {error}</Text>}
      {personalInfo &&
        (personalInfo.length === 0 ? (
          <>
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
            <Text ta="center" fw="bold" my="auto" fz="lg">
              No databases found
            </Text>
          </>
        ) : (
          <PersonalPlayerCard
            name={name}
            setName={setName}
            info={combinePlayerInfo(personalInfo.map((i) => i.info))}
          />
        ))}
    </>
  );
}

export default Databases;
