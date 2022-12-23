/* https://github.com/react-chess/chessground */

import { Chessground as ChessgroundApi } from 'chessground';
import { useEffect, useRef, useState } from 'react';

import { Api } from 'chessground/api';
import { Config } from 'chessground/config';

interface Props {
  width?: number
  height?: number
  contained?: boolean;
  config?: Config
}

function Chessground({
  width = 900, height = 900, config = {}, contained = false,
}: Props) {
  const [api, setApi] = useState<Api | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref && ref.current && !api) {
      const chessgroundApi = ChessgroundApi(ref.current, {
        animation: { enabled: true, duration: 200 },
        ...config,
      });
      setApi(chessgroundApi);
    } else if (ref && ref.current && api) {
      api.set(config);
    }
  }, [ref]);

  useEffect(() => {
    api?.set(config);
  }, [api, config]);

  return (
    <div style={{ height: contained ? '100%' : height, width: contained ? '100%' : width }}>
      <div ref={ref} style={{ height: '100%', width: '100%', display: 'table' }} />
    </div>
  );
}

export default Chessground;