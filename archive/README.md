# Archive

Everything in this directory predates the current work and is kept for
provenance only. None of it is imported, built, deployed or tested, and none of
it should be treated as a reference for how the project works now — several of
these files contradict each other and one another's assumptions.

What is here, and why it is not in the live tree:

| Path | What it was | Why it is archived |
|---|---|---|
| `project-archipelago/` | The most complete earlier attempt: an Express backend, an Oracle/Mongo data layer, and a partial browser simulation split across ESM and CommonJS | Superseded. The island mathematics now lives in a single shader; the persistence layer was never wired to anything. |
| `404islands/`, `404islands-app/` | Two further partial backends with overlapping Postgres/Sequelize scaffolding | Superseded by `server/`, which has no dependencies and no database. |
| `IslandDemo.html`, `IslandSimulatorDemo.html`, `test.html` | Standalone canvas prototypes | Superseded by the WebGL renderer in `app/src/gl/`. |
| `perlin.js` | A CPU noise implementation | The terrain field is GLSL-only now, deliberately: one implementation cannot drift from another if there is only one. |
| `final_integrated_server.js`, `final_integrated_server_clean.js`, `simple_server.js`, `working_server.js` | Four competing server entry points | Superseded by `server/index.js`. |
| `database_service.js`, `database_setup.sql`, `fix_soda_manager.js` | Oracle SODA / Postgres experiments | The current build stores nothing but reservations, in a newline-delimited JSON file. |
| `ray_voxel.cpp`, `process_image.cpp`, `spacevoxelviewer.py`, `voxelmotionviewer.py`, `setup.py`, `examplebuildvoxelgridfrommotion.bat` | A voxel raytracer and its Python tooling, from an unrelated line of work | Not part of this project. |
| `ARCHIPELAGO_*.md`, `ARCHIPELAGO_INVESTOR_DECK.html`, `DEVELOPMENT_ROADMAP.md`, `TECHNICAL_PLAN.md` | Planning documents describing a React/Three.js/Oracle/Stripe architecture | The plan changed. `README.md` at the repository root describes what was actually built and why it differs. |
| `Dockerfile.backend`, `docker-compose.yml`, `github-workflow-deploy.yml` | Deployment scaffolding, including a workflow that `scp`'d the whole repository to a hard-coded IP address | Replaced by `Dockerfile` and `.github/workflows/ci.yml` at the root. |

If you want any of this back, it is all in the git history as well; nothing was
deleted.
