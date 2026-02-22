import { defineConfig } from "i18next-cli";

export default defineConfig({
	locales: [
		"en_US",
		"en_GB",
		"pt_PT",
		"zh_CN",
		"ru_RU",
		"uk_UA",
		"be_BY",
		"nb_NO",
		"pl_PL",
		"es_ES",
		"it_IT",
		"fr_FR",
		"tr_TR",
		"ko_KR",
		"zh_TW",
		"de_DE",
	],
	extract: {
		input: ["src/**/*.{ts,tsx}"],
		output: "src/translation/{{language}}.json",
		ignore: ["src/translation/**"],
		// Keys use dots as part of the key name (e.g. "Common.On"), not as nesting separators
		keySeparator: false,
		nsSeparator: false,
		defaultNS: "translation",
		primaryLanguage: "en_US",
		defaultValue: "",
		removeUnusedKeys: true,
		sort: true,
	},
	types: {
		input: ["src/translation/en_US.json"],
		output: "src/i18next.d.ts",
		resourcesFile: "src/types/resources.d.ts",
	},
});
