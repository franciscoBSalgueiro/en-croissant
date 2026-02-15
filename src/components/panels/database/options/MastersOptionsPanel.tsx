import { masterOptionsAtom } from "@/state/atoms";
import { MIN_DATE } from "@/utils/lichess/api";
import { Group } from "@mantine/core";
import { YearPickerInput } from "@mantine/dates";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";

const MasterOptionsPanel = () => {
  const { t } = useTranslation();
  const [options, setOptions] = useAtom(masterOptionsAtom);
  return (
    <Group grow>
      <YearPickerInput
        label={t("Common.Since")}
        placeholder={t("Common.PickDate")}
        value={options.since}
        minDate={MIN_DATE}
        maxDate={new Date()}
        onChange={(value) =>
          setOptions({ ...options, since: value ? new Date(value) : undefined })
        }
        clearable
      />
      <YearPickerInput
        label={t("Common.Until")}
        placeholder={t("Common.PickDate")}
        value={options.until}
        minDate={MIN_DATE}
        maxDate={new Date()}
        onChange={(value) =>
          setOptions({ ...options, until: value ? new Date(value) : undefined })
        }
        clearable
      />
    </Group>
  );
};

export default MasterOptionsPanel;
