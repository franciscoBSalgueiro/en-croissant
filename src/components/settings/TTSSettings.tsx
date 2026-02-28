import {
  Button,
  Group,
  PasswordInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import {
  ttsApiKeyAtom,
  ttsAutoNarrateAtom,
  ttsEnabledAtom,
  ttsGoogleApiKeyAtom,
  ttsGoogleGenderAtom,
  ttsLanguageAtom,
  ttsProviderAtom,
  ttsSpeedAtom,
  ttsVoiceIdAtom,
  ttsVolumeAtom,
} from "@/state/atoms";
import {
  clearAudioCache,
  type ElevenLabsVoice,
  listVoices,
  speakText,
  stopSpeaking,
} from "@/utils/tts";

export function TTSEnabledSwitch() {
  const [enabled, setEnabled] = useAtom(ttsEnabledAtom);
  return (
    <Switch
      checked={enabled}
      onChange={(e) => setEnabled(e.currentTarget.checked)}
    />
  );
}

export function TTSAutoNarrateSwitch() {
  const [autoNarrate, setAutoNarrate] = useAtom(ttsAutoNarrateAtom);
  return (
    <Switch
      checked={autoNarrate}
      onChange={(e) => setAutoNarrate(e.currentTarget.checked)}
    />
  );
}

export function TTSProviderSelect() {
  const [provider, setProvider] = useAtom(ttsProviderAtom);
  return (
    <Select
      w="14rem"
      data={[
        { value: "elevenlabs", label: "ElevenLabs" },
        { value: "google", label: "Google Cloud" },
      ]}
      value={provider}
      onChange={(v) => v && setProvider(v)}
      allowDeselect={false}
    />
  );
}

export function TTSGoogleApiKeyInput() {
  const [apiKey, setApiKey] = useAtom(ttsGoogleApiKeyAtom);
  const [tempKey, setTempKey] = useState(apiKey);

  useEffect(() => {
    setTempKey(apiKey);
  }, [apiKey]);

  return (
    <Group gap="xs">
      <PasswordInput
        w="20rem"
        placeholder="AIza..."
        value={tempKey}
        onChange={(e) => setTempKey(e.currentTarget.value)}
        onBlur={() => setApiKey(tempKey)}
      />
    </Group>
  );
}

export function TTSApiKeyInput() {
  const [apiKey, setApiKey] = useAtom(ttsApiKeyAtom);
  const [tempKey, setTempKey] = useState(apiKey);

  useEffect(() => {
    setTempKey(apiKey);
  }, [apiKey]);

  return (
    <Group gap="xs">
      <PasswordInput
        w="20rem"
        placeholder="sk_..."
        value={tempKey}
        onChange={(e) => setTempKey(e.currentTarget.value)}
        onBlur={() => setApiKey(tempKey)}
      />
    </Group>
  );
}

export function TTSVoiceSelect() {
  const [voiceId, setVoiceId] = useAtom(ttsVoiceIdAtom);
  const [apiKey] = useAtom(ttsApiKeyAtom);
  const [provider] = useAtom(ttsProviderAtom);
  const [language] = useAtom(ttsLanguageAtom);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVoices = useCallback(async () => {
    if (!apiKey || provider !== "elevenlabs") return;
    setLoading(true);
    try {
      const v = await listVoices(apiKey);
      setVoices(v);
    } catch (e) {
      console.error("Failed to fetch voices:", e);
    } finally {
      setLoading(false);
    }
  }, [apiKey, provider]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const [gender, setGender] = useAtom(ttsGoogleGenderAtom);
  const testPhrase = getTestPhrase(language);

  if (provider === "google") {
    return (
      <Group gap="xs">
        <Select
          w="10rem"
          data={[
            { value: "MALE", label: "Male" },
            { value: "FEMALE", label: "Female" },
          ]}
          value={gender}
          onChange={(v) => v && setGender(v)}
          allowDeselect={false}
        />
        <Button
          size="xs"
          variant="light"
          onClick={() => {
            speakText(testPhrase);
          }}
        >
          Test
        </Button>
      </Group>
    );
  }

  const voiceOptions = voices.map((v) => ({
    value: v.voice_id,
    label: `${v.name} (${v.category})`,
  }));

  return (
    <Group gap="xs">
      <Select
        w="20rem"
        data={voiceOptions}
        value={voiceId}
        onChange={(v) => v && setVoiceId(v)}
        placeholder={loading ? "Loading voices..." : "Select voice"}
        searchable
        disabled={!apiKey}
      />
      <Button
        size="xs"
        variant="light"
        disabled={!apiKey || !voiceId}
        onClick={() => {
          speakText(testPhrase);
        }}
      >
        Test
      </Button>
    </Group>
  );
}

const TTS_TEST_PHRASES: Record<string, string> = {
  en: "Knight to f3, check. A strong developing move.",
  fr: "Cavalier f3, échec. Un coup de développement fort qui contrôle le centre.",
  es: "Caballo f3, jaque. Un fuerte movimiento de desarrollo que controla el centro.",
  de: "Springer f3, Schach. Ein starker Entwicklungszug, der das Zentrum kontrolliert.",
  ja: "ナイト f3、チェック。センターを支配する強い展開の手。",
  ru: "Конь f3, шах. Сильный развивающий ход, контролирующий центр.",
  zh: "马 f3，将军。一步控制中心的强力出子。",
};

function getTestPhrase(lang: string): string {
  return TTS_TEST_PHRASES[lang] || TTS_TEST_PHRASES.en;
}

const TTS_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "ru", label: "Русский" },
  { value: "zh", label: "中文" },
];

export function TTSLanguageSelect() {
  const [language, setLanguage] = useAtom(ttsLanguageAtom);

  return (
    <Select
      w="12rem"
      data={TTS_LANGUAGE_OPTIONS}
      value={language}
      onChange={(v) => v && setLanguage(v)}
      allowDeselect={false}
    />
  );
}

export function TTSClearCacheButton() {
  const [cleared, setCleared] = useState(false);

  return (
    <Button
      size="xs"
      variant="light"
      color={cleared ? "green" : undefined}
      onClick={() => {
        stopSpeaking();
        clearAudioCache();
        setCleared(true);
        setTimeout(() => setCleared(false), 2000);
      }}
    >
      {cleared ? "Cache Cleared" : "Clear Audio Cache"}
    </Button>
  );
}

export function TTSVolumeSlider() {
  const [volume, setVolume] = useAtom(ttsVolumeAtom);
  const [tempVolume, setTempVolume] = useState(volume * 100);

  useEffect(() => {
    setTempVolume(volume * 100);
  }, [volume]);

  return (
    <Slider
      min={0}
      max={100}
      marks={[
        { value: 20, label: "20%" },
        { value: 50, label: "50%" },
        { value: 80, label: "80%" },
      ]}
      w="15rem"
      value={tempVolume}
      onChange={(value) => {
        setTempVolume(value as number);
      }}
      onChangeEnd={(value) => {
        setVolume(value / 100);
        speakText("Volume set.").catch(() => {});
      }}
    />
  );
}

export function TTSSpeedSlider() {
  const [speed, setSpeed] = useAtom(ttsSpeedAtom);
  const [tempSpeed, setTempSpeed] = useState(speed * 100);

  useEffect(() => {
    setTempSpeed(speed * 100);
  }, [speed]);

  return (
    <Slider
      min={50}
      max={200}
      step={5}
      marks={[
        { value: 75, label: "0.75x" },
        { value: 100, label: "1x" },
        { value: 150, label: "1.5x" },
      ]}
      w="15rem"
      value={tempSpeed}
      onChange={(value) => {
        setTempSpeed(value as number);
      }}
      onChangeEnd={(value) => {
        setSpeed(value / 100);
        speakText("Speed set.").catch(() => {});
      }}
    />
  );
}
