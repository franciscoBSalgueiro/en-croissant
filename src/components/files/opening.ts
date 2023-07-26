import { TreeNode, traverseTree } from "@/utils/treeReducer";
import { readTextFile, writeTextFile } from "@tauri-apps/api/fs";

interface Card {
    /** Chess position represented as a string (e.g., FEN notation) */
    position: string;
    /** The correct theoretical move for the position */
    theoreticalMove: string;
    /** Number of times the card has been successfully recalled */
    repetitions: number;
    /** Time interval to the next review (in days) */
    interval: number;
}

export class SM2Algorithm {
    public cards: Card[] = [];
    private dataFilePath: string;

    constructor(dataFilePath: string) {
        this.dataFilePath = dataFilePath;
    }

    public addCard(card: Card) {
        this.cards.push(card);
    }

    public buildFromTree(tree: TreeNode, color: "w" | "b") {
        const cards: Card[] = [];
        const list = traverseTree(tree);
        for (const item of list) {
            if (item.node.children.length === 0) {
                continue;
            }
            if (
                (color === "w" && item.node.halfMoves % 2 === 0) ||
                (color === "b" && item.node.halfMoves % 2 === 1)
            ) {
                cards.push({
                    position: item.position.toString(),
                    theoreticalMove: item.node.children[0].move!.san,
                    repetitions: 0,
                    interval: 1,
                });
            }
        }
        this.cards = cards;
    }

    public getCardForReview(): Card | null {
        const currentDate = new Date().getTime();
        for (const card of this.cards) {
            if (currentDate >= card.repetitions) {
                return card;
            }
        }
        return null;
    }

    public updateCardPerformance(card: Card, isRecalled: boolean) {
        if (isRecalled) {
            if (card.repetitions === 0) {
                card.interval = 1;
            } else if (card.repetitions === 1) {
                card.interval = 6;
            } else {
                card.interval *= 2.5;
            }
            card.repetitions++;
        } else {
            card.repetitions = 0;
            card.interval = 1;
        }
    }

    public async saveData() {
        const data = JSON.stringify(this.cards);
        await writeTextFile(this.dataFilePath, data);
    }

    public async loadData() {
        const data = await readTextFile(this.dataFilePath);
        this.cards = JSON.parse(data);
    }
}
