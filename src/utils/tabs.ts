type TabType = "new" | "play" | "analysis" | "puzzles";

export interface Tab {
    name: string;
    value: string;
    type: TabType;
}

export function genID() {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return S4() + S4();
}

export function createTab(
    name: string,
    type: TabType,
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
    setActiveTab: React.Dispatch<React.SetStateAction<string | null>>
) {
    const id = genID();

    setTabs((prev) => [
        ...prev,
        {
            name,
            value: id,
            type,
        },
    ]);
    setActiveTab(id);
    return id;
}
