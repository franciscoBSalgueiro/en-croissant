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
  ttsSpeedAtom,
  ttsVoiceIdAtom,
  ttsVolumeAtom,
} from "@/state/atoms";
import {
  type ElevenLabsVoice,
  clearAudioCache,
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
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVoices = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const v = await listVoices(apiKey);
      setVoices(v);
    } catch (e) {
      console.error("Failed to fetch voices:", e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

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
          speakText("Knight to f3, check. A strong developing move.");
        }}
      >
        Test
      </Button>
    </Group>
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
