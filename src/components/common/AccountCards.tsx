import { ChessComStats, getChessComAccount } from "../../utils/chesscom";
import { Database } from "../../utils/db";
import { getLichessAccount } from "../../utils/lichess";
import { Session } from "../../utils/session";
import { AccountCard } from "../home/AccountCard";

function AccountCards({
  sessions,
  setSessions,
  databases,
  setDatabases,
}: {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  databases: Database[];
  setDatabases: React.Dispatch<React.SetStateAction<Database[]>>;
}) {
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
      {" "}
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
    </>
  );
}

export default AccountCards;
