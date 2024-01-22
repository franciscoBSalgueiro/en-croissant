import { sessionsAtom } from "@/atoms/atoms";
import { getChessComAccount, getStats } from "@/utils/chesscom";
import { DatabaseInfo } from "@/utils/db";
import { getLichessAccount } from "@/utils/lichess";
import { useAtom } from "jotai";
import { AccountCard } from "../home/AccountCard";

function AccountCards({
  databases,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  setDatabases: React.Dispatch<React.SetStateAction<DatabaseInfo[]>>;
}) {
  const [sessions, setSessions] = useAtom(sessionsAtom);
  return (
    <>
      {sessions.map((session) => {
        if (session.lichess && session.lichess.account) {
          const account = session.lichess.account;
          const lichessSession = session.lichess;
          const totalGames =
            (account.perfs?.ultraBullet?.games ?? 0) +
            (account.perfs?.bullet?.games ?? 0) +
            (account.perfs?.blitz?.games ?? 0) +
            (account.perfs?.rapid?.games ?? 0) +
            (account.perfs?.classical?.games ?? 0);

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
                  (db) => db.filename === account.username + "_lichess.db3",
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
        if (session.chessCom && session.chessCom.stats) {
          let totalGames = 0;
          Object.values(session.chessCom.stats).forEach((stat) => {
            if (stat.record)
              totalGames +=
                stat.record.win + stat.record.loss + stat.record.draw;
          });
          return (
            <AccountCard
              key={session.chessCom.username}
              type="chesscom"
              title={session.chessCom.username}
              database={
                databases.find(
                  (db) =>
                    db.filename ===
                    session.chessCom?.username + "_chesscom.db3",
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
                const stats = await getChessComAccount(
                  session.chessCom!.username,
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
                      : s,
                  ),
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
