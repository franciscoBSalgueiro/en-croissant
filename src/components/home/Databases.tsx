import { Text } from "@mantine/core";
import {
  DatabaseInfo as PlainDatabaseInfo,
  Player,
  PlayerGameInfo,
  getDatabases,
  query_players,
} from "@/utils/db";
import { useAtomValue } from "jotai";
import { sessionsAtom } from "@/atoms/atoms";
import { Session } from "@/utils/session";
import PersonalPlayerCard from "./PersonalCard";
import useSWRImmutable from "swr/immutable";
import { MonthData, Results, commands } from "@/bindings";
import { unwrap } from "@/utils/invoke";

interface DatabaseInfo extends PlainDatabaseInfo {
  username?: string;
}

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
    db.filename.includes(getSessionUsername(session))
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
      b[1].won + b[1].draw + b[1].lost - a[1].won - a[1].draw - a[1].lost
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
    a[0].localeCompare(b[0])
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
  const {
    data: personalInfo,
    isLoading,
    error,
  } = useSWRImmutable<PersonalInfo[]>(
    sessions.length === 0 ? null : ["databases", sessions],
    async () => {
      const dbs = await getDatabases();
      const personalDbs = dbs.filter((db) =>
        isDatabaseFromSession(db, sessions)
      ) as DatabaseInfo[];
      const newInfo: PersonalInfo[] = await Promise.all(
        personalDbs.map(async (db) => {
          let player: Player | null = null;
          const players = await query_players(db.file, {
            name: db.username,
            pageSize: 1,
            direction: "asc",
            sort: "id",
          });
          if (players.data.length > 0) {
            player = players.data[0];
          } else {
            throw new Error("Player not found");
          }
          const info = unwrap(
            await commands.getPlayersGameInfo(db.file, player.id)
          );
          return { db, info };
        })
      );
      return newInfo;
    }
  );

  return (
    <>
      {isLoading && <Text ta="center">Loading...</Text>}
      {error && <Text ta="center">Error loading databases: {error}</Text>}
      {personalInfo &&
        (personalInfo.length === 0 ? (
          <Text ta="center" fw="bold" my="auto" fz="lg">
            No databases found
          </Text>
        ) : (
          <PersonalPlayerCard
            name={"Stats"}
            info={combinePlayerInfo(personalInfo.map((i) => i.info))}
          />
        ))}
    </>
  );
}

export default Databases;
