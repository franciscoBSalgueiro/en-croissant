import { Card, SimpleGrid, Stack, Title } from "@mantine/core";
import Accounts from "./Accounts";
import Databases from "./Databases";

function HomePage() {
  return (
    <SimpleGrid
      cols={2}
      spacing="md"
      p="md"
      h="100%"
      style={{ overflow: "hidden" }}
    >
      <Card>
        <Stack h="100%">
          <Title>Accounts</Title>
          <Accounts />
        </Stack>
      </Card>
      <Card>
        <Databases />
      </Card>
    </SimpleGrid>
  );
}

export default HomePage;
