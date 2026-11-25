# Contributing

Thanks for helping! Bug reports, docs fixes, new looks and story formulas are all welcome.

## Good places to start

- Issues labelled [`good first issue`](https://github.com/fahniazz/claude-shorts-skills/labels/good%20first%20issue) are small and self-contained.
- Running the skills on macOS or Linux and reporting what breaks is very useful: they were built on Windows 11.

## Setup

1. Fork and clone the repo.
2. Install Node 20+, Python 3.10+ and ffmpeg. The video skills also need [Remotion](https://www.remotion.dev/) with `@remotion/three` in the project where you render.
3. Copy the skill you are changing into `~/.claude/skills/` (see the README *Install* section) and try it in Claude Code.

## Before you open a pull request

- Keep one change per pull request, with a short description of what and why.
- Run the same syntax check as CI:
  ```bash
  python -m py_compile $(git ls-files '*.py')
  for f in $(git ls-files '*.mjs' '*.js'); do node --check "$f"; done
  ```
- No personal paths (`C:\Users\...`, `E:\...`), API keys or `.env` files. Use the variables in the README *Settings* table.
- No copyrighted reference frames, footage, music or characters. Sound effects must be recorded CC0 / free-licence files, credited in the skill docs.
- For a new look or story formula, link one short (or a few frames) made with it, so reviewers can see that it works.

## Reporting bugs

Open an issue with your OS, Node / Python versions, the skill and the command you ran, and the full error.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
