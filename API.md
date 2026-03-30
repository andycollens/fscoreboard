# API документация FSCOREBOARD

> Актуальный перечень маршрутов и правил доступа — **`server/app.js`**. Ниже — ориентиры для интеграции; часть endpoint’ов в браузере вызывается с **`?token=...`**, отдельные — с Bearer (см. `SECURITY.md`).

## REST API

### Аутентификация
Многие операции требуют токен панели управления (часто в query: `?token=...`) или заголовок:
```
Authorization: Bearer your-secret-token-here
```

### Основные endpoints

#### GET /healthz
Проверка состояния сервера.
```json
{ "status": "OK", "timestamp": "2024-01-01T12:00:00.000Z" }
```

#### Состояние табло в реальном времени
Основной канал — **Socket.IO**: клиенты подписываются на **`scoreboardUpdate`** (полный объект состояния, после обогащения — см. `enrichStateWithConfig` в `server/app.js`). Персистентная копия — файл **`server/state.json`**. Отдельного универсального **`GET/POST /api/state`** в проекте может не быть — смотрите фактические маршруты в коде.

#### GET /api/jingles
Список MP3 для джинглов (используется `service.html` и др.). Ответ: JSON с массивом путей/имён файлов.

#### POST /api/copy-logo?token=...
Копирование файла логотипа внутри каталога логотипов (для сценария «применить пресет»: создаётся `main_team1_*` / `main_team2_*`). Тело JSON:
```json
{
  "sourceUrl": "/public/logos/исходный.png",
  "newFilename": "main_team1_1730_abc12def.png"
}
```
Ответ при успехе: `{ "success": true, "url": "/public/logos/...", "filename": "..." }`.

#### GET /api/presets
Получение списка предустановок.
```json
[
  {
    "id": "preset1",
    "name": "Матч 1",
    "team1": { "name": "Команда А", "city": "Город А" },
    "team2": { "name": "Команда Б", "city": "Город Б" }
  }
]
```

#### POST /api/presets
Создание новой предустановки.
```json
{
  "name": "Новый матч",
  "team1": { "name": "Команда 1", "city": "Город 1" },
  "team2": { "name": "Команда 2", "city": "Город 2" }
}
```

#### PUT /api/presets/:id
Обновление предустановки.

#### DELETE /api/presets/:id
Удаление предустановки.

#### GET /api/config
Получение конфигурации системы.
```json
{
  "graphicStyle": "iskracup",
  "stadiumMode": "scoreboard",
  "tournamentTitle": "ISKRA CUP 2025",
  "stadiumToken": "stadium-token-here",
  "serviceToken": "service-token-here"
}
```

#### PUT /api/config
Обновление конфигурации системы.
```json
{
  "graphicStyle": "custom:style-id",
  "stadiumMode": "penalty",
  "tournamentTitle": "Новый турнир"
}
```

#### GET /api/custom-styles
Получение списка кастомных стилей (требует токен).

#### POST /api/custom-styles
Создание нового кастомного стиля (требует токен, multipart/form-data).
- `name`: Название стиля
- `stripeMode`: "single" или "separate"
- `stripeSingle`: Файл фона (для single режима)
- `breakStripe`: Файл фона для break.html (для separate режима)
- `prematchStripe`: Файл фона для prematch.html (для separate режима)
- `logo`: Файл логотипа

#### PUT /api/custom-styles/:id
Обновление кастомного стиля (требует токен, multipart/form-data).

#### DELETE /api/custom-styles/:id
Удаление кастомного стиля (требует токен).

#### GET /api/tournaments
Получение списка турниров (требует токен).

#### POST /api/tournaments
Создание нового турнира (требует токен).
```json
{
  "name": "Чемпионат России 2024",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

#### PUT /api/tournaments/:id
Обновление турнира (требует токен).

#### DELETE /api/tournaments/:id
Удаление турнира (требует токен).

#### POST /api/tournaments/:id/teams
Добавление команды в турнир (требует токен, multipart/form-data).

#### PUT /api/tournaments/:id/teams/:teamId
Обновление команды в турнире (требует токен, multipart/form-data).

#### DELETE /api/tournaments/:id/teams/:teamId
Удаление команды из турнира (требует токен).

## Socket.IO Events

Namespace по умолчанию (как в `public/*.html` и `private/control.html`):

```javascript
const socket = io(); // тот же origin, что и страница
```

### От клиента (основные)

| Событие | Назначение |
|--------|------------|
| **`getCurrentState`** | Запрос текущего состояния; сервер ответит **`currentState`**. |
| **`updateScoreboard`** | Частичное или полное обновление полей табло (`score1`, `team1Name`, `team1Logo`, `team1Players`, `presetId`, таймер, пенальти и т.д.). Сервер мержит в общий `state` и рассылает **`scoreboardUpdate`**. |
| **`applyPreset`** | Устаревший/резервный обработчик; панель управления применяет пресеты через **`updateScoreboard`**. |
| **`rosterExcludedUpdate`** | Список исключённых из игры на `service` / синхронизация с табло. |
| **`resetScoreboard`** | Сброс табло в дефолтное состояние. |
| **`countdownFinished`** | Сигнал с табло после обратного отсчёта 5→0 (запуск таймера на сервере). |

### От сервера (основные)

| Событие | Назначение |
|--------|------------|
| **`scoreboardUpdate`** | Главное событие синхронизации: полное состояние для `scoreboard`, `stadium`, `service`, `members`, и т.д. Может включать `tournamentTitle`, `nextPreset`, `team1TrackUrl`, … |
| **`currentState`** | Ответ на `getCurrentState` (как правило то же по смыслу, что и `scoreboardUpdate`). |
| **`configUpdate`** | Смена графического стиля, режима стадиона, данных кастом-стиля и т.п. |
| **`stadiumModeChange`** | Режим отображения стадиона. |
| **`stadiumWinnersChange`** | Данные режима победителей. |
| **`startCountdown`** / **`cancelCountdown`** | Обратный отсчёт на табло. |
| **`goalScored`** | Анимация гола (если включена), с приложенным состоянием. |
| **`teamUseAltNumbersUpdated`** | Смена флага альтернативных номеров команды. |
| **`stadiumAdPlayNow`** | Служебное событие рекламы на стадионе. |

### Пример: подписка на табло

```javascript
socket.on('scoreboardUpdate', (data) => {
  // data.team1Name, data.team1Logo, data.team1Players, data.score1, data.timerSeconds, data.presetId, ...
});
```

```javascript
socket.emit('updateScoreboard', { score1: 1, score2: 0 });
```

## Коды ошибок

- **200** - Успешно
- **400** - Неверный запрос
- **401** - Не авторизован
- **403** - Доступ запрещен
- **404** - Не найдено
- **500** - Внутренняя ошибка сервера

## Примеры использования

### JavaScript (браузер)
```javascript
const socket = io();

socket.emit('updateScoreboard', { score1: 2, score2: 1 });

socket.on('scoreboardUpdate', (data) => {
  console.log(data.score1, data.score2, data.team1Name);
});
```

### cURL
```bash
curl -s "http://localhost:3001/api/presets?token=YOUR_TOKEN" | head
curl -s "http://localhost:3001/api/jingles" | head
curl -I "http://localhost:3001/public/sound/special/fanfare.mp3"
```