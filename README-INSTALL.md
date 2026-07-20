# FPL Daily Challenge — cleaned project structure

This pack splits the large inline `index.html` into maintainable files without changing the current challenge or game rules.

## Add these files to the repository

```text
index.html
data/
  todays-challenge.js
  players.js
  challenges.js
js/
  helpers.js
  game.js
  visual-enhancements.js
css/
  game.css
```

Keep the repository's existing `visuals.css` file in the root. It is still loaded after `css/game.css`, so its Version 4 visual overrides continue to work.

## Daily update workflow

Only edit:

```text
data/todays-challenge.js
```

The challenge history, player database, game engine and page structure no longer need to be touched for a normal daily challenge update.

## Script order

The scripts at the bottom of `index.html` are intentionally loaded in this order:

1. today's challenge
2. helpers
3. player data
4. challenge history
5. game engine
6. visual enhancements

Do not reorder them unless the dependencies are changed.
