# Word Forge: gameplay spec

Version 0.1, 2 November 2026. Starting numbers; playtests tune them.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
"RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in
BCP 14 (RFC 2119, RFC 8174) when, and only when, they appear in all capitals, as shown here.

## 1. The round

1.1 Each day MUST have one 5×5 board, the same for every player, chosen by the UTC date.
1.2 A board MUST hold 8 to 10 vowels, and no letter more than 3 times (2 for B, F, G, K, M, P, V, W, Y).
1.3 The round MUST last 90 seconds, counted from the first press of Play.
1.4 A word MUST be at least 3 letters and MUST trace on the board through touching cells
    (diagonals count, no cell used twice), whether it is dragged or typed.

## 2. Targets

2.1 Each day MUST have 12 target words: 4 of three letters, 5 of four, 3 of five.
    A board that lacks the mix MUST be redrawn, up to 30 times; only then MAY a gap be filled
    with the next shorter length. (Measured: 325 of 365 boards hold the mix on the first draw.)
2.2 Every target MUST come from the everyday list (words most adults know and use).
2.3 The targets MUST show as blank slots grouped by length before the round starts
    (for example `▢▢▢ ▢▢▢ ▢▢▢▢`), so the player knows how many of each length to hunt.
2.4 A found target MUST fill its slot with the word. A word that scores but is not a target
    MUST appear in a separate "bonus" list, in a different color.
2.5 Finding all 12 targets MUST end the round early.
2.6 After the round, the targets the player missed MUST be shown.

## 3. Scoring and grade

3.1 Any real word on the board MUST score: letters × 10; × 2 at 5 or 6 letters; × 5 at 7 or more.
3.2 These multipliers MUST be labelled as long-word bonuses, not as "rare" words.
3.3 Time left when all targets are found MUST add 20 points per second.
3.4 The grade MUST count targets only: A at 11 or 12, B at 9 or 10, C at 6 to 8, D at 3 to 5, F below 3.
3.5 A wrong submission MUST NOT cost points; the lost seconds are the cost.

## 4. One scored round a day

4.1 Only the first finished round of the day MUST count toward score, grade, streak and achievements.
4.2 Replays of the same day's board MAY be played, and MUST be marked "practice" on screen.
4.3 A practice round MUST NOT change the best score, the streak, or the share result.
4.4 Opening the game after the day's round MUST show that day's result and the time until the next board.

## 5. Feedback and sound

5.1 Every find, miss, repeat, and the last 10 seconds MUST each have a short sound, made in the
    browser with no sound files.
5.2 Sound MUST be off-able with one button, and with the M key between rounds (during a round M is
    a letter), and the choice MUST be remembered.
5.3 A miss MUST name its reason ("Not a word", "Not on the board", "Already found").
5.4 The help screen MUST show how to play in three lines or fewer before the first round on a device.

## 6. Sharing

6.1 Share MUST copy a result that does not spoil the board: the date, the grade, the targets
    found as one row of squares per length, the score, and the link. For example:

        Word Forge · 2 Nov · B
        3 ■■■■
        4 ■■■■□
        5 ■■□
        612 · <link>

6.2 A share picture of the result SHOULD come later; the text result comes first.

## 7. Streaks and badges

7.1 The streak MUST count boards with a scored round, in a row, by each board's date, so one board
    never counts twice and no board is skipped when a player's evening crosses midnight UTC.
7.2 Badges SHOULD mark 7, 30 and 100 days in a row.
7.3 The 8 current achievements MUST be kept, and MUST unlock from scored rounds only.

## 8. Safety

8.1 Slurs whose main meaning is hate MUST NOT score (the block list in `js/puzzle.js`); words with a
    real other meaning, like queer or chink, MUST stay playable.
8.2 Before launch, 30 seconds of play with the screen shake, sparks and confetti MUST be recorded
    and measured, and the screen MUST NOT flash more than 3 times in any one second.
8.3 With the system's reduce-motion setting on, the shake and confetti MUST be off.

## 9. Not in this version

9.1 Hints that cost points MAY come later (one first letter of an unfound target).
9.2 A server leaderboard, accounts and ads MUST NOT be added in this version.
9.3 Practice boards that are not the day's board MAY come later.
