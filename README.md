# ⚽ Footdle

**The ultimate football guessing game.** Guess the mystery player in a limited number of tries — think Wordle, but for football.

🔗 [Play it live](https://ceciyuu1-sudo.github.io/footballguessr/)

## Features

- 🎯 **Multiple difficulties** — Easy, Medium, Hard, and Legends, each drawing from a different pool of players
- 📅 **Daily Challenge** — one shared mystery player per day, same for everyone
- 💡 **Hints** — stuck? spend a hint to narrow it down
- 🔥 **Streaks & achievements** — track your win streak and unlock badges as you play
- 🏆 **Leaderboard** — see the fastest, most efficient wins from players around the world, ranked by fewest guesses
- 👥 **Multiplayer** — play head-to-head with friends in real time
- 🌍 **Multi-language** — available in English, French, Arabic, Spanish, Italian, and Japanese
- 🔊 **Sound & music** — fully synthesized sound effects, no audio files needed, with mute/volume controls
- 📊 **Personal stats** — games played, win rate, and streak tracking saved locally

## How to play

Type in a player's name and submit your guess. After each guess, you'll get clues about the mystery player (nationality, position, club, age, etc.) to help you narrow it down. Guess correctly within the attempt limit to win!

## Tech stack

- Vanilla HTML, CSS, and JavaScript — no build step, no frameworks
- [Supabase](https://supabase.com/) for the shared leaderboard backend
- Synthesized audio via the Web Audio API (no external sound files for SFX)
- Hosted with GitHub Pages

## Running it locally

This is a static site — no build tools required.

1. Clone or download the repo
2. Open `index.html` in a browser, or serve the folder with any static file server (e.g. the VS Code "Live Server" extension)

## Project structure

```
├── index.html       # Markup and screen layout
├── style.css         # All styling
├── script.js         # Core game logic, leaderboard, achievements, i18n
├── multiplayer.js    # Real-time multiplayer functionality
└── sounds/           # Audio assets
```

## Credits

Made by Vanitas.
