# Inkway

*Draw the road. Drive the road.* Your **mouse paints the road** a few meters ahead of a speeding car, bike or monster truck. Your **keyboard drives** over whatever you just drew, across a neon void.

See [plan.md](plan.md) for the design.

```bash
npm run dev -- inkway     # from the repo root (or `npm run dev` here)
npm test                  # logic + headless physics + game integration (Vitest)
npm run e2e               # real-browser play-through in Chrome (Playwright)
```

## How it plays

| Hand | Input | Does |
|---|---|---|
| Left | **W / ↑**, **S / ↓** | Gas, brake/reverse |
| Left | **A / D**, **← / →** | Lean; flip in the air (flips refill ink) |
| Left | **Space**, **Shift** | Hop; slow time while held (drains Focus) |
| Right | **Hold & drag** | Draw ink: it becomes solid road immediately |
| Right | **Right-click** | Erase a stroke (half its ink back) |
| Either | **1 / 2 / 3**, scroll | Road (cyan), Bounce (pink pad that relaunches you), Boost (gold conveyor) |

You can't draw through your own vehicle. You fall into the void or land on your roof and the run ends. There's a daily ride with the same seed for everyone.

## How it's built

- **planck.js** (Box2D) handles the physics:
  - vehicles are a chassis plus two `WheelJoint`s, with motors and spring suspension;
  - ink and terrain are `Chain` shapes;
  - boost uses contact tangent speed;
  - bounce actively relaunches the vehicle along the pad's normal (plain restitution would be soaked up by the suspension).
- **The world is procedural and seeded:** gaps widen and cliffs appear with distance, and every gap has an ink drop so the economy can't strand you.
- **Canvas 2D neon rendering:** every glow is a cheap double stroke (a wide translucent pass plus a thin bright one) instead of `shadowBlur`.
- **React shell:** the title screen runs the real game on autopilot. Hints are contextual: at the first gap, time slows and a ghost line shows where to draw.
- **All sound is synthesized:** the engine follows wheel speed, there's a pen-scribble sound while drawing, and a synthwave loop.
