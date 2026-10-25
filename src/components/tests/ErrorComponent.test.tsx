import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import ErrorComponent from "../ErrorComponent";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => Promise.resolve(),
}));

test("renders an error whose cause is not a string", () => {
  const error = new Error("request failed", { cause: { status: 500 } });

  expect(() =>
    renderToStaticMarkup(
      <MantineProvider>
        <ErrorComponent error={error} />
      </MantineProvider>,
    ),
  ).not.toThrow();
});

test("renders a non error value that cannot be serialized", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  expect(() =>
    renderToStaticMarkup(
      <MantineProvider>
        <ErrorComponent error={circular} />
      </MantineProvider>,
    ),
  ).not.toThrow();
});
