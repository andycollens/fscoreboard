# API документация FSCOREBOARD

## REST API

### Аутентификация
Все API endpoints требуют Bearer токен:
```
Authorization: Bearer your-secret-token-here
```

### Основные endpoints

#### GET /healthz
Проверка состояния сервера.
```json
{ "status": "OK", "timestamp": "2024-01-01T12:00:00.000Z" }
```

#### GET /api/state
Получение текущего состояния табло.
```json
{
  "timerRunning": false,
  "timerSeconds": 0,
  "time": "00:00",
  "team1": { "name": "Команда 1", "city": "Город 1", "score": 0, "color": "#ff0000" },
  "team2": { "name": "Команда 2", "city": "Город 2", "score": 0, "color": "#0000ff" }
}
```

#### POST /api/state
Обновление состояния табло.
```json
{
  "timerRunning": true,
  "timerSeconds": 3600,
  "team1": { "score": 1 },
  "team2": { "score": 0 }
}
```

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

### Подключение
```javascript
const socket = io('http://localhost:3001');
```

### События от клиента

#### updateState
Обновление состояния табло.
```javascript
socket.emit('updateState', {
  timerRunning: true,
  timerSeconds: 3600,
  team1: { score: 1 }
});
```

#### updatePreset
Обновление предустановки.
```javascript
socket.emit('updatePreset', {
  id: 'preset1',
  name: 'Новое название'
});
```

### События от сервера

#### stateUpdate
Обновление состояния (отправляется всем клиентам).
```javascript
socket.on('stateUpdate', (state) => {
  console.log('Состояние обновлено:', state);
});
```

#### presetUpdate
Обновление предустановок.
```javascript
socket.on('presetUpdate', (presets) => {
  console.log('Предустановки обновлены:', presets);
});
```

#### configUpdate
Обновление конфигурации (графический стиль, режим стадиона и т.д.).
```javascript
socket.on('configUpdate', (config) => {
  console.log('Конфигурация обновлена:', config);
  // config.graphicStyle, config.customStyleData и т.д.
});
```

#### scoreboardUpdate
Обновление состояния табло (для stadium.html и других страниц).
```javascript
socket.on('scoreboardUpdate', (data) => {
  console.log('Состояние табло обновлено:', data);
  // data содержит полное состояние: команды, счет, таймер, tournamentTitle и т.д.
});
```

#### stadiumWinnersChange
Обновление победителей (для режима Winners на стадионе).
```javascript
socket.on('stadiumWinnersChange', (data) => {
  console.log('Победители обновлены:', data);
  // data.winners, data.winnersTitle, data.winnersResolved
});
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
// Подключение
const socket = io('http://localhost:3001');

// Обновление счета
socket.emit('updateState', {
  team1: { score: 2 },
  team2: { score: 1 }
});

// Слушание обновлений
socket.on('stateUpdate', (state) => {
  document.getElementById('score1').textContent = state.team1.score;
  document.getElementById('score2').textContent = state.team2.score;
});
```

### cURL
```bash
# Получение состояния
curl -H "Authorization: Bearer your-token" \
     http://localhost:3001/api/state

# Обновление счета
curl -X POST \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"team1":{"score":1}}' \
     http://localhost:3001/api/state
```