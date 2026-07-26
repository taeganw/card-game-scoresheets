# River Scoresheets

A static, phone-first scoresheet for Up the River, Down the River.

Open `index.html` locally or publish the folder with GitHub Pages.

## Current scoring

- Board: exact all-tricks bid scores `5 x tricks`; missing it loses `3 x bid`.
- Exact bid: scores `3 x tricks`.
- Under bid: loses `3 x bid`.
- Over-bid behavior is configurable in setup.
- Each player has a running count of bids hit and bids missed under.
- Board, exact-bid, and under-bid point multipliers are configurable before play.

The default highest round leaves one card for trump. With two players and a 52-card deck, the highest round is 25 because each player gets 25 cards and one card is flipped for trump. The highest round is played twice: once up river and once down river.

Players should be entered in clockwise table order. Pick a starting dealer in setup, or the app randomly chooses one when scoring starts. Dealer rotates to the next player each round.

The site includes matching favicon, Apple touch icon, and web app manifest icons. The Wake button uses the Screen Wake Lock API where supported to help prevent the phone from sleeping while scoring.
