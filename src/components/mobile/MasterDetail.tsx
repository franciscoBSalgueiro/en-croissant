import { Box, Button, Group, Stack } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { Children, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLayoutMode } from "@/utils/mobile";

/**
 * List + detail pages. On desktop/landscape both panes sit side by side (as before);
 * in portrait (iPhone upright) only one pane is shown at a time with a back button.
 */
export default function MasterDetail({
  showDetail,
  onBack,
  children,
}: {
  showDetail: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const mode = useLayoutMode();
  const [list, detail] = Children.toArray(children);

  if (mode !== "portrait") {
    return (
      <Group
        grow
        flex={1}
        style={{ overflow: "hidden" }}
        align="start"
        px={mode === "landscape" ? "xs" : "md"}
        pb={mode === "landscape" ? "xs" : "md"}
        wrap="nowrap"
      >
        {list}
        {detail}
      </Group>
    );
  }

  return (
    <Stack flex={1} gap={6} style={{ overflow: "hidden", minHeight: 0 }} px={6} pb={6}>
      {showDetail && (
        <Button
          variant="subtle"
          size="compact-md"
          leftSection={<IconChevronLeft size={18} />}
          onClick={onBack}
          style={{ alignSelf: "flex-start" }}
        >
          {t("Common.Back", { defaultValue: "Back" })}
        </Button>
      )}
      <Box flex={1} style={{ minHeight: 0, overflow: "hidden" }}>
        {showDetail ? detail : list}
      </Box>
    </Stack>
  );
}
