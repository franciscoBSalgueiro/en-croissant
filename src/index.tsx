import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import i18n from "i18next";
import { createRoot } from "react-dom/client";
import { initReactI18next } from "react-i18next";
import App from "./App";

import be_BY from "./translation/be-BY.json";
import de_DE from "./translation/de-DE.json";
import en_GB from "./translation/en-GB.json";
import en_US from "./translation/en-US.json";
import es_ES from "./translation/es-ES.json";
import fr_FR from "./translation/fr-FR.json";
import it_IT from "./translation/it-IT.json";
import ko_KR from "./translation/ko-KR.json";
import nb_NO from "./translation/nb-NO.json";
import pl_PL from "./translation/pl-PL.json";
import pt_PT from "./translation/pt-PT.json";
import ru_RU from "./translation/ru-RU.json";
import tr_TR from "./translation/tr-TR.json";
import uk_UA from "./translation/uk-UA.json";
import zh_CN from "./translation/zh-CN.json";
import zh_TW from "./translation/zh-TW.json";

i18n.use(initReactI18next).init({
  resources: {
    "en-US": en_US,
    "en-GB": en_GB,
    "pt-PT": pt_PT,
    "zh-CN": zh_CN,
    "ru-RU": ru_RU,
    "uk-UA": uk_UA,
    "be-BY": be_BY,
    "nb-NO": nb_NO,
    "pl-PL": pl_PL,
    "es-ES": es_ES,
    "it-IT": it_IT,
    "fr-FR": fr_FR,
    "tr-TR": tr_TR,
    "ko-KR": ko_KR,
    "zh-TW": zh_TW,
    "de-DE": de_DE,
  },
  lng: localStorage.getItem("lang") || "en-US",
  fallbackLng: "en-US",
  returnEmptyString: false,
});

dayjs.extend(customParseFormat);

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
