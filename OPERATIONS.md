# Операции и мониторинг FSCOREBOARD

Руководство по управлению, мониторингу и устранению неполадок системы FSCOREBOARD.

## Управление PM2

### Основные команды

```bash
# Просмотр статуса всех приложений
sudo pm2 status

# Просмотр статуса конкретного приложения
sudo pm2 show fscoreboard

# Запуск приложения
sudo pm2 start fscoreboard

# Остановка приложения
sudo pm2 stop fscoreboard

# Перезапуск приложения
sudo pm2 restart fscoreboard

# Перезагрузка приложения (без простоя)
sudo pm2 reload fscoreboard

# Удаление приложения из PM2
sudo pm2 delete fscoreboard
```

### Управление логами

```bash
# Просмотр логов в реальном времени
sudo pm2 logs fscoreboard

# Просмотр логов с ограничением строк
sudo pm2 logs fscoreboard --lines 100

# Просмотр только ошибок
sudo pm2 logs fscoreboard --err

# Просмотр только вывода
sudo pm2 logs fscoreboard --out

# Очистка логов
sudo pm2 flush fscoreboard
```

### Мониторинг ресурсов

```bash
# Интерактивный мониторинг
sudo pm2 monit

# Просмотр информации о процессе
sudo pm2 show fscoreboard

# Просмотр метрик
sudo pm2 show fscoreboard --json
```

### Сохранение и восстановление

```bash
# Сохранение текущей конфигурации
sudo pm2 save

# Восстановление сохранённой конфигурации
sudo pm2 resurrect

# Настройка автозапуска
sudo pm2 startup
```

## Управление Nginx

### Основные команды

```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx

# Перезагрузка конфигурации
sudo systemctl reload nginx

# Статус сервиса
sudo systemctl status nginx

# Включение автозапуска
sudo systemctl enable nginx
```

### Просмотр логов

```bash
# Логи доступа
sudo tail -f /var/log/nginx/access.log

# Логи ошибок
sudo tail -f /var/log/nginx/error.log

# Логи конкретного сайта
sudo tail -f /var/log/nginx/fscoreboard_access.log
sudo tail -f /var/log/nginx/fscoreboard_error.log
```

## Мониторинг системы

### Проверка состояния сервисов

```bash
# Статус всех сервисов
sudo systemctl status nginx pm2

# Проверка портов
sudo netstat -tlnp | grep :3001
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# Проверка процессов
ps aux | grep node
ps aux | grep nginx
```

### Мониторинг ресурсов

```bash
# Использование CPU и памяти
htop
top

# Дисковое пространство
df -h
du -sh /opt/fscoreboard

# Сетевая активность
sudo netstat -i
sudo ss -tuln
```

### Проверка доступности

```bash
# Проверка HTTP endpoint
curl -I http://localhost:3001/healthz

# Проверка через Nginx
curl -I https://your-domain.com/healthz

# Проверка WebSocket
curl -I https://your-domain.com/socket.io/
```

## Устранение неполадок

### Проблемы с приложением

#### Приложение не запускается
```bash
# Проверка логов
sudo pm2 logs fscoreboard --err

# Проверка конфигурации
sudo pm2 show fscoreboard

# Проверка переменных окружения
sudo pm2 env fscoreboard

# Ручной запуск для диагностики
cd /opt/fscoreboard
sudo -u fscoreboard node server/app.js
```

#### Приложение падает
```bash
# Просмотр логов ошибок
sudo pm2 logs fscoreboard --err --lines 50

# Проверка использования памяти
sudo pm2 monit

# Увеличение лимита памяти в ecosystem.config.js
# max_memory_restart: '2G'
```

#### Проблемы с WebSocket
```bash
# Проверка конфигурации Nginx
sudo nginx -t

# Проверка заголовков WebSocket
curl -H "Upgrade: websocket" -H "Connection: Upgrade" \
     https://your-domain.com/socket.io/

# Проверка логов Nginx
sudo tail -f /var/log/nginx/error.log
```

### Проблемы с Nginx

#### 502 Bad Gateway
```bash
# Проверка, что приложение запущено
sudo pm2 status

# Проверка порта
sudo netstat -tlnp | grep :3001

# Проверка конфигурации прокси
sudo nginx -t
```

#### 404 Not Found
```bash
# Проверка конфигурации сайта
sudo nginx -t

# Проверка символических ссылок
ls -la /etc/nginx/sites-enabled/

# Проверка статических файлов
curl -I https://your-domain.com/scoreboard_vmix.html
```

### Проблемы с SSL

#### Ошибки сертификата
```bash
# Проверка сертификата
sudo certbot certificates

# Обновление сертификата
sudo certbot renew --dry-run

# Проверка конфигурации SSL
sudo nginx -t
```

## Резервное копирование

### Автоматический бэкап

```bash
# Создание скрипта бэкапа
sudo nano /opt/backup-fscoreboard.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/fscoreboard"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/fscoreboard"

mkdir -p $BACKUP_DIR

# Бэкап состояния
if [ -f "$APP_DIR/server/state.json" ]; then
    cp "$APP_DIR/server/state.json" "$BACKUP_DIR/state_$DATE.json"
fi

# Бэкап логов
if [ -d "$APP_DIR/logs" ]; then
    tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" -C "$APP_DIR" logs/
fi

# Бэкап конфигурации
cp "$APP_DIR/.env" "$BACKUP_DIR/env_$DATE.backup" 2>/dev/null || true

# Очистка старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.json" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.backup" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
sudo chmod +x /opt/backup-fscoreboard.sh
```

### Восстановление из бэкапа

```bash
# Восстановление состояния
sudo cp /opt/backups/fscoreboard/state_YYYYMMDD_HHMMSS.json \
        /opt/fscoreboard/server/state.json

# Восстановление логов
sudo tar -xzf /opt/backups/fscoreboard/logs_YYYYMMDD_HHMMSS.tar.gz \
             -C /opt/fscoreboard/

# Перезапуск приложения
sudo pm2 restart fscoreboard
```

## Обновление системы

### Обновление приложения

```bash
# Остановка приложения
sudo pm2 stop fscoreboard

# Создание бэкапа
sudo /opt/backup-fscoreboard.sh

# Обновление кода
cd /opt/fscoreboard
sudo git fetch origin
sudo git pull origin main

# Обновление зависимостей
sudo npm ci --only=production

# Проверка конфигурации
sudo pm2 show fscoreboard

# Запуск обновлённого приложения
sudo pm2 start fscoreboard

# Сохранение конфигурации
sudo pm2 save
```

### Обновление системы

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Перезапуск сервисов
sudo systemctl restart nginx
sudo pm2 restart fscoreboard
```

## Мониторинг производительности

### Настройка мониторинга

```bash
# Установка htop для мониторинга
sudo apt install htop iotop nethogs -y

# Мониторинг в реальном времени
htop
iotop
nethogs
```

### Алерты и уведомления

```bash
# Создание скрипта проверки
sudo nano /opt/check-fscoreboard.sh
```

```bash
#!/bin/bash
APP_URL="https://your-domain.com/healthz"
LOG_FILE="/opt/fscoreboard/logs/health-check.log"

# Проверка доступности
if curl -f -s $APP_URL > /dev/null; then
    echo "$(date): Health check passed" >> $LOG_FILE
else
    echo "$(date): Health check failed" >> $LOG_FILE
    # Здесь можно добавить отправку уведомлений
fi
```

```bash
sudo chmod +x /opt/check-fscoreboard.sh

# Добавление в cron для проверки каждые 5 минут
sudo crontab -e
# Добавить: */5 * * * * /opt/check-fscoreboard.sh
```

## Безопасность

### Регулярные проверки

```bash
# Проверка обновлений безопасности
sudo apt list --upgradable

# Проверка открытых портов
sudo netstat -tlnp
sudo ss -tuln

# Проверка логов на подозрительную активность
sudo grep -i "error\|failed\|denied" /var/log/nginx/access.log
```

### Обновление токенов

```bash
# Генерация нового токена
openssl rand -hex 32

# Обновление в .env
sudo nano /opt/fscoreboard/.env

# Перезапуск приложения
sudo pm2 restart fscoreboard
```

## Логи и диагностика

### Централизованные логи

```bash
# Просмотр всех логов приложения
sudo pm2 logs fscoreboard --lines 1000

# Поиск ошибок
sudo pm2 logs fscoreboard | grep -i error

# Анализ производительности
sudo pm2 logs fscoreboard | grep -i "memory\|cpu"
```

### Диагностика сети

```bash
# Проверка подключений
sudo netstat -an | grep :3001

# Проверка WebSocket соединений
sudo ss -tuln | grep :3001

# Тестирование WebSocket
wscat -c wss://your-domain.com/socket.io/
```

