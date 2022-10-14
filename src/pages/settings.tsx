import dynamic from 'next/dynamic';

const  EngineTable = dynamic(() => import('../components/EngineTable'), { ssr: false })

export default function Page() {
  return (
    <div>
      <EngineTable />
      {/* <LoadingButton
        onClick={() =>
          downloadEngine(
            "https://stockfishchess.org/files/stockfish_15_win_x64_avx2.zip"
          )
        }
      >
        Download Stockfish
      </LoadingButton>
      <LoadingButton
        onClick={() =>
          downloadEngine("http://komodochess.com/pub/komodo-13.zip")
        }
      >
        Download Komodo 13
      </LoadingButton> */}
    </div>
  );
}
