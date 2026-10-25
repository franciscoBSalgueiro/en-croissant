import type { Api } from "@lichess-org/chessground/api";

export function syncBoardBounds(element: HTMLElement, api: Api): () => void {
    const refreshBounds = () => api.state.dom.bounds.clear();
    const refreshDragBounds = () => {
        if (api.state.draggable.current || api.state.drawable.current) refreshBounds();
    };
    const ownerDocument = element.ownerDocument;
    const options = { capture: true, passive: true };

    for (const event of ["mousedown", "touchstart"]) {
        element.addEventListener(event, refreshBounds, options);
    }
    for (const event of ["mousemove", "touchmove", "mouseup", "touchend"]) {
        ownerDocument.addEventListener(event, refreshDragBounds, options);
    }

    return () => {
        for (const event of ["mousedown", "touchstart"]) {
            element.removeEventListener(event, refreshBounds, options);
        }
        for (const event of ["mousemove", "touchmove", "mouseup", "touchend"]) {
            ownerDocument.removeEventListener(event, refreshDragBounds, options);
        }
    };
}
