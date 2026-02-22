import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import i18n from "i18next";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import App from "./App";

import be_BY from "./translation/be_BY.json";
import de_DE from "./translation/de_DE.json";
import en_GB from "./translation/en_GB.json";
import en_US from "./translation/en_US.json";
import es_ES from "./translation/es_ES.json";
import fr_FR from "./translation/fr_FR.json";
import it_IT from "./translation/it_IT.json";
import ko_KR from "./translation/ko_KR.json";
import nb_NO from "./translation/nb_NO.json";
import pl_PL from "./translation/pl_PL.json";
import pt_PT from "./translation/pt_PT.json";
import ru_RU from "./translation/ru_RU.json";
import tr_TR from "./translation/tr_TR.json";
import uk_UA from "./translation/uk_UA.json";
import zh_CN from "./translation/zh_CN.json";
import zh_TW from "./translation/zh_TW.json";

i18n.use(initReactI18next).init({
  resources: {
    en_US: en_US,
    en_GB: en_GB,
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
    ko_KR: ko_KR,
    zh_TW: zh_TW,
    de_DE: de_DE,
  },
  lng: localStorage.getItem("lang") || "en_US",
  fallbackLng: "en_US",
});

dayjs.extend(customParseFormat);

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
