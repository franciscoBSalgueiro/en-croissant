import { Button, Loader, RingProgress } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhoto, IconX } from "@tabler/icons-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MODEL } from "@/utils/vision/model";
import { DownloadDeclined, readPlacement } from "@/utils/vision/reader";
import SameWidthLabel from "./SameWidthLabel";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

async function imageAt(path: string): Promise<Blob> {
  return (await fetch(convertFileSrc(path))).blob();
}

// Sets the position from a picture of a board: chosen with the button, pasted, or dropped on the
// window while the editor is open. A picture only shows the pieces, so like Lichess it's White to
// move with no castling, which the editor can then change.
export default function FromImageButton({
  setFen,
  sameWidthAs,
  style,
}: {
  setFen: (fen: string) => void;
  // Labels the button keeps room for, so it matches the buttons beside it
  sameWidthAs: string[];
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  // A number is the model download's progress, in percent
  const [status, setStatus] = useState<"idle" | "reading" | number>("idle");
  const busy = useRef(false);

  const readImage = useCallback(
    async (getImage: () => Promise<Blob>) => {
      if (busy.current) return;
      busy.current = true;
      setStatus("reading");
      try {
        const placement = await readPlacement(await getImage(), {
          confirmDownload: () =>
            ask(
              t("Fen.FromImage.DownloadMessage", { size: `${Math.round(MODEL.size / 1e6)} MB` }),
              {
                title: t("Fen.FromImage.DownloadTitle"),
                kind: "info",
                okLabel: t("Common.Download"),
                cancelLabel: t("Common.Cancel"),
              },
            ),
          onDownloadProgress: (percent) => setStatus(percent < 100 ? percent : "reading"),
        });
        setFen(`${placement} w - - 0 1`);
      } catch (error) {
        if (!(error instanceof DownloadDeclined)) {
          notifications.show({
            title: t("Fen.FromImage.Failed"),
            message: error instanceof Error ? error.message : String(error),
            color: "red",
            icon: <IconX />,
          });
        }
      } finally {
        busy.current = false;
        setStatus("idle");
      }
    },
    [setFen, t],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );
      // Anything else, like a FEN pasted into the text box, is pasted as usual
      if (!image) return;
      event.preventDefault();
      readImage(async () => image);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [readImage]);

  useEffect(() => {
    // The window takes files dropped on it, so they come through Tauri rather than the page
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      const path = event.payload.paths.find((file) =>
        IMAGE_EXTENSIONS.includes(file.split(".").pop()?.toLowerCase() ?? ""),
      );
      if (path) readImage(() => imageAt(path));
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [readImage]);

  return (
    <Button
      variant="default"
      style={style}
      disabled={status !== "idle"}
      leftSection={
        status === "idle" ? (
          <IconPhoto size={16} />
        ) : status === "reading" ? (
          <Loader size={16} />
        ) : (
          <RingProgress size={16} thickness={3} sections={[{ value: status, color: "blue" }]} />
        )
      }
      onClick={async () => {
        const path = await open({
          multiple: false,
          filters: [{ name: t("Fen.FromImage.Images"), extensions: IMAGE_EXTENSIONS }],
        });
        if (typeof path === "string") readImage(() => imageAt(path));
      }}
    >
      <SameWidthLabel
        label={status === "idle" ? t("Fen.FromImage") : t("Fen.FromImage.Processing")}
        all={sameWidthAs}
      />
    </Button>
  );
}
