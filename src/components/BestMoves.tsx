import { Paper, Table } from "@mantine/core";

function BestMoves({ engineMove }: { engineMove: String | null }) {
  return (
    <>
      <Paper p="md" radius="sm" withBorder>
        <h1>Stockfish</h1>
        <Table withBorder>
          <tbody>
            <tr>
              <td>Move 1</td>
              <td>Score 1</td>
            </tr>
            <tr>
              <td>Move 2</td>
              <td>Score 2</td>
            </tr>
          </tbody>
        </Table>
      </Paper>

      <Paper p="md" radius="sm" withBorder>
        <h1>Stockfish</h1>
        <Table withBorder>
          <tbody>
            <tr>
              <td>Move 1</td>
              <td>Score 1</td>
            </tr>
            <tr>
              <td>Move 2</td>
              <td>Score 2</td>
            </tr>
          </tbody>
        </Table>
      </Paper>
    </>
  );
}

export default BestMoves;
