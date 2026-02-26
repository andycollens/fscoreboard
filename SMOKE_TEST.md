# Smoke Test для FSCOREBOARD

## Локальный запуск

### Предварительные проверки
- [ ] Node.js 18+ установлен
- [ ] `npm install` выполнен успешно
- [ ] Файл `.env` создан и настроен
- [ ] Токен изменён с дефолтного

### Базовые проверки
```bash
# 1. Запуск приложения
npm start

# 2. Проверка здоровья сервера
curl -I http://localhost:3001/healthz
# Ожидаемый результат: HTTP/1.1 200 OK

# 3. Проверка панели управления
curl -I "http://localhost:3001/private/control.html?token=YOUR_TOKEN"
# Ожидаемый результат: HTTP/1.1 200 OK

# 4. Проверка без токена (должна быть ошибка)
curl -I "http://localhost:3001/private/control.html"
# Ожидаемый результат: HTTP/1.1 403 Forbidden
```

### Проверка страниц
- [ ] `http://localhost:3001/scoreboard.html` — загружается
- [ ] `http://localhost:3001/penalti.html` — загружается
- [ ] `http://localhost:3001/prematch.html` — загружается
- [ ] `http://localhost:3001/break.html` — загружается
- [ ] `http://localhost:3001/preloader.html` — загружается
- [ ] `http://localhost:3001/public/scoreboard_vmix.html` — загружается
- [ ] `http://localhost:3001/stadium.html?token=TOKEN` — загружается
- [ ] `http://localhost:3001/service.html?token=TOKEN` — загружается
- [ ] `http://localhost:3001/members.html` — загружается

### Проверка API
```bash
# Получение состояния
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/state

# Обновление состояния
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"team1":{"score":2},"team2":{"score":1}}' \
     http://localhost:3001/api/state
```

## Продакшн развёртывание

### Предварительные проверки
- [ ] Ubuntu 20.04+ или совместимая ОС
- [ ] Root доступ или sudo права
- [ ] Порт 80 и 3001 свободны
- [ ] Интернет соединение для загрузки зависимостей

### Автоматическая установка
```bash
# 1. Обновление системы
sudo apt update && sudo apt upgrade -y

# 2. Установка FSCOREBOARD
curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash

# 3. Проверка установки
fscoreboard-links
```

### Проверка после установки
- [ ] PM2 процесс запущен: `pm2 status fscoreboard`
- [ ] Nginx активен: `systemctl status nginx`
- [ ] Порт 3001 слушается: `netstat -tlnp | grep :3001`
- [ ] HTTP сервер отвечает: `curl -I http://localhost:3001/healthz`

### Проверка внешнего доступа
```bash
# Получение IP сервера
curl -s ifconfig.me

# Проверка внешнего доступа
curl -I http://YOUR_SERVER_IP/scoreboard.html
curl -I http://YOUR_SERVER_IP/preloader.html
# Ожидаемый результат: HTTP/1.1 200 OK
```

## Функциональное тестирование

### Панель управления
- [ ] Открывается с правильным токеном
- [ ] Таймер запускается/останавливается
- [ ] Счет команд изменяется
- [ ] Названия команд редактируются
- [ ] Цвета команд настраиваются

### WebSocket соединения
- [ ] Соединение устанавливается
- [ ] События передаются в реальном времени
- [ ] Состояние синхронизируется между клиентами

### Предустановки матчей
- [ ] Создание новой предустановки
- [ ] Применение предустановки
- [ ] Редактирование существующей предустановки
- [ ] Удаление предустановки

## Тестирование производительности

### Нагрузочное тестирование
```bash
# Простой нагрузочный тест
for i in {1..100}; do
  curl -s http://localhost:3001/healthz > /dev/null &
done
wait
```

### Проверка памяти
```bash
# Мониторинг использования памяти
pm2 monit
```

## Устранение неполадок

### Частые проблемы
1. **Сервер не запускается**
   ```bash
   pm2 logs fscoreboard --err
   netstat -tlnp | grep :3001
   ```

2. **Страницы не загружаются**
   ```bash
   systemctl status nginx
   nginx -t
   ```

3. **WebSocket не работает**
   ```bash
   tail -f /var/log/nginx/fscoreboard_error.log
   ```

### Команды диагностики
```bash
# Полная диагностика
fscoreboard-links
pm2 status
systemctl status nginx
netstat -tlnp | grep -E ":(80|3001)"
```

## Чек-лист готовности к продакшену

- [ ] Все smoke tests пройдены
- [ ] Токен изменён с дефолтного
- [ ] Файрвол настроен
- [ ] Резервные копии настроены
- [ ] Мониторинг логов настроен
- [ ] SSL сертификат установлен (если используется)
- [ ] Домен настроен (если используется)