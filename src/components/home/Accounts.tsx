import { Button } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { Database, getDatabases } from "../../utils/db";
import { createCodes, getMyAccount, LichessAccount } from "../../utils/lichess";
import { AccountCard } from "./AccountCard";

interface Session {
  accessToken: string;
  account: LichessAccount;
  updatedAt: number;
}

function Accounts() {
  const [sessions, setSessions] = useLocalStorage<Session[]>({
    key: "sessions",
    defaultValue: [],
  });
  const authWindow = useRef<Window | null>(null);
  const isListesning = useRef(false);
  const [databases, setDatabases] = useState<Database[]>([]);
  useEffect(() => {
    getDatabases().then((dbs) => setDatabases(dbs));
  }, []);

  async function listen_for_code() {
    if (isListesning.current) return;
    isListesning.current = true;
    await listen("redirect_uri", async (event) => {
      if (authWindow.current) authWindow.current.close();
      const token = event.payload as string;
      const account = await getMyAccount(token);
      setSessions((sessions) => [
        ...sessions,
        { accessToken: token, account, updatedAt: Date.now() },
      ]);
    });
  }

  async function login(clientId: string) {
    const { verifier, challenge } = await createCodes();
    const port = await invoke("start_server", { verifier: verifier });

    authWindow.current = window.open(
      "https://lichess.org/oauth?" +
        new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: `http://localhost:${port}`,
          scope: "preference:read",
          code_challenge_method: "S256",
          code_challenge: challenge,
        }),
      "_blank"
    );
  }

  useEffect(() => {
    listen_for_code();
  }, []);

  return (
    <>
      {sessions.map((session) => {
        const account = session.account;
        return (
          <AccountCard
            key={account.id}
            database={
              databases.find((db) => db.description === account.username + ".sqlite") ?? null
            }
            title={account.username}
            description={
              "Last Updated: " +
              new Date(session.updatedAt).toLocaleDateString()
            }
            total={account.count.all}
            logout={() => {
              setSessions((sessions) =>
                sessions.filter((s) => s.account.id !== account.id)
              );
            }}
            setDatabases={setDatabases}
            reload={() => {
              getMyAccount(session.accessToken).then((account) => {
                setSessions((sessions) =>
                  sessions.map((s) =>
                    s.account.id === account.id
                      ? { ...s, account, updatedAt: Date.now() }
                      : s
                  )
                );
              });
            }}
            stats={[
              {
                value: account.perfs.bullet.rating,
                label: "Bullet",
                diff: account.perfs.bullet.prog,
              },
              {
                value: account.perfs.blitz.rating,
                label: "Blitz",
                diff: account.perfs.blitz.prog,
              },
              {
                value: account.perfs.rapid.rating,
                label: "Rapid",
                diff: account.perfs.rapid.prog,
              },
              {
                value: account.perfs.classical.rating,
                label: "Classical",
                diff: account.perfs.classical.prog,
              },
            ]}
          />
        );
      })}
      <Button onClick={() => login("FrankWillow")}>Add Account</Button>
    </>
  );
}

export default Accounts;
