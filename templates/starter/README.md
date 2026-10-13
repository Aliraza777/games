# {{title}}

Scaffolded with `npm run new-game {{name}}` from the repo root.

```bash
npm run dev -- {{name}}     # from the repo root
npm run test -- {{name}}
```

Deploy: `cd games/{{name}} && vercel` links this folder to its own Vercel project the first time; after that `vercel --prod` ships it. Other games are unaffected.
