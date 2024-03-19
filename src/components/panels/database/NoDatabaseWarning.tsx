import { Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";

function NoDatabaseWarning() {
  return (
    <>
      <Text>No reference database selected.</Text>
      <Text>
        Please <Link to="/databases">add a database</Link> first and mark it as
        the reference.
      </Text>
    </>
  );
}

export default NoDatabaseWarning;
