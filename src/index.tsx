import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import i18n from "i18next";
import React from "react";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import App from "./App";

import { be_BY } from "./translation/be_BY";
import { en_US } from "./translation/en_US";
import { es_ES } from "./translation/es_ES";
import { fr_FR } from "./translation/fr_FR";
import { it_IT } from "./translation/it_IT";
import { nb_NO } from "./translation/nb_NO";
import { pl_PL } from "./translation/pl_PL";
import { pt_PT } from "./translation/pt_PT";
import { ru_RU } from "./translation/ru_RU";
import { tr_TR } from "./translation/tr_TR";
import { uk_UA } from "./translation/uk_UA";
import { zh_CN } from "./translation/zh_CN";

i18n.use(initReactI18next).init({
  resources: {
    en: en_US,
    pt_PT: pt_PT,
    zh_CN: zh_CN,
    ru_RU: ru_RU,
    uk_UA: uk_UA,
    be_BY: be_BY,
    nb_NO: nb_NO,
    pl_PL: pl_PL,
    es_ES: es_ES,
    it_IT: it_IT,
    fr_FR: fr_FR,
    tr_TR: tr_TR,
  },
  lng: localStorage.getItem("lang") || "en_US",
  fallbackLng: "en",
});

dayjs.extend(customParseFormat);

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
