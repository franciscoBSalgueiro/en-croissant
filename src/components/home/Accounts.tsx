import { Button, Modal, Select, TextInput } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconX } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { ChessComStats, getChessComAccount } from "../../utils/chesscom";
import { Database, getDatabases } from "../../utils/db";
import {
  createCodes,
  getLichessAccount,
  LichessAccount
} from "../../utils/lichess";
import { AccountCard } from "./AccountCard";

type LichessSession = {
  accessToken: string;
  account: LichessAccount;
};

type ChessComSession = {
  username: string;
  stats: ChessComStats;
};

type Session = {
  lichess?: LichessSession;
  chessCom?: ChessComSession;
  updatedAt: number;
};

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
  const [open, setOpen] = useState(false);

  async function listen_for_code() {
    if (isListesning.current) return;
    isListesning.current = true;
    await listen("redirect_uri", async (event) => {
      if (authWindow.current) authWindow.current.close();
      const token = event.payload as string;
      const account = await getLichessAccount(token);
      setSessions((sessions) => [
        ...sessions,
        { lichess: { accessToken: token, account }, updatedAt: Date.now() },
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

  function countGames(stats: ChessComStats) {
    let total = 0;
    Object.values(stats).forEach((stat) => {
      if (stat.record)
        total += stat.record.win + stat.record.loss + stat.record.draw;
    });
    return total;
  }

  return (
    <>
      {sessions.map((session) => {
        if (session.lichess) {
          const account = session.lichess.account;
          const lichessSession = session.lichess;
          return (
            <AccountCard
              key={account.id}
              type="lichess"
              database={
                databases.find(
                  (db) => db.description === account.username + "_lichess.db3"
                ) ?? null
              }
              title={account.username}
              updatedAt={session.updatedAt}
              total={account.count.all}
              logout={() => {
                setSessions((sessions) =>
                  sessions.filter((s) => s.lichess?.account.id !== account.id)
                );
              }}
              setDatabases={setDatabases}
              reload={() => {
                getLichessAccount(lichessSession.accessToken).then(
                  (account) => {
                    setSessions((sessions) =>
                      sessions.map((s) =>
                        s.lichess?.account.id === account.id
                          ? {
                              ...s,
                              lichess: {
                                account: account,
                                accessToken: lichessSession.accessToken,
                              },
                              updatedAt: Date.now(),
                            }
                          : s
                      )
                    );
                  }
                );
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
        }
        if (session.chessCom) {
          return (
            <AccountCard
              key={session.chessCom.username}
              type="chesscom"
              title={session.chessCom.username}
              database={
                databases.find(
                  (db) =>
                    db.description ===
                    session.chessCom?.username + "_chesscom.db3"
                ) ?? null
              }
              updatedAt={session.updatedAt}
              total={countGames(session.chessCom.stats)}
              stats={[
                {
                  value: session.chessCom.stats.chess_bullet.last.rating,
                  label: "Bullet",
                },
                {
                  value: session.chessCom.stats.chess_blitz.last.rating,
                  label: "Blitz",
                },
                {
                  value: session.chessCom.stats.chess_rapid.last.rating,
                  label: "Rapid",
                },
                {
                  value: session.chessCom.stats.chess_daily.last.rating,
                  label: "Daily",
                },
              ]}
              logout={() => {
                setSessions((sessions) =>
                  sessions.filter(
                    (s) => s.chessCom?.username !== session.chessCom?.username
                  )
                );
              }}
              reload={() => {
                getChessComAccount(session.chessCom!.username).then((stats) => {
                  setSessions((sessions) =>
                    sessions.map((s) =>
                      s.chessCom?.username === session.chessCom?.username
                        ? {
                            ...s,
                            chessCom: {
                              username: session.chessCom!.username,
                              stats,
                            },
                            updatedAt: Date.now(),
                          }
                        : s
                    )
                  );
                });
              }}
              setDatabases={setDatabases}
            />
          );
        }
      })}

      <Button onClick={() => setOpen(true)}>Add Account</Button>
      <AccountModal
        open={open}
        setOpen={setOpen}
        addLichess={login}
        addChessCom={(u) => {
          getChessComAccount(u)
            .then((stats) => {
              setSessions((sessions) => [
                ...sessions,
                { chessCom: { username: u, stats }, updatedAt: Date.now() },
              ]);
            })
            .catch(() => {
              notifications.show({
                title: "Failed to add account",
                message: 'Could not find account "' + u + '" on chess.com',
                color: "red",
                icon: <IconX />,
              });
            });
        }}
      />
    </>
  );
}

export default Accounts;

function AccountModal({
  open,
  setOpen,
  addLichess,
  addChessCom,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  addLichess: (username: string) => void;
  addChessCom: (username: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [website, setWebsite] = useState<"lichess" | "chesscom">("lichess");

  function addAccount() {
    if (website === "lichess") {
      addLichess(username);
    } else {
      addChessCom(username);
    }
    setOpen(false);
  }

  return (
    <Modal opened={open} onClose={() => setOpen(false)} title="Add Account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addAccount();
        }}
      >
        <Select
          label="Website"
          placeholder="Select website"
          data={[
            { label: "Lichess", value: "lichess" },
            { label: "Chess.com", value: "chesscom" },
          ]}
          value={website}
          onChange={(e) => setWebsite(e as any)}
          required
        />
        <TextInput
          label="Username"
          placeholder="Enter your username"
          required
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
        />
        <Button sx={{ marginTop: "1rem" }} type="submit">
          Add
        </Button>
      </form>
    </Modal>
  );
}
