# Prototype-only text and behaviour — must be gone before release

Everything here exists **only** because the app runs on fake in-memory data. None
of it should ship to a real studio. Work top to bottom; the last section is the
mechanism that makes the rest unnecessary.

Search shortcut for most of it:

```bash
grep -rn -e "soon-tag" -e "макет" -e "Макет" -e "позже" -e "пока не" -e "фейков" src/
```

---

## 1. Copy that admits the app is fake

| Where | Text | What happens instead |
|---|---|---|
| [login/+page.svelte:72](src/routes/login/+page.svelte#L72) | «Макет: пароль не проверяется. Подойдёт любая почта из фейковых сотрудников…» | Delete the whole `.auth-note` block |
| [login/+page.svelte:20](src/routes/login/+page.svelte#L20) | «Пока сюда подходят адреса из фейковых данных» | Real error: «Неверная почта или пароль» |
| [signup/+page.svelte:42](src/routes/signup/+page.svelte#L42) | «Пока это макет: ничего не сохранилось» | Real: studio created, owner signed in, redirect to Команда |
| [reset-password/+page.svelte:93](src/routes/reset-password/+page.svelte#L93) | кнопка «Открыть ссылку (макет)» | Delete — the real link arrives by email |
| [share/+page.svelte:224](src/routes/share/+page.svelte#L224) | title «Правки живут только в этой вкладке, пока нет базы» | Button becomes «Сохранить и скопировать ссылку» and writes a report snapshot |
| [ExcelModal.svelte:90,94,95](src/lib/components/ExcelModal.svelte#L90) | «макет» tag + «Сам файл пока не собирается» / «Файл пока не читается» | Delete both hints, enable the action button |
| [ExcelModal.svelte:231](src/lib/components/ExcelModal.svelte#L231) | `disabled` + title «Появится после подключения базы» | Remove `disabled` and the title |
| [GridToolbar.svelte:132](src/lib/components/GridToolbar.svelte#L132) | «Переход к строке по клику — позже» | Delete; make the result clickable |

## 2. The `позже` / `макет` tags

The `.soon-tag` class ([app.css](src/app.css)) marks a control that is drawn but
not wired. **When the last tag goes, delete the class too.**

- [GridToolbar.svelte:85,93](src/lib/components/GridToolbar.svelte#L85) — Импорт / Экспорт в Excel
- [Sidebar.svelte:485](src/lib/components/Sidebar.svelte#L485) — Язык
- [SettingsModal.svelte](src/lib/components/SettingsModal.svelte) — :126 Сменить фото · :133 Имя · :141 Роль · :149 Почта · :157 Язык · :199 Тема · :220 Рабочие часы · :247 Рабочих дней в неделе · :269 Импорт · :279 Экспорт · :285 Удалить все часы · :360 Новое пространство · :370 shortcuts not built yet

## 3. Hint text written for the prototype

Each of these explains a limitation that will not exist:

- «Видно всем в пространстве · **правка после подключения базы**» — [SettingsModal.svelte:134](src/lib/components/SettingsModal.svelte#L134)
- «Подпись под именем · **правка после подключения базы**» — :142
- «**Интерфейс пока только на русском**» — :158 (delete when i18n lands)
- «**Пока только светлая**» (тема) — :200
- «{9}:00 – {17}:00 · **пригодятся для напоминаний**» — :221
- «Норма считается по будням — пн–пт» — :248 (stays only if the setting is removed)
- «Задачи и проекты останутся · **спросим подтверждение дважды**» — :286 (becomes true once the confirm dialog exists)

## 4. Controls that are `disabled` on purpose

Remove the attribute when the thing works; do not ship a disabled button.

- Сменить фото — [SettingsModal.svelte:125](src/lib/components/SettingsModal.svelte#L125)
- Удалить все часы — :288
- + Новое пространство — :359
- Выгрузить / Импортировать — [ExcelModal.svelte:231](src/lib/components/ExcelModal.svelte#L231)
- Read-only Имя / Роль / Почта inputs (`readonly`) — :137, :145, :153

## 5. Fake identity and fake session

- **`/login` does not authenticate.** It looks the email up in `employees` and
  redirects. `src/routes/login/+page.svelte` goes away entirely in favour of a
  real Supabase session.
- **`/` is hardcoded to David:** `const currentEmployeeId = 'david'`
  ([+page.svelte](src/routes/+page.svelte)) — becomes the session user.
- **`/boss` is hardcoded to David:** `const bossEmployeeId = 'david'`
  ([boss/+page.svelte](src/routes/boss/+page.svelte)) — becomes the session user,
  and the whole route needs an admin guard.
- **`/share` fakes the owner/client split.** `let isSignedInAsOwner = $state(true)`
  ([share/+page.svelte:83](src/routes/share/+page.svelte#L83)) is hardcoded, so
  **right now a client opening the link sees the owner bar**. It becomes "is there
  a session, and does it own this report".
  **The preview toggle itself stays** — see «What stays» below.
- **Avatars are pravatar URLs** (`https://i.pravatar.cc/...`) all over
  `studioData.ts` — real uploads, or initials.
- **Passwords:** the boss's «Сбросить» in the employee card only fires a
  notification; it must trigger a real reset email.

### What stays on `/share` (not prototype scaffolding)

The owner's two views are a real feature and survive into the product:

- «Смотреть как клиент» / «Вернуться к редактированию»
  ([share/+page.svelte:218-220](src/routes/share/+page.svelte#L218)) — the boss
  checks what the client will get before sending, then goes back to editing.
- The «Режим редактирования» / «Просмотр как клиент» badge (:207) and «Вернуть
  скрытые (N)» (:211) belong to that same owner bar.
- `isPreviewingAsClient` (:84) and `canEditReport` (:85) stay; only the
  `isSignedInAsOwner` half of `canEditReport` gets replaced by the real session.

A client never gets the bar, the toggle, or any editable field — they only ever
see the read-only sheet, which is exactly what the owner's preview mode shows.

## 6. The data itself

- [fakeData.ts](src/lib/fakeData.ts), [studioData.ts](src/lib/studioData.ts) — every
  project, task, client, employee and hour, including the deliberate duplicates
  (QQbet / QQ bet / ККбет) and «Radiance Media».
- [notifications.svelte.ts](src/lib/notifications.svelte.ts) — `seedNotifications()`
  invents four messages, including «Марк не заполнил часы», which nothing detects.
- [vacations.svelte.ts](src/lib/vacations.svelte.ts) — seeded from
  `studioData.vacationRequests`; becomes a table.
- [studioProfile.svelte.ts](src/lib/studioProfile.svelte.ts) — the logo lives as a
  data URL in memory; becomes a storage bucket path, and the 400 KB cap can rise.
- The `// Prototype only —` comments at the top of `fakeData.ts`,
  `studioData.ts`, `notifications.svelte.ts`, `vacations.svelte.ts`,
  `/+page.svelte` and `/boss/+page.svelte` mark exactly what has to be replaced.

## 7. What removes the need for all of it

1. Real schema + RLS, so screens read their own data.
2. Real auth (Supabase session): `/login`, `/signup`, `/reset-password` do what
   they claim, `/boss` is admin-only, `/share` is public-read.
3. Excel import/export actually built, so the modal's buttons work.
4. Report snapshots, so a sent report stops changing.

Until then: **every screen must stay honest about what does not work.** Adding a
control without either wiring it or tagging it is how the prototype starts lying.
