# Personal Games

A home for small browser games. Each game is a **self-contained Vite app** in `games/<name>/` with its own dependencies, lockfile, tests and Vercel project, so working on or deploying one game never affects another.

| Game | What it is |
|---|---|
| [Pulse](games/pulse) | An aim trainer that feels like a game: six modes, synthesized audio, run stats. |
| [Drift](games/drift) | A calming breathing and attention game: breathe, notice, return. |
| [Inkway](games/inkway) | Draw the road with your mouse, drive it with your keyboard: a neon physics racer. |
| [Flipline](games/flipline) | One-button neon stunt bike: hold to ride, hold to flip, land clean. 12 levels with loops. |

## Everyday commands (from this folder)

```bash
npm run games                 # list games
npm run dev -- drift          # start one game
npm run test -- drift         # its unit/component tests
npm run build -- pulse        # production build

npm run install:all           # npm install in every game
npm run test:all              # test everything
npm run build:all             # build everything
```

These are thin wrappers around `npm --prefix games/<name> run <script>`, so `cd games/drift && npm run dev` works the same way.

## Adding a new game

```bash
npm run new-game star-catcher
npm run dev -- star-catcher
```

This copies [`templates/starter`](templates/starter): React, TypeScript, Vite, Motion and Zustand, plus Vitest and Testing Library with a passing example test. It fills in the name and title and runs `npm install`. Names are lowercase letters, digits and dashes.

## Deploying (Vercel)

Each game links to **its own** Vercel project through the `.vercel/` folder inside the game's directory. That folder is git-ignored, and it's what keeps deploys independent.

```bash
cd games/pulse && vercel --prod     # already linked → project "pulse-aim-trainer"
cd games/drift && vercel            # first time: creates/links a new project, then `vercel --prod`
```

Run `vercel` from inside the game folder, never from the repo root. The root isn't an app, and running there would try to link a new project.

If you later connect a Vercel project to a Git repository instead of deploying from the CLI, set that project's **Root Directory** to `games/<name>` in the Vercel dashboard.

## Layout

```
games/
  pulse/        aim trainer (Vercel-linked)
  drift/        breathing & focus game
  inkway/       draw-the-road physics racer
  flipline/     one-button stunt bike
templates/
  starter/      what `npm run new-game` copies
scripts/
  games.mjs     list / new / run / install
```
