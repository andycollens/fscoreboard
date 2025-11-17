# Операции и мониторинг FSCOREBOARD

## Управление PM2

### Основные команды
```bash
# Статус и управление
pm2 status fscoreboard
pm2 start fscoreboard
pm2 stop fscoreboard
pm2 restart fscoreboard
pm2 delete fscoreboard

# Логи
pm2 logs fscoreboard
pm2 logs fscoreboard --lines 100
pm2 flush fscoreboard
```

### Автозапуск
```bash
# Сохранение текущего состояния
pm2 save

# Настройка автозапуска
pm2 startup
```

## Мониторинг системы

### Проверка состояния
```bash
# Статус приложения
pm2 status fscoreboard

# Проверка портов
netstat -tlnp | grep :3001

# Проверка HTTP ответа
curl -I http://localhost:3001/healthz
```

### Логи и диагностика
```bash
# Логи приложения
pm2 logs fscoreboard --lines 50

# Логи Nginx
tail -f /var/log/nginx/fscoreboard_error.log
tail -f /var/log/nginx/fscoreboard_access.log

# Системные ресурсы
pm2 monit
```

## Управление данными

### Файлы состояния
- **Состояние табло**: `/opt/fscoreboard/server/state.json`
- **Предустановки**: `/opt/fscoreboard/server/presets.json`
- **Конфигурация**: `/opt/fscoreboard/server/config.json`
- **Турниры**: `/opt/fscoreboard/server/tournaments.json`
- **Кастомные стили**: `/opt/fscoreboard/server/custom-styles.json`
- **Логотипы команд**: `/opt/fscoreboard/public/logos/`
- **Изображения кастомных стилей**: `/opt/fscoreboard/public/img/custom-styles/`

### Резервное копирование
```bash
# Создание полного бэкапа
BACKUP_DIR="/backup/fscoreboard_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Копирование файлов состояния
cp /opt/fscoreboard/server/state.json $BACKUP_DIR/
cp /opt/fscoreboard/server/presets.json $BACKUP_DIR/
cp /opt/fscoreboard/server/config.json $BACKUP_DIR/
cp /opt/fscoreboard/server/tournaments.json $BACKUP_DIR/
cp /opt/fscoreboard/server/custom-styles.json $BACKUP_DIR/

# Копирование изображений
cp -r /opt/fscoreboard/public/logos $BACKUP_DIR/
cp -r /opt/fscoreboard/public/img/custom-styles $BACKUP_DIR/ 2>/dev/null || true

# Архивирование
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

# Восстановление
tar -xzf /backup/fscoreboard_20240101_120000.tar.gz -C /tmp/
cp /tmp/fscoreboard_20240101_120000/*.json /opt/fscoreboard/server/
cp -r /tmp/fscoreboard_20240101_120000/logos/* /opt/fscoreboard/public/logos/
pm2 restart fscoreboard
```

## Устранение неполадок

### Приложение не запускается
```bash
# Проверка портов
netstat -tlnp | grep :3001

# Проверка логов
pm2 logs fscoreboard --err

# Перезапуск
pm2 restart fscoreboard
```

### Страницы не загружаются
```bash
# Проверка Nginx
systemctl status nginx
nginx -t

# Перезапуск Nginx
systemctl restart nginx
```

### WebSocket не работает
```bash
# Проверка конфигурации Nginx
cat /etc/nginx/sites-available/fscoreboard | grep -A 10 socket.io

# Проверка логов
tail -f /var/log/nginx/fscoreboard_error.log
```

### Предустановки не сохраняются
```bash
# Проверка прав доступа
ls -la /opt/fscoreboard/server/
chown -R root:root /opt/fscoreboard/server/

# Перезапуск приложения
pm2 restart fscoreboard
```

## Обновление системы

### Автоматическое обновление
```bash
curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/update.sh | sudo bash
```

### Ручное обновление
```bash
cd /opt/fscoreboard
git fetch origin
git reset --hard origin/main
pm2 restart fscoreboard
```

## Мониторинг производительности

### Системные ресурсы
```bash
# Использование CPU и памяти
pm2 monit

# Детальная информация
pm2 show fscoreboard
```

### Логи производительности
```bash
# Мониторинг в реальном времени
pm2 logs fscoreboard --lines 0

# Анализ ошибок
pm2 logs fscoreboard --err | grep ERROR
```

## Безопасность

### Ротация логов
```bash
# Настройка ротации логов PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Обновление токенов
```bash
# Генерация нового токена
openssl rand -hex 32

# Обновление в .env
echo "TOKEN=новый-токен" > /opt/fscoreboard/.env
pm2 restart fscoreboard
```

## Полезные команды

### Быстрые проверки
```bash
# Получить все ссылки
fscoreboard-links

# Проверка здоровья
curl -s http://localhost:3001/healthz | jq

# Статус всех сервисов
systemctl status nginx pm2-root
```

### Очистка системы
```bash
# Очистка логов PM2
pm2 flush

# Очистка логов Nginx
truncate -s 0 /var/log/nginx/fscoreboard_*.log

# Перезапуск всех сервисов
pm2 restart fscoreboard && systemctl restart nginx
```