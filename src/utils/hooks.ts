import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import { useEffect, useState } from "react";

export function useLocalFile<T>(filename: string, defaultValue: T) {
    const [state, setState] = useState<T>(defaultValue);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        readTextFile(filename, {
            dir: BaseDirectory.AppData,
        }).then((text) => {
            setLoaded(true);
            if (text === "") {
                return;
            }
            const data = JSON.parse(text);
            setState(data);
        });
    }, [filename]);

    useEffect(() => {
        if (loaded) {
            writeTextFile(filename, JSON.stringify(state), {
                dir: BaseDirectory.AppData,
            });
        }
    }, [filename, state]);

    return [state, setState] as const;
}
