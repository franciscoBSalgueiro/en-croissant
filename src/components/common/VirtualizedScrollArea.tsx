import { FixedSizeList, FixedSizeListProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { RefObject, useRef } from "react";
import { ScrollArea } from "@mantine/core";
import { mergeRefs } from "@mantine/hooks";

export default function VirtualizedScrollArea(
  props: Omit<FixedSizeListProps, "height" | "width"> & {
    listRef?: any;
  },
) {
  const listRef = useRef<FixedSizeList>(null);

  const handleScroll = ({ x: _, y }: { x: number; y: number }) => {
    listRef.current?.scrollTo(y);
  };

  let ref: RefObject<FixedSizeList> = listRef;
  if (props.innerRef) {
    ref = mergeRefs(props.listRef, listRef) as any;
  }

  return (
    <AutoSizer>
      {({ height, width }) => (
        <ScrollArea h={height} w={width} onScrollPositionChange={handleScroll}>
          <FixedSizeList
            {...props}
            ref={ref}
            height={height}
            width={width}
            style={{ overflow: "visible" }}
          />
        </ScrollArea>
      )}
    </AutoSizer>
  );
}
