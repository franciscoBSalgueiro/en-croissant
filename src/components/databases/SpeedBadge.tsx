import { Badge, DefaultMantineColor } from "@mantine/core";
import { Speed } from "@/utils/db";

function SpeeedBadge({ speed }: { speed: Speed }) {
  let color: DefaultMantineColor;
  switch (speed) {
    case "UltraBullet":
      color = "pink";
      break;
    case "Bullet":
      color = "red";
      break;
    case "Blitz":
      color = "yellow";
      break;
    case "Rapid":
      color = "green";
      break;
    case "Classical":
      color = "blue";
      break;
    case "Correspondence":
      color = "violet";
      break;
    default:
      color = "gray";
  }
  return <Badge color={color}>{speed}</Badge>;
}

export default SpeeedBadge;
