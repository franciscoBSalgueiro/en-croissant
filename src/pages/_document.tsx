import { useLocalStorage } from "@mantine/hooks";
import { createGetInitialProps } from "@mantine/next";
import { DocumentContext, Head, Html, Main, NextScript } from "next/document";

const getInitialProps = createGetInitialProps();

function Document({}: DocumentContext) {
  const [pieceSet] = useLocalStorage({
    key: "piece-set",
    defaultValue: "staunty",
  });

  return (
    <Html>
      <Head>
        <link rel="stylesheet" href={`/pieces/${pieceSet}.css`} />
        <script src="http://localhost:8097"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = getInitialProps;

export default Document;
