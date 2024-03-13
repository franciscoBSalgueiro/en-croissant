import type { Speed } from "@/utils/db";
import { Badge, type DefaultMantineColor } from "@mantine/core";
import { match } from "ts-pattern";

function SpeeedBadge({ speed }: { speed: Speed }) {
  const color: DefaultMantineColor = match(speed)
    .with("UltraBullet", () => "pink")
    .with("Bullet", () => "red")
    .with("Blitz", () => "yellow")
    .with("Rapid", () => "green")
    .with("Classical", () => "blue")
    .with("Correspondence", () => "violet")
    .with("Unknown", () => "gray")
    .exhaustive();
  return <Badge color={color}>{speed}</Badge>;
}

export default SpeeedBadge;
