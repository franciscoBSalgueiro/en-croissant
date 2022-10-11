import { Button } from "@mantine/core";
import { useToggle } from "@mantine/hooks";

function LoadingButton({
  onClick,
  children,
}: {
  onClick: () => Promise<any>;
  children: React.ReactNode;
}) {
  const [loading, toggleLoading] = useToggle();
  return (
    <Button
      loading={loading}
      onClick={() => {
        toggleLoading();
        onClick().then(() => toggleLoading());
      }}
    >
      {children}
    </Button>
  );
}

export default LoadingButton;
