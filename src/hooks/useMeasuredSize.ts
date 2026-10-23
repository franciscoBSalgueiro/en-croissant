import { useCallback, useState } from "react";
import { flushSync } from "react-dom";

// An element's size in CSS pixels, measured as soon as the element appears, even when that's after
// the component first rendered (Mantine's useElementSize only watches an element that's there from
// the start), and before it's painted, so nothing is drawn at a size it doesn't have; then again
// whenever it changes
export function useMeasuredSize<T extends HTMLElement>() {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const ref = useCallback((element: T | null) => {
        if (!element) return;
        const measure = () => {
            const { width, height } = element.getBoundingClientRect();
            setSize((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height },
            );
        };
        // As the element is attached: React renders this before the browser paints
        measure();
        // A resize is shown at once too, rather than a frame later
        const observer = new ResizeObserver(() => flushSync(measure));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return { ref, ...size };
}
