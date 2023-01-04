import { Button } from "@mantine/core";
import { useSessionStorage } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { createCodes, getMyAccount, LichessAccount } from "../../utils/lichess";

function AccountsList() {
  const [accessToken, setAccessToken] = useSessionStorage<string | null>({
    key: "access-token",
    defaultValue: null,
  });
  const [account, setAccount] = useState<LichessAccount | null>(null);
  const authWindow = useRef<Window | null>(null);
  const isListesning = useRef(false);

  async function listen_for_code() {
    if (isListesning.current) return;
    isListesning.current = true;
    await listen("redirect_uri", (event) => {
      if (authWindow.current) authWindow.current.close();
      const token = event.payload as string;
      setAccessToken(token);
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

  useEffect(() => {
    if (accessToken) {
      getMyAccount(accessToken).then((account) => {
        setAccount(account);
      });
    }
  }, [accessToken]);

  return (
    <>
      <p>{account && account.username}</p>
      {accessToken ? (
        <Button
          onClick={() => {
            setAccessToken(null);
            setAccount(null);
          }}
        >
          Logout
        </Button>
      ) : (
        <Button onClick={() => login("FrankWillow")}>Login</Button>
      )}
    </>
  );
}

export default AccountsList;
