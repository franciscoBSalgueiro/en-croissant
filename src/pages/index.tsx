import { Card, Grid, SimpleGrid, Title } from "@mantine/core";
import dynamic from "next/dynamic";

const RecentGames = dynamic(() => import("../components/home/RecentGames"), {
  ssr: false,
});

function Page() {
  return (
    <SimpleGrid
      cols={2}
      h="95vh"
      spacing="md"
      breakpoints={[{ maxWidth: "sm", cols: 1 }]}
    >
      <Card>
        <Title>Welcome back</Title>
      </Card>
      <Grid gutter="md">
        <Grid.Col>
          <Card h="100%">
            <Title>Recent Games</Title>
            <RecentGames />
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
