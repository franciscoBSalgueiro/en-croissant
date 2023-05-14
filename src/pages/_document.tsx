import { useLocalStorage } from "@mantine/hooks";
import { createGetInitialProps } from "@mantine/next";
import { DocumentContext, Head, Html, Main, NextScript } from "next/document";

const getInitialProps = createGetInitialProps();

function Document({}: DocumentContext) {
  return (
    <Html>
      <Head>
        {/* <script src="http://localhost:8097"></script> */}
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
