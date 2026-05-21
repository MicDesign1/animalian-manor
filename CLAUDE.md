# Animalian Manor — Claude Code Instructions

You are helping build **Animalian Manor**, a creature-collecting card battle web app. Read the full `Animalian_Manor_Project_Bible.docx` in this folder for complete details. Below is a summary of the critical rules.

## What This Project Is
A wholesome Victorian naturalist creature-collecting card game. The player inherited a manor from Uncle Argon, a world-famous zoologist. They explore rooms to create creatures, battle, trade, and discover secrets.

## Tech Stack
- **Framework:** React (Vite)
- **Hosting:** Netlify (animalianmanor.com)
- **Data storage:** localStorage (no backend for V1)
- **AI art (V1.5):** Replicate API (SDXL img2img) for "Pokefy" feature
- **Routing:** React Router

## Art Direction — CRITICAL
Victorian naturalist / zoologist aesthetic. Warm, wholesome, handcrafted.

**USE:** warm, aged, handwritten, botanical, field notes, brass hardware, ink sketches, candlelit, specimen jars, leather-bound, wax seal, explorer's journal, parchment, wooden shelves, naturalist, Victorian, overgrown garden

**NEVER USE:** neon, futuristic, chrome, digital, pixel, glitch, cyber, hologram, laser, metallic, sci-fi, high-tech, minimalist, flat UI, corporate

## Color Palette
| Name | Hex | Use |
|------|-----|-----|
| Dark Oak | #2C1810 | Text, heavy borders |
| Walnut | #5C3A1E | Card headers, walls, UI bars |
| Brass | #8B6914 | Buttons, frames, hinges |
| Aged Gold | #C49A3C | Badges, accents, coins |
| Leather | #D4A574 | Backgrounds, straps |
| Parchment | #E8C9A0 | Card backgrounds, notes |
| Cream | #FFF8E7 | Card bodies, highlights |
| Linen | #F5F0E1 | Page backgrounds |

## Type Ink Colors
| Type | Color | Hex | Strong Against | Weak Against |
|------|-------|-----|----------------|--------------|
| Ember | Red/Orange | #8B2500 | Thorn | Tide |
| Tide | Blue | #1B4F72 | Ember | Storm |
| Thorn | Green | #1E5631 | Tide | Ember |
| Storm | Yellow/Gold | #7D5A00 | Tide | Thorn |
| Phantom | Purple | #4A1942 | All (1.25x) | All (0.75x) |
| Iron | Gray/Black | #1A1A1A | None | None |

## Typography
- **Display/headings:** Cinzel (or Georgia serif) — room names, creature names, card titles
- **Lore/journal text:** Crimson Text italic (or Georgia italic) — journal entries, flavor text
- **UI/stats/buttons:** System sans-serif — HP numbers, stat labels, navigation

## Card Design
- Parchment background (#FFF8E7)
- Dark wood header bar (#5C3A1E) with creature name (serif, left) + HP (right)
- Large art window (~40% of card)
- Type badge (pill shape with type icon)
- Two attack slots with type ink color accent
- Bottom stats bar: ATK, DEF, SPD
- Border color matches creature type ink color

## Stat Ranges
- HP: 50–200
- Attack: 10–100
- Defense: 10–100
- Speed: 10–100

## Battle System
- Turn order by Speed (higher goes first, ties random)
- Damage = Attack − Defense (minimum 5)
- Type advantage: 1.5x damage; disadvantage: 0.75x
- Each player uses up to 5 creatures
- Winner earns coins

## Manor Rooms (Build Order)
1. **Manor Map** — home screen with tappable room hotspots ✅ BUILT
2. **Creature Card** — single card component (next step)
3. **Card Type Themes** — border/style per type
4. **The Lab** — creator form + live card preview
5. **Menagerie Garden** — browse collection
6. **Battle Screen** — two cards with HP bars
7. **Damage Formula** — type advantages + winner screen
8. **Coin Rewards** — earnings from battles
9. **Polish & Deploy**

## V1 Scope
**IN:** Manor map, Lab, Menagerie Garden, Arena, basic coins
**OUT (V2+):** Parlor, Hidden Vault, Study, gems, booster packs, AI Pokefy

## Important Notes
- This app is being built by two kids (ages 10-12) with adult supervision
- Keep code clear and well-commented
- The Hidden Vault is behind a secret bookcase in the Study — NOT shown on the map
- Uncle's name is still TBD (placeholder: Uncle Argon)
- No scary, dark, or violent content — keep it wholesome
