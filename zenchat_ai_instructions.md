# ZenChat AI Developer Instructions

These are the core operating principles and coding standards to be followed for all future development on ZenChat, to be remembered for every build, chat or edit session.

## 1. Systematic Analysis & Execution
- **Analyze completely:** Analyze the whole project (and check all relevant files if doubtful) before making any new change or addition.
- **Step-by-step:** Proceed one step at a time and double-check each step carefully. If code for a file is very large while viewing/editing, split the focus to chunks, make changes on them, ensure they are working fine before moving to the next chunk. Although working by chunks, complete the work on whole file without missing anything, then move to next one.
- **Perfectly synced codebase:** Make sure new changes or additions are synced and work together well across all relevant files.
- **No endless loops:** Do not keep reiterating on a single step unless absolutely necessary. Move forward efficiently.

## 2. Code Quality
- **Optimized & Clean:** Keep code highly optimized for performance.
- **No Clutter:** Keep code free of unnecessary comments. Only comment on complex logic where strictly needed.

## 3. Development & Debugging
- **Print Logs When Needed:** When debugging, use `console.log`, `console.warn`, and `console.error` appropriately. Do not clutter logs with excessive output.
- **Free to use any terminal commands or browser preview:** You can use any terminal commands or browser preview to debug or fix issues.

## 4. Error Handling
- **Graceful Failures:** Handle errors gracefully and provide meaningful feedback to the user. Do not leave the application in an inconsistent state.
- **Different POVs:** If you cannot resolve an issue with usual approaches, try to resolve it from different POVs - think about what could have gone wrong from frontend, backend, database, network, etc. and try to fix it from that POV. Also search the internet for potential solutions.

## 5. UI & Aesthetics
- **Professional Typography:** Keep UI text away from fancy dashes or excessive punctuation. Use standard hyphens.
- **Iconography over Emojis:** Do not use emojis in the UI text. Always use Lucid icons or SVG icons wherever visual representation is needed.

## 6. Version Control Protocol
- **Comprehensive Commits:** After completing changes or building new features, ensure all files are staged before pushing. Always use `git add .` (or `git add -A`) to ensure no newly created files or subtle changes are left behind before committing (based on the changes done) and finally pushing to GitHub (`git push origin main`) to the repo `github.com/realksquare/olh-zenchat`.