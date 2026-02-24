import { type ComponentProps } from "react";

interface InlineInputProps extends ComponentProps<"input"> {
  value: string;
  /** When true, renders as a span. When false, renders as an input. */
  disabled?: boolean;
}

export const InlineInput = ({
  value,
  disabled,
  className,
  style,
  onChange,
  onKeyDown,
  ref,
  ...props
}: InlineInputProps) => {
  if (disabled) {
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={className}
        style={{
          cursor: "pointer",
          display: "block",
          width: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          ...style,
        }}
      >
        {value}
      </span>
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className={className}
      style={{
        fieldSizing: "content",
        display: "inline-block",
        cursor: "text",
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
      {...props}
    />
  );
};