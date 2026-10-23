# Privacy policy: Analyze in En Croissant

Analyze in En Croissant reads the current URL and game-interface elements on
Chess.com and Lichess to add a link for the displayed game. All detection runs
locally in your browser.

The extension does not collect or store personal information, record browsing
history, use analytics, or send network requests. It has no extension servers.

When you choose **Analyze in En Croissant**, your browser passes the game's
canonical public URL to your installed En Croissant desktop application through
the `encroissant:` protocol. Query parameters, fragments, and Lichess player
secrets are removed. En Croissant then retrieves the game directly from the
chess service using its existing game import functionality.

The extension runs only on `https://chess.com`, `https://www.chess.com`, and
`https://lichess.org`. You can revoke site access or uninstall it through your
browser's extension settings.

Questions and reports: https://github.com/franciscoBSalgueiro/en-croissant/issues
