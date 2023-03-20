import { Stack, Title } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { Database, getDatabases, getPlayersGameInfo } from "../../utils/db";
import { Session } from "../../utils/session";
import AccountCards from "../common/AccountCards";

function UserPage() {
  const [sessions, setSessions] = useLocalStorage<Session[]>({
    key: "sessions",
    defaultValue: [],
  });

  const [databases, setDatabases] = useState<Database[]>([]);
  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

  useEffect(() => {
    for (const session of sessions) {
      let db: Database | undefined;
      let username = "";
      if (session.lichess) {
        db = databases.find(
          (db) =>
            db.description ===
            session.lichess!.account.username + "_lichess.db3"
        );
        username = session.lichess!.account.username;
      }
      if (session.chessCom) {
        db = databases.find(
          (db) =>
            db.description === session.chessCom!.username + "_chesscom.db3"
        );
        username = session.chessCom!.username;
      }
      if (db) {
        getPlayersGameInfo(db.file, undefined, username).then((info) => {
          console.log(info);
        });
      }
    }
  }, [databases, sessions]);

  return (
    <Stack mt="xl">
      <Title>Accounts</Title>
      <AccountCards
        sessions={sessions}
        setSessions={setSessions}
        databases={databases}
        setDatabases={setDatabases}
      />
    </Stack>
  );
}

export default UserPage;
