import { Completion } from "@/utils/puzzles";
import { Group, ActionIcon } from "@mantine/core";
import { IconCheck, IconX, IconDots } from "@tabler/icons-react";
import { match } from "ts-pattern";

type Challenge = {
  completion: Completion;
};

function ChallengeHistory({
  challenges,
  select,
  current,
}: {
  challenges: Challenge[];
  select: (i: number) => void;
  current: number;
}) {
  return (
    <Group>
      {challenges.map((p, i) => {
        const isCurrent = i === current;
        return match(p.completion)
          .with("correct", () => (
            <ActionIcon
              onClick={() => {
                select(i);
              }}
              variant="light"
              key={i}
              color="green"
              sx={{ border: isCurrent ? "2px solid green" : "none" }}
            >
              <IconCheck color="green" />
            </ActionIcon>
          ))
          .with("incorrect", () => (
            <ActionIcon
              onClick={() => select(i)}
              variant="light"
              key={i}
              color="red"
              sx={{ border: isCurrent ? "2px solid red" : "none" }}
            >
              <IconX color="red" />
            </ActionIcon>
          ))
          .with("incomplete", () => (
            <ActionIcon
              onClick={() => select(i)}
              variant="light"
              key={i}
              color="yellow"
              sx={{ border: isCurrent ? "2px solid yellow" : "none" }}
            >
              <IconDots color="yellow" />
            </ActionIcon>
          ))
          .exhaustive();
      })}
    </Group>
  );
}

export default ChallengeHistory;
