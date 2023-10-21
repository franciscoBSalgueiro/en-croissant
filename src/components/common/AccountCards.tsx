import { useAtom } from "jotai";
import { ChessComStats, getChessComAccount, getStats } from "@/utils/chesscom";
import { DatabaseInfo } from "@/utils/db";
import { getLichessAccount } from "@/utils/lichess";
import { AccountCard } from "../home/AccountCard";
import { sessionsAtom } from "@/atoms/atoms";

function AccountCards({
  databases,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
}) {
  const [sessions, setSessions] = useAtom(sessionsAtom);
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
        if (session.lichess && session.lichess.account) {
          const account = session.lichess.account;
          const lichessSession = session.lichess;
          return (
            <AccountCard
              key={account.id}
              token={lichessSession.accessToken}
              type="lichess"
              database={
                databases.find(
                  (db) => db.filename === account.username + "_lichess.db3"
                ) ?? null
              }
              title={account.username}
              updatedAt={session.updatedAt}
              total={account.count.all - account.count.ai}
              logout={() => {
                setSessions((sessions) =>
                  sessions.filter((s) => s.lichess?.account.id !== account.id)
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
                            accessToken: lichessSession.accessToken,
                          },
                          updatedAt: Date.now(),
                        }
                      : s
                  )
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
        if (session.chessCom && session.chessCom.stats) {
          return (
            <AccountCard
              key={session.chessCom.username}
              type="chesscom"
              title={session.chessCom.username}
              database={
                databases.find(
                  (db) =>
                    db.filename === session.chessCom?.username + "_chesscom.db3"
                ) ?? null
              }
              updatedAt={session.updatedAt}
              total={countGames(session.chessCom.stats)}
              stats={getStats(session.chessCom.stats)}
              logout={() => {
                setSessions((sessions) =>
                  sessions.filter(
                    (s) => s.chessCom?.username !== session.chessCom?.username
                  )
                );
              }}
              reload={async () => {
                const stats = await getChessComAccount(
                  session.chessCom!.username
                );
                if (!stats) return;
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
              }}
              setDatabases={setDatabases}
            />
          );
        }
      })}
    </>
  );
}

export default AccountCards;
