import Link from "next/link";
import { Text } from "@mantine/core";

function NoDatabaseWarning() {
  return (
    <Text
      sx={{
        pointerEvents: "all",
      }}
    >
      No reference database selected. Please{" "}
      <Link href="/databases">Add a database</Link> first.
    </Text>
  );
}

export default NoDatabaseWarning;
