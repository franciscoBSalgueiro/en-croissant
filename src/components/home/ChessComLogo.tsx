import { createStyles } from "@mantine/core";

const useStyles = createStyles((theme) => ({
  logo: {
    width: 35,
    height: 35
  },
}));

function ChessComLogo() {
  const { classes } = useStyles();
  return <img className={classes.logo} src="/chesscom.png" />;
}

export default ChessComLogo;
