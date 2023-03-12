import { Card, Grid, SimpleGrid, Stack, Title } from "@mantine/core";
import dynamic from "next/dynamic";

const Accounts = dynamic(() => import("../components/home/Accounts"), {
  ssr: false,
});

function Page() {
  return (
    <SimpleGrid
      cols={2}
      my="md"
      spacing="md"
      breakpoints={[{ maxWidth: "sm", cols: 1 }]}
    >
      <Card>
        <Stack>
          <Title>Overview</Title>
          <Accounts />
        </Stack>
      </Card>
      <Grid gutter="md">
        <Grid.Col>
          <Card h="100%">
            <Title>???</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card h="100%">
            <Title>Engines</Title>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card h="100%">
            <Title>Databases</Title>
          </Card>
        </Grid.Col>
      </Grid>
    </SimpleGrid>
  );
}

export default Page;
