# Sephora Memory Match

SEPHORA COLLECTION TOUCHSCREEN GAME

Assumptions: Build a standalone Lovable web app for a Sephora Collection in-store/event touchscreen activation. The app must visually match the attached reference: vertical rounded white kiosk card, black Sephora header, bold “MEMORY GAME” title with pink accent, grid of black circular Sephora Collection tokens, large countdown timer, and pink progress bar. No physical printer is required for this version.

Build a production-grade touchscreen web game in Lovable.

PROJECT
Sephora Collection — IT’S A STRETCH Game

CORE GAME LOGIC
- The screen shows several circular Sephora Collection logo tokens.
- The player must find 2 hidden “IT’S A STRETCH” mascaras.
- The player has 3 attempts total.
- Each tap reveals what is behind a logo token.
- If the player finds the 2 mascara products before using all attempts, they win.
- If the player uses all 3 attempts without finding both mascaras, they lose.
- Include an admin-configurable mode for future adjustment:
 - target products required: 2 by default, configurable to 3
 - attempts allowed: 3 by default, configurable
 - game duration: 10 seconds by default, configurable
 - grid size: 20 tokens by default, configurable
- If the timer reaches 0 before completion, the player loses.
- Prevent double taps and accidental repeated selection.
- Randomize product positions for every session.

VISUAL DIRECTION
- Match the attached reference closely.
- Vertical mobile/kiosk format centered on a black background.
- Main game container:
 - large rounded white rectangle
 - soft shadow
 - generous spacing
 - optimized for vertical touchscreen display
- Header:
 - small black hamburger icon
 - “SEPHORA” wordmark text
- Main title:
 - “MEMORY” in black
 - “GAME” in Sephora pink
- Instruction text in French:
 - “RETROUVEZ 2 MASCARAS IT’S A STRETCH EN 3 ESSAIS !”
- Grid:
 - black circular buttons
 - white “SEPHORA COLLECTION” text
 - 4 columns x 5 rows by default
 - selected token has pink outline
 - revealed target shows a stylized mascara product card
 - revealed wrong token shows a clean neutral product/empty state
- Bottom:
 - large countdown number in Sephora pink
 - horizontal progress bar with pink fill and light gray track
- Result screens:
 - Win: “BRAVO, C’EST GAGNÉ !”
 - Lose: “DOMMAGE, RETENTEZ VOTRE CHANCE !”
 - CTA: “REJOUER”
- Use a polished, premium, retail-event feel.

TECH STACK
- Next.js App Router
- TypeScript strict
- TailwindCSS
- shadcn/ui
- Zustand for game state
- React Query if server data is needed
- Zod for validation
- Prisma + PostgreSQL for session tracking
- Optional Auth.js admin access
- Vitest unit tests
- Playwright E2E tests
- ESLint, Prettier
- .env.example
- README
- GitHub Actions CI

ROUTES
- `/` redirects to `/game`
- `/game` fullscreen touchscreen game
- `/admin` protected admin dashboard
- `/admin/settings` game settings
- `/admin/sessions` session analytics

DATA MODEL
Create Prisma models:
- GameConfig:
 - id
 - title
 - targetProductName
 - targetsRequired
 - attemptsAllowed
 - durationSeconds
 - gridSize
 - brandColor
 - isActive
 - createdAt
 - updatedAt
- GameSession:
 - id
 - score
 - targetsFound
 - attemptsUsed
 - result: WIN | LOSS | TIMEOUT
 - durationSeconds
 - createdAt

ADMIN FEATURES
- Update title, instruction text, attempts, target count, timer, grid size.
- View session count, win rate, average attempts, average completion time.
- Export sessions as CSV.
- Reset demo data.

UX REQUIREMENTS
- Touchscreen-first.
- No hover-only interactions.
- Large tap areas.
- Smooth reveal animations.
- Clear disabled states.
- Loading and error states.
- Works fullscreen on a tablet or vertical event screen.
- Keyboard accessible for testing.
- WCAG 2.2 AA.

FEASIBILITY NOTES TO INCLUDE IN README
- Fully feasible in Lovable/browser:
 - touchscreen gameplay
 - randomization
 - timer
 - local/session tracking
 - admin settings
 - analytics
- Not directly controlled by Lovable:
 - physical kiosk lock mode
 - native device sleep prevention beyond browser APIs
- Suggested solution:
 - run the deployed app in Chrome/Edge kiosk mode on the event touchscreen
 - disable system sleep at OS level
 - test touch calibration before event

TESTING
- Unit test win/loss logic.
- Unit test timer timeout.
- Unit test random placement includes exact number of targets.
- Playwright test complete winning flow.
- Playwright test losing flow after 3 wrong attempts.
- Playwright test timeout flow.

DELIVERY
Generate the full Lovable project with:
- repo structure
- components
- pages
- Prisma schema
- seed data
- admin dashboard
- README
- .env.example
- tests
- CI workflow

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stretch-mascara-match.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/95a15f0e-293c-433a-966e-ecbcfaa83901).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
