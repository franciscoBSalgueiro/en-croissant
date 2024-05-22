import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { en_US } from "./translation/en_US";
import { zh_CN } from "./translation/zh_CN";

i18n.use(initReactI18next).init({
  resources: {
    en: en_US,
    zh_CN: zh_CN,
  },
  lng: "zh_CN",
  fallbackLng: "en",
});

dayjs.extend(customParseFormat);

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
