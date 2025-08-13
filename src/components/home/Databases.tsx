import { events, commands } from "@/bindings";
import type {
  DatabaseInfo as PlainDatabaseInfo,
  PlayerGameInfo,
} from "@/bindings";
import { sessionsAtom } from "@/state/atoms";
import { getDatabases, query_players } from "@/utils/db";
import type { Session } from "@/utils/session";
import { unwrap } from "@/utils/unwrap";
import { Flex, Progress, Select, Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import PersonalPlayerCard from "./PersonalCard";
import { DatabaseViewStateContext } from "../databases/DatabaseViewStateContext";
import { activeDatabaseViewStore } from "@/state/store/database";

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
          <DatabaseViewStateContext.Provider value={activeDatabaseViewStore}>
            <PersonalPlayerCard
              name={name}
              setName={setName}
              info={{
                site_stats_data: personalInfo.flatMap(
                  (i) => i.info.site_stats_data,
                ),
              }}
            />
          </DatabaseViewStateContext.Provider>
        ))}
    </>
  );
}

export default Databases;
