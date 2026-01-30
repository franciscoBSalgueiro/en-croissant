import { events, type ProgressItem, commands } from "@/bindings";
import { useCallback, useEffect, useState } from "react";

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

  const clear = useCallback(() => {
    commands.clearProgress(id);
    setItem(null);
  }, [id]);

  return {
    progress: item?.progress ?? 0,
    finished: item?.finished ?? false,
    isActive: item !== null && !item.finished,
    clear,
    item,
  };
}
