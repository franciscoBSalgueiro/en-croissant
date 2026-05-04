import { Button, Group } from "@mantine/core";
import { useAtom } from "jotai";
import { is3dAtom } from "@/state/atoms";

export default function DimensionToggle() {
  const [is3d, setIs3d] = useAtom(is3dAtom);

  return (
    <Group gap="xs">
      <Button
        size="xs"
        variant={!is3d ? "filled" : "default"}
        onClick={() => setIs3d(false)}
      >
        2D
      </Button>
      <Button
        size="xs"
        variant={is3d ? "filled" : "default"}
        onClick={() => setIs3d(true)}
      >
        3D
      </Button>
    </Group>
  );
}
