import { Badge, DefaultMantineColor } from "@mantine/core";
import { Speed } from "../../utils/db";

function SpeeedBadge({ speed }: { speed: Speed }) {
  let color: DefaultMantineColor;
  switch (speed) {
    case Speed.UltraBullet:
      color = "pink";
      break;
    case Speed.Bullet:
      color = "red";
      break;
    case Speed.Blitz:
      color = "yellow";
      break;
    case Speed.Rapid:
      color = "green";
      break;
    case Speed.Classical:
      color = "blue";
      break;
    case Speed.Correspondence:
      color = "violet";
      break;
    default:
      color = "gray";
  }
  return <Badge color={color}>{speed}</Badge>;
}

export default SpeeedBadge;
