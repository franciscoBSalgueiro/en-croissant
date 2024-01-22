import {
  currentInvisibleAtom,
  currentPracticingAtom,
  currentTabAtom,
  deckAtomFamily,
} from "@/atoms/atoms";
import ConfirmModal from "@/components/common/ConfirmModal";
import {
  TreeDispatchContext,
  TreeStateContext,
} from "@/components/common/TreeStateContext";
import {
  buildFromTree,
  getCardForReview,
  getStats,
} from "@/components/files/opening";
import {
  Text,
  ActionIcon,
  Group,
  Stack,
  Button,
  RingProgress,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconX } from "@tabler/icons-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useContext } from "react";
import { match } from "ts-pattern";

function PracticePanel() {
  const dispatch = useContext(TreeDispatchContext);
  const { root, headers } = useContext(TreeStateContext);
  const currentTab = useAtomValue(currentTabAtom);
  const [resetModal, toggleResetModal] = useToggle();

  const [deck, setDeck] = useAtom(
    deckAtomFamily({
      id: currentTab?.file?.name || "",
      root,
      headers,
      game: currentTab?.gameNumber || 0,
    }),
  );

  const stats = getStats(deck);

  const setInvisible = useSetAtom(currentInvisibleAtom);
  const setPracticing = useSetAtom(currentPracticingAtom);

  async function newPractice(type: "new" | "random") {
    const c = match(type)
      .with("new", () => getCardForReview(deck))
      .with("random", () => getCardForReview(deck, { random: true }))
      .exhaustive();

    if (!c) return;
    dispatch({
      type: "GO_TO_MOVE",
      payload: c.position,
    });
    setInvisible(true);
  }

  return (
    <>
      <Stack>
        <Group justify="space-between" m={12}>
          <Text fw="bold">Practicing</Text>
          <ActionIcon
            onClick={() => {
              setPracticing(false);
              setInvisible(false);
            }}
          >
            <IconX />
          </ActionIcon>
        </Group>
        <Group>
          <RingProgress
            size={150}
            thickness={16}
            label={
              <Text ta="center" px="xs" style={{ pointerEvents: "none" }}>
                {Math.round((stats.mastered / stats.total) * 100)}% mastered
              </Text>
            }
            sections={[
              {
                value: (stats.mastered / stats.total) * 100,
                color: "blue",
                tooltip: `${stats.mastered} mastered`,
              },
              {
                value: (stats.reviewing / stats.total) * 100,
                color: "red",
                tooltip: `${stats.reviewing} reviewing`,
              },
              {
                value: (stats.learning / stats.total) * 100,
                color: "cyan",
                tooltip: `${stats.learning} learning`,
              },
              {
                value: (stats.unseen / stats.total) * 100,
                color: "gray",
                tooltip: `${stats.unseen} unseen`,
              },
            ]}
          />
          {stats.due === 0 && (
            <p>You have practiced all positions. Well done!</p>
          )}
        </Group>

        <Group>
          <Button variant="default" onClick={() => newPractice("new")}>
            Practice next position
          </Button>
          <Button variant="default" onClick={() => newPractice("random")}>
            Practice random position
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setInvisible(false);
              dispatch({ type: "GO_TO_NEXT" });
            }}
          >
            See Answer
          </Button>
          <Button variant="default" onClick={() => toggleResetModal()}>
            Reset
          </Button>
        </Group>
      </Stack>
      <ConfirmModal
        title={"Reset opening data"}
        description={`Are you sure you want to reset the opening data for "${currentTab?.file?.name}"? All the learning progress will be lost.`}
        opened={resetModal}
        onClose={toggleResetModal}
        onConfirm={() => {
          const cards = buildFromTree(
            root,
            headers.orientation || "white",
            headers.start || [],
          );
          setDeck(cards);
          toggleResetModal();
        }}
        confirmLabel="Reset"
      />
    </>
  );
}

export default PracticePanel;
