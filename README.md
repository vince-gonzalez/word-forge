# Word Forge

A daily word game. One 5×5 letter board a day, the same for everyone.

## How to play

1. Drag across touching letters, or type, to make words of 3 or more letters.
2. Find the day's 12 targets. The boxes show how many of each length.
3. Your first round of the day counts. After that it's practice.

You have 90 seconds. Every real word scores 10 points a letter, ×2 at 5–6 letters and ×5 at 7 or more. Find all 12 targets and each second left adds 20.

Grades: A for 11–12 targets, B for 9–10, C for 6–8, D for 3–5, F under 3.

## Two more ways to play

- **Endless:** numbered puzzles (#1 to #999,999), one after another. Share a puzzle by its link.
- **Live round:** a new board every 2 minutes, the same for everyone playing at that moment. 90 seconds to play, 30 for results, then the next board starts.

Neither changes your daily score, streak or achievements.

## Run it on your own computer

Serve the folder with any static file server and open it in a browser, for example:

```
python -m http.server 8791
```

then open `http://127.0.0.1:8791/`.

## What's inside

- `index.html`, `css/`, `js/`: the game, plain HTML, CSS and JavaScript, no build step.
- `js/words.js`: the word list (ENABLE, a public-domain word-game list).
- `fonts/`: Orbitron and Rajdhani, under the SIL Open Font License (texts included).
- `SPEC.md`: the gameplay rules this build follows.
