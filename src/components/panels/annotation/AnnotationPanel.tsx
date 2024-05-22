import { TreeStateContext } from "@/components/common/TreeStateContext";
import {
  ANNOTATION_INFO,
  type Annotation,
  isBasicAnnotation,
} from "@/utils/annotation";
import { getNodeAtPath } from "@/utils/treeReducer";
import {
  ActionIcon,
  Collapse,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { atom, useAtom } from "jotai";
import { memo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import AnnotationEditor from "./AnnotationEditor";

const SymbolButton = memo(function SymbolButton({
  curAnnotations,
  annotation,
}: {
  curAnnotations: Annotation[];
  annotation: Annotation;
}) {
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const setAnnotation = useStore(store, (s) => s.setAnnotation);
  const { translationKey, name, color } = ANNOTATION_INFO[annotation];
  const isActive = curAnnotations.includes(annotation);
  const theme = useMantineTheme();
  return (
    <Tooltip
      label={translationKey ? t(`Annotate.${translationKey}`) : name}
      position="bottom"
    >
      <ActionIcon
        onClick={() => setAnnotation(annotation)}
        variant={isActive ? "filled" : "default"}
        color={isBasicAnnotation(annotation) ? color : theme.primaryColor}
      >
        <Text>{annotation}</Text>
      </ActionIcon>
    </Tooltip>
  );
});

const showMoreSymbolsAtom = atom(false);

const BASIC = ["!!", "!", "!?", "?!", "?", "??"] as const;
const ADVANTAGE = ["+-", "±", "⩲", "=", "∞", "⩱", "∓", "-+"] as const;
const EXTRA = ["N", "↑↑", "↑", "→", "⇆", "=∞", "⊕", "∆", "□", "⨀"] as const;

function AnnotationPanel() {
  const store = useContext(TreeStateContext)!;
  const root = useStore(store, (s) => s.root);
  const position = useStore(store, (s) => s.position);
  const currentNode = getNodeAtPath(root, position);
  const [showMoreSymbols, setShowMoreSymbols] = useAtom(showMoreSymbolsAtom);
  return (
    <Stack h="100%" gap={0}>
      <Stack gap={0}>
        <Group grow>
          {BASIC.map((annotation) => {
            return (
              <SymbolButton
                key={annotation}
                curAnnotations={currentNode.annotations}
                annotation={annotation}
              />
            );
          })}
        </Group>
        <Divider
          label={
            <ActionIcon
              mx="auto"
              onClick={() => setShowMoreSymbols(!showMoreSymbols)}
              color="dimmed"
              style={{
                transition: "transform 0.2s",
                transform: showMoreSymbols ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <IconChevronDown size="1rem" />
            </ActionIcon>
          }
        />
      </Stack>

      <Collapse in={showMoreSymbols}>
        <Stack mb="md">
          <Group grow>
            {ADVANTAGE.map((annotation) => (
              <SymbolButton
                key={annotation}
                curAnnotations={currentNode.annotations}
                annotation={annotation}
              />
            ))}
          </Group>
          <Group grow>
            {EXTRA.map((annotation) => (
              <SymbolButton
                key={annotation}
                curAnnotations={currentNode.annotations}
                annotation={annotation}
              />
            ))}
          </Group>
        </Stack>
      </Collapse>

      <ScrollArea offsetScrollbars>
        <AnnotationEditor />
      </ScrollArea>
    </Stack>
  );
}

export default AnnotationPanel;
