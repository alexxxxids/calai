# Эталон CalAI

Проверенная эталонная реализация, из которой учебник берёт код. Это **не** репозиторий учеников: он живёт только локально, в `push` и на GitHub не уходит.

Правила работы, очередь и брифы — в `C:\Users\23556\Documents\calai\.agents\` (начинать с `HANDOFF.md`, состояние — `node .agents/tools/log.mjs status` из папки `calai`).

Подготовка (юниты P0-1 и P0-2 очереди): `npm ci`, затем `git init` с локальной подписью и базовым коммитом.

Проверки (из этой папки):

```powershell
npx next typegen
npx tsc --noEmit
npx eslint
npx vitest run
node scripts/db-verify.mjs
```

Смоук маршрутов и границы юнита — инструментами из `calai\.agents\tools\` (`smoke-routes.mjs`, `scope-check.mjs`).
