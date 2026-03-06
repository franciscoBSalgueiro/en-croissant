import { Image, type ImageProps } from "@mantine/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import useSWRImmutable from "swr/immutable";

function LocalImage(props: ImageProps & { alt?: string }) {
  const { data: imageSrc } = useSWRImmutable(["image", props.src], async ([, image]) => {
    if (image?.startsWith("http")) {
      return image;
    }
    if (image) {
      return await convertFileSrc(image);
    }
  });

  return <Image {...props} src={imageSrc} />;
}

export default LocalImage;
