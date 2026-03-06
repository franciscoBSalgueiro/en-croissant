import { Input, type InputWrapperProps, Text } from "@mantine/core";

function FileInput({
  label,
  description,
  filename,
  onClick,
  withAsterisk,
  disabled,
  ...props
}: {
  label?: string;
  description?: string;
  filename: string | null;
  onClick: () => void;
  withAsterisk?: boolean;
  disabled?: boolean;
} & Omit<InputWrapperProps, "children">) {
  return (
    <Input.Wrapper withAsterisk={withAsterisk} label={label} description={description} {...props}>
      <Input component="button" type="button" onClick={onClick} disabled={disabled}>
        <Text lineClamp={1}>{filename}</Text>
      </Input>
    </Input.Wrapper>
  );
}

export default FileInput;
