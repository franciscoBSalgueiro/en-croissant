import { ScrollArea, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  DatabaseInfo as PlainDatabaseInfo,
  Player,
  PlayerGameInfo,
  getDatabases,
  getPlayersGameInfo,
  query_players,
} from "@/utils/db";
import { useAtomValue } from "jotai";
import { sessionsAtom } from "@/atoms/atoms";
import { Session } from "@/utils/session";
import PersonalPlayerCard from "./PersonalCard";

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

function sumGamesPlayed(lists: [string, number][][]) {
  const openingCounts = new Map<string, number>();

  for (const list of lists) {
    for (const [opening, count] of list) {
      openingCounts.set(opening, (openingCounts.get(opening) ?? 0) + count);
    }
  }

  return Array.from(openingCounts.entries()).sort((a, b) => b[1] - a[1]);
}

function combinePlayerInfo(playerInfos: PlayerGameInfo[]) {
  const combined: PlayerGameInfo = {
    won: playerInfos.reduce((acc, i) => acc + i.won, 0),
    lost: playerInfos.reduce((acc, i) => acc + i.lost, 0),
    draw: playerInfos.reduce((acc, i) => acc + i.draw, 0),
    games_per_month: sumGamesPlayed(playerInfos.map((i) => i.games_per_month)),
    white_openings: sumGamesPlayed(playerInfos.map((i) => i.white_openings)),
    black_openings: sumGamesPlayed(playerInfos.map((i) => i.black_openings)),
  };
  return combined;
}

function Databases() {
  const sessions = useAtomValue(sessionsAtom);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo[]>([]);

  useEffect(() => {
    async function getPlayerInfo() {
      if (sessions.length === 0) return;
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
          const info = await getPlayersGameInfo(db.file, player.id);
          return { db, info };
        })
      );
      setPersonalInfo(newInfo);
    }
    getPlayerInfo();
  }, [sessions]);

  return (
    <ScrollArea sx={{ height: "80vh" }}>
      <Stack>
        {personalInfo.length === 0 && <Text>No databases installed.</Text>}
        <PersonalPlayerCard
          name={"Stats"}
          info={combinePlayerInfo(personalInfo.map((i) => i.info))}
        />
      </Stack>
    </ScrollArea>
  );
}

export default Databases;
