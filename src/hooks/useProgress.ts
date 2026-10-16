import { useCallback, useEffect, useState } from "react";
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
                    bytes_per_second: payload.bytes_per_second,
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
        bytesPerSecond: item?.bytes_per_second ?? null,
        isActive: item !== null && !item.finished,
        clear,
        item,
    };
}
