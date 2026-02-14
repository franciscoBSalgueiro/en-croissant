import { vars } from "@/styles/theme";
import { globalStyle } from "@vanilla-extract/css";

globalStyle(".recent-file-row:hover", {
  [vars.darkSelector]: {
    backgroundColor: "var(--mantine-color-dark-5)",
  },
  [vars.lightSelector]: {
    backgroundColor: "var(--mantine-color-gray-1)",
  },
});
