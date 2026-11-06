import cx from "clsx";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { TreeStateContext } from "@/components/common/TreeStateContext";
import classes from "./MoveStrip.module.css";

type StripMove = { path: number[]; san: string; halfMoves: number };

/** One-line, horizontally scrolling move list of the current line (phone layout). */
export default function MoveStrip() {
  const { t } = useTranslation();
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const goToMove = useStore(store, (s) => s.goToMove);

  const moves = useMemo(() => {
    const out: StripMove[] = [];
    let node = root;
    const path: number[] = [];
    // Follow the selected path, then continue along the main continuation.
    for (const i of position) {
      node = node.children[i];
      if (!node) break;
      path.push(i);
      out.push({ path: [...path], san: node.san ?? "", halfMoves: node.halfMoves });
    }
    while (node && node.children.length > 0) {
      node = node.children[0];
      path.push(0);
      out.push({ path: [...path], san: node.san ?? "", halfMoves: node.halfMoves });
    }
    return out;
  }, [root, position]);

  const currentRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = currentRef.current;
    const strip = stripRef.current;
    if (!strip) return;
    if (!el) {
      strip.scrollTo({ left: 0 });
      return;
    }
    const left = el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [position, moves.length]);

  return (
    <div className={classes.strip} ref={stripRef}>
      {moves.length === 0 && <span className={classes.empty}>{t("Board.Tabs.Moves")}</span>}
      {moves.map((m, idx) => {
        const isCurrent = m.path.length === position.length;
        const white = m.halfMoves % 2 === 1;
        const num = Math.ceil(m.halfMoves / 2);
        return (
          <span key={m.path.join(",")} style={{ display: "contents" }}>
            {(white || idx === 0) && (
              <span className={classes.num}>
                {num}.{white ? "" : ".."}
              </span>
            )}
            <button
              type="button"
              ref={isCurrent ? currentRef : undefined}
              className={cx(classes.move, { [classes.current]: isCurrent })}
              onClick={() => goToMove(m.path)}
            >
              {m.san}
            </button>
          </span>
        );
      })}
    </div>
  );
}
