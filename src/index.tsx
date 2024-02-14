import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat)

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
