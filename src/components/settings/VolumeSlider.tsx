import { soundVolumeAtom } from "@/state/atoms";
import { playSound } from "@/utils/sound";
import { Slider } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";

export default function VolumeSlider() {
  const [volume, setVolume] = useAtom(soundVolumeAtom);
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
        playSound(false, false);
      }}
    />
  );
}
