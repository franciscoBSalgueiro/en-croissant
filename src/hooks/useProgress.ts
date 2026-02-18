import { useEffect, useState } from "react";
import { commands, events, type ProgressItem } from "@/bindings";

export function useProgress(id: string) {
  const [item, setItem] = useState<ProgressItem | null>(null);

  useEffect(() => {
    commands.getProgress(id).then((result) => {
      if (result) {
        setItem(result);
      }
    });
  }, [id]);

  useEffect(() => {
    const unlisten = events.progressEvent.listen(({ payload }) => {
      if (payload.id === id) {
        setItem({
          id: payload.id,
          progress: payload.progress,
          finished: payload.finished,
        });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [id]);

  const clear = () => {
    commands.clearProgress(id);
    setItem(null);
  };

  return {
    progress: item?.progress ?? 0,
    finished: item?.finished ?? false,
    isActive: item !== null && !item.finished,
    clear,
    item,
  };
}
