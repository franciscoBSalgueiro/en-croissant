import { Text } from "@mantine/core";
import { Link } from "react-router-dom";

function NoDatabaseWarning() {
  return (
    <Text
      style={{
        pointerEvents: "all",
      }}
    >
      No reference database selected. Please{" "}
      <Link to="/databases">Add a database</Link> first.
    </Text>
  );
}

export default NoDatabaseWarning;
