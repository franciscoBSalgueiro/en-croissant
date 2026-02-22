import { defineConfig } from "i18next-cli";

export default defineConfig({
	locales: [
		"en-US",
		"en-GB",
		"pt-PT",
		"zh-CN",
		"ru-RU",
		"uk-UA",
		"be-BY",
		"nb-NO",
		"pl-PL",
		"es-ES",
		"it-IT",
		"fr-FR",
		"tr-TR",
		"ko-KR",
		"zh-TW",
		"de-DE",
	],
	extract: {
		input: ["src/**/*.{ts,tsx}"],
		output: "src/translation/{{language}}.json",
		ignore: ["src/translation/**"],
		// Keys use dots as part of the key name (e.g. "Common.On"), not as nesting separators
		keySeparator: false,
		nsSeparator: false,
		defaultNS: "translation",
		mergeNamespaces: true,
		primaryLanguage: "en-US",
		defaultValue: null,
		removeUnusedKeys: true,
		sort: true,
	},
	types: {
		input: ["src/translation/en-US.json"],
		output: "src/i18next.d.ts",
		resourcesFile: "src/types/resources.d.ts",
	},
});
