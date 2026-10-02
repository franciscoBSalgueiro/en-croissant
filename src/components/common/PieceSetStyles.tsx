import { notifications } from "@mantine/notifications";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { customPieceSetsRevisionAtom, pieceSetAtom } from "@/state/atoms";
import { readCustomPieceSetCss } from "@/utils/customPieceSets";
import {
  builtinPieceSetHref,
  customPieceSetName,
  DEFAULT_PIECE_SET,
  isBuiltinPieceSet,
  isCustomPieceSetId,
} from "@/utils/pieceSets";

/**
 * Injects the stylesheet of the selected piece set. Built-in sets are served
 * from `public/pieces`, custom ones are read from the user pieces directory and
 * injected inline.
 *
 * While a custom set is loading (or when reading it failed) the stylesheet that
 * was applied before stays mounted, so the board never loses its pieces.
 */
export default function PieceSetStyles() {
  const { t } = useTranslation();
  const pieceSet = useAtomValue(pieceSetAtom);
  const revision = useAtomValue(customPieceSetsRevisionAtom);
  const [css, setCss] = useState<string | null>(null);
  const appliedCss = useRef<string | null>(null);

  const isCustom = isCustomPieceSetId(pieceSet);
  const name = isCustom ? customPieceSetName(pieceSet) : null;

  useEffect(() => {
    if (!name) {
      setCss(null);
      return;
    }

    let cancelled = false;
    readCustomPieceSetCss(name)
      .then((loaded) => {
        if (cancelled) return;
        appliedCss.current = loaded;
        setCss(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setCss(null);
        notifications.show({
          color: "red",
          title: t("Settings.Appearance.PieceSet.LoadFailed"),
          message: name,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [name, revision, t]);

  if (!isCustom) {
    // An unknown value (removed or manually edited theme) would render a board
    // without pieces, so fall back to the default piece set.
    const builtin = isBuiltinPieceSet(pieceSet) ? pieceSet : DEFAULT_PIECE_SET;
    return <link rel="stylesheet" href={builtinPieceSetHref(builtin)} />;
  }

  const activeCss = css ?? appliedCss.current;
  if (!activeCss) {
    // Nothing has been applied yet: fall back to the default piece set instead
    // of rendering a board without pieces.
    return <link rel="stylesheet" href={builtinPieceSetHref(DEFAULT_PIECE_SET)} />;
  }

  return <style data-piece-set={pieceSet} dangerouslySetInnerHTML={{ __html: activeCss }} />;
}
