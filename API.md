# API документация FSCOREBOARD

Подробное описание API и Socket.IO событий системы FSCOREBOARD.

## REST API

### Аутентификация

Все API endpoints требуют Bearer токен в заголовке Authorization:

```
Authorization: Bearer your-secret-token-here
```

### Endpoints

#### GET /healthz

Проверка состояния сервера.

**Запрос:**
```http
GET /healthz
```

**Ответ:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET /api/state

Получение текущего состояния табло.

**Запрос:**
```http
GET /api/state
Authorization: Bearer your-secret-token-here
```

**Ответ:**
```json
{
  "timerRunning": false,
  "timerSeconds": 0,
  "timerStartTS": null,
  "time": "00:00",
  "score1": 0,
  "score2": 0,
  "team1Short": "HOME",
  "team2Short": "AWAY",
  "team1Name": "Home Team",
  "team1City": "Home City",
  "team2Name": "Away Team",
  "team2City": "Away City",
  "kit1Color": "#FF0000",
  "kit2Color": "#0000FF"
}
```

#### PUT /api/state

Обновление состояния табло.

**Запрос:**
```http
PUT /api/state
Authorization: Bearer your-secret-token-here
Content-Type: application/json

{
  "score1": 2,
  "score2": 1,
  "team1Name": "Real Madrid",
  "team2Name": "Barcelona"
}
```

**Ответ:**
```json
{
  "success": true,
  "state": {
    "timerRunning": false,
    "timerSeconds": 0,
    "timerStartTS": null,
    "time": "00:00",
    "score1": 2,
    "score2": 1,
    "team1Short": "HOME",
    "team2Short": "AWAY",
    "team1Name": "Real Madrid",
    "team1City": "Home City",
    "team2Name": "Barcelona",
    "team2City": "Away City",
    "kit1Color": "#FF0000",
    "kit2Color": "#0000FF"
  }
}
```

**Поля для обновления:**
- `score1`, `score2` — счёт команд (неотрицательные целые)
- `team1Short`, `team2Short` — шорткоды команд (до 3 символов, A-ZА-Я0-9)
- `team1Name`, `team2Name` — названия команд (до 50 символов)
- `team1City`, `team2City` — города команд (до 50 символов)
- `kit1Color`, `kit2Color` — цвета форм (hex формат #RRGGBB)

## Socket.IO API

### Пространства имён

#### `/` (по умолчанию)
Для оверлеев — только чтение данных.

#### `/control`
Для панели управления — полный доступ с токен-проверкой.

### События клиент → сервер

#### updateScoreboard

Обновление данных табло.

**Пространство:** `/control`

**Данные:**
```javascript
{
  score1: 2,
  score2: 1,
  team1Name: "Real Madrid",
  team1City: "Madrid",
  team2Name: "Barcelona",
  team2City: "Barcelona",
  kit1Color: "#FF0000",
  kit2Color: "#0000FF"
}
```

#### timer:play

Запуск таймера.

**Пространство:** `/control`

**Данные:** отсутствуют

#### timer:pause

Остановка таймера.

**Пространство:** `/control`

**Данные:** отсутствуют

#### timer:set

Установка времени таймера.

**Пространство:** `/control`

**Данные:**
```javascript
1200  // секунды
```

### События сервер → клиент

#### scoreboardUpdate

Обновление состояния табло.

**Пространства:** `/` и `/control`

**Данные:**
```javascript
{
  timerRunning: false,
  timerSeconds: 0,
  timerStartTS: null,
  time: "00:00",
  score1: 0,
  score2: 0,
  team1Short: "HOME",
  team2Short: "AWAY",
  team1Name: "Home Team",
  team1City: "Home City",
  team2Name: "Away Team",
  team2City: "Away City",
  kit1Color: "#FF0000",
  kit2Color: "#0000FF"
}
```

## Структура данных

### Состояние табло

```typescript
interface ScoreboardState {
  // Таймер
  timerRunning: boolean;      // Таймер запущен
  timerSeconds: number;       // Текущие секунды
  timerStartTS: number | null; // Время старта (timestamp)
  time: string;               // Форматированное время (MM:SS)
  
  // Счёт
  score1: number;             // Счёт команды 1
  score2: number;             // Счёт команды 2
  
  // Команда 1
  team1Short: string;         // Шорткод (до 3 символов)
  team1Name: string;         // Название (до 50 символов)
  team1City: string;         // Город (до 50 символов)
  kit1Color: string;         // Цвет формы (#RRGGBB)
  
  // Команда 2
  team2Short: string;         // Шорткод (до 3 символов)
  team2Name: string;         // Название (до 50 символов)
  team2City: string;         // Город (до 50 символов)
  kit2Color: string;         // Цвет формы (#RRGGBB)
}
```

## Валидация данных

### Правила валидации

1. **Счёт (score1, score2):**
   - Неотрицательные целые числа
   - Автоматическое приведение к числу

2. **Шорткоды (team1Short, team2Short):**
   - Максимум 3 символа
   - Только A-Z, А-Я, 0-9
   - Автоматическое приведение к верхнему регистру

3. **Названия команд (team1Name, team2Name):**
   - Максимум 50 символов
   - Обрезка до лимита

4. **Города (team1City, team2City):**
   - Максимум 50 символов
   - Обрезка до лимита

5. **Цвета (kit1Color, kit2Color):**
   - Формат #RRGGBB
   - Валидация hex кода
   - Сохранение предыдущего значения при ошибке

## Примеры использования

### JavaScript клиент

```javascript
// Подключение к панели управления
const socket = io('/control', {
  query: { token: 'your-secret-token' }
});

// Обновление счёта
socket.emit('updateScoreboard', {
  score1: 2,
  score2: 1
});

// Управление таймером
socket.emit('timer:play');
socket.emit('timer:pause');
socket.emit('timer:set', 1200);

// Получение обновлений
socket.on('scoreboardUpdate', (data) => {
  console.log('Scoreboard updated:', data);
});
```

### cURL примеры

```bash
# Проверка состояния
curl -I https://your-domain.com/healthz

# Получение состояния
curl -H "Authorization: Bearer your-token" \
     https://your-domain.com/api/state

# Обновление состояния
curl -X PUT \
     -H "Authorization: Bearer your-token" \
     -H "Content-Type: application/json" \
     -d '{"score1": 2, "score2": 1}' \
     https://your-domain.com/api/state
```

### Python клиент

```python
import requests
import socketio

# REST API
headers = {'Authorization': 'Bearer your-token'}
response = requests.get('https://your-domain.com/api/state', headers=headers)
state = response.json()

# Socket.IO
sio = socketio.Client()

@sio.event
def scoreboardUpdate(data):
    print('Scoreboard updated:', data)

sio.connect('https://your-domain.com', 
           namespaces=['/control'],
           query={'token': 'your-token'})

# Обновление счёта
sio.emit('updateScoreboard', {'score1': 2, 'score2': 1})
```

## Обработка ошибок

### HTTP статус коды

- `200` — Успешный запрос
- `400` — Неверный запрос
- `401` — Не авторизован (отсутствует токен)
- `403` — Доступ запрещён (неверный токен)
- `429` — Превышен лимит запросов
- `500` — Внутренняя ошибка сервера

### Socket.IO ошибки

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

## Rate Limiting

### Ограничения

- **API endpoints:** 100 запросов в 15 минут на IP
- **Control panel:** 5 запросов в минуту на IP
- **WebSocket:** Без ограничений (только токен-проверка)

### Заголовки ответа

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Безопасность

### Токены

- Используйте сильные токены (минимум 32 символа)
- Храните токены в переменных окружения
- Регулярно обновляйте токены
- Не передавайте токены в логах

### HTTPS

- Все API endpoints доступны только по HTTPS
- WebSocket соединения также используют WSS
- SSL сертификаты обновляются автоматически

### Валидация

- Все входящие данные валидируются
- SQL инъекции невозможны (нет БД)
- XSS защита через валидацию входных данных
- CSRF защита не требуется (API без сессий)

