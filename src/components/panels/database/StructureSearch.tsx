import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr/immutable";
import type { SimilarGame } from "@/bindings";
import { similarGames } from "@/utils/dbLearning";

function StructureSearch({ path, fen }: { path: string; fen: string }) {
  const { t } = useTranslation();

  const {
    data: games,
    error,
    isLoading,
    mutate,
  } = useSWR(path && fen ? ["similar-games", path, fen] : null, ([, path, fen]) =>
    similarGames(path, fen, 30),
  );

  return (
    <Stack gap="sm" style={{ flex: 1, overflow: "hidden" }}>
      <Group justify="space-between" w="100%" wrap="nowrap">
        <Text fz="xs" c="dimmed">
          {t("Board.Database.StructuresHint")}
        </Text>
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label={t("Common.Search")}
          onClick={() => mutate()}
          loading={isLoading}
        >
          <IconRefresh size="1rem" />
        </ActionIcon>
      </Group>

      {error && <Alert color="red">{error.toString()}</Alert>}

      <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ScrollArea flex={1} offsetScrollbars>
          <Table highlightOnHover fz="sm" withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="28%">{t("Fen.White")}</Table.Th>
                <Table.Th w="28%">{t("Fen.Black")}</Table.Th>
                <Table.Th w={70}>{t("Board.Analysis.Result")}</Table.Th>
                <Table.Th w={90}>{t("Common.Date")}</Table.Th>
                <Table.Th w={110}>{t("Board.Database.MatchedPlies")}</Table.Th>
                <Table.Th>{t("Board.Database.FirstPly")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading && !games && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text fz="sm" c="dimmed">
                      {t("Common.Loading")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {games && games.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text fz="sm" c="dimmed">
                      {t("Board.Database.NoResults")}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {games?.map(({ game, ply, matched_plies }: SimilarGame) => (
                <Table.Tr key={game.id}>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>
                        {game.white}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {!game.white_elo ? "Unrated" : game.white_elo}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>
                        {game.black}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {!game.black_elo ? "Unrated" : game.black_elo}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>{game.result}</Table.Td>
                  <Table.Td>{game.date ?? "—"}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color="indigo">
                      {t("Board.Database.MatchedPlies", { count: matched_plies })}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="xs" c="dimmed">
                      {t("Board.Database.FirstPly", { ply })}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Box>
    </Stack>
  );
}

export default memo(StructureSearch);
