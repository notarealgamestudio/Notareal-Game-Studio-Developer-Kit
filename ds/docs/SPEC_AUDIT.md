# Spec audit (24 Nov 2026): DeepSeek "Devkit Updates" brief + DeepSeek handoff v5.3 vs the kit
Evidence = what I read in the code and ran today. "Real" means run or clicked through; "Partly" says what is missing.

## The 8 asks in "Devkit Updates.txt"
| Ask | Status | Evidence / what is missing |
|---|---|---|
| Organise by game type (taxonomy sidebar) | Partly | Timeline palette groups (Screens & story, Open world, Action, Platformer, Racing, Fighting, Minigames...) and template families exist. The main menu has not been reorganised by the agreed taxonomy. |
| Game = timeline of scenes | Partly | Timeline editor, validator and PC runner exist (`nrtimeline.js`, `editor_timeline.js`; branching on win/lose/menu/flags/score/time). The DS ROM scene router (SCNS) runs only arcade engines and text cards, using their built-in content, not your designs. Other DS engines (RPG, fight, platformer) cannot be chained in one DS ROM. |
| Minigames as a reusable block library | Partly | 18 arcade engines and an arcade room with air hockey and claw machine (PC). No maze chase, QTE, trivia; air hockey / claw / room are PC only. |
| DS-only bottom-screen editor (buttons to scenes/events/popups) | Partly | Editor lane, validation and PC play exist. The DS ROM does not read the buttons. |
| Experiment area: custom 3D characters with presets | Not built | Only the 2D character builder and the cast/face tools exist. |
| Research lab -> recipe -> preset -> scene ("Frankenstein protocol") | Partly | Recipes tab applies measured/scanned numbers with undo (`nrrecipes.js`, `test_recipes.js`). It is not driven by every ROM scan automatically, and recipes cannot be dropped in as a timeline scene. |
| Remove kid mode | Done | No kid mode in the app. |
| NOTAREAL logo as program icon | Done | `icon.ico` set on the exe by the build. |

## Handoff v5.3 "new" modules
| Module | Status |
|---|---|
| ai_orchestrator.js + localai.cjs + model-manager.cjs + ops.gbnf | Partly (built 24 Nov): launcher, grammar, planner/tool loop, design tools. Real model never run; download untested; telemetry not built. |
| editor_timeline.js, preset_packs | Timeline: see above. Preset packs: not checked. |
| banner_designer / banner_tab | Partly: `patchBanner` writes the DS banner; the exporter applies it. No separate banner designer screen checked. |
| melody_editor.js | Not found as its own editor (music tab / Sigil only). |
| porting.js, tutor.js, gallery.js | Not found. |
| scene.inc / scene.h | Replaced by the SCNS router in the arcade engine (see above). |
| prompts.js, rom_knowledge.js, gamebuilder.js | Equivalent kit files exist (`nrai.js`, `nrknowledge.js`, `nrbuilder.js`). |

Also open from your messages: real click-through of the installed Windows app; the AI quality on a real model; AI tools for textures/backgrounds, skate park, store and faces.
