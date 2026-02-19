# Безопасность FSCOREBOARD

## Модель угроз

### Основные угрозы
1. **Несанкционированный доступ к панели управления**
2. **Атаки на WebSocket соединения**
3. **DDoS атаки на веб-сервер**
4. **Компрометация сервера**

## Защитные механизмы

### Аутентификация
- **Токен-проверка** для панели управления
- **Bearer токен** для API endpoints
- **WebSocket валидация** токенов

### Конфигурация безопасности

#### Генерация безопасного токена
```bash
# Генерация криптографически стойкого токена
openssl rand -hex 32

# Обновление в .env
echo "TOKEN=сгенерированный-токен" > /opt/fscoreboard/.env
```

#### Настройка файрвола
```bash
# Разрешить только необходимые порты
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (если используется)
ufw enable
```

#### Безопасная конфигурация Nginx
```nginx
# Ограничение размера запросов (для /api/ads в nginx-scoreboard.conf задано 1024M)
client_max_body_size 10M;

# Скрытие версии Nginx
server_tokens off;

# Защита от DDoS
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

## Рекомендации по безопасности

### 1. Регулярные обновления
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Обновление Node.js зависимостей
cd /opt/fscoreboard && npm audit fix
```

### 2. Мониторинг безопасности
```bash
# Проверка подозрительной активности
grep "403\|401\|404" /var/log/nginx/fscoreboard_access.log

# Мониторинг попыток доступа
tail -f /var/log/nginx/fscoreboard_access.log | grep -E "(POST|PUT|DELETE)"
```

### 3. Ротация токенов
```bash
# Генерация нового токена
NEW_TOKEN=$(openssl rand -hex 32)

# Обновление конфигурации
sed -i "s/TOKEN=.*/TOKEN=$NEW_TOKEN/" /opt/fscoreboard/.env

# Перезапуск сервиса
pm2 restart fscoreboard
```

### 4. Резервное копирование
```bash
# Ежедневное резервное копирование
cp /opt/fscoreboard/server/state.json /backup/state_$(date +%Y%m%d).json
cp /opt/fscoreboard/server/presets.json /backup/presets_$(date +%Y%m%d).json
```

## Аудит безопасности

### Проверочный список
- [ ] Токен изменен с дефолтного значения
- [ ] Файрвол настроен и активен
- [ ] Система обновлена до последней версии
- [ ] Логи мониторятся на предмет аномалий
- [ ] Резервные копии создаются регулярно
- [ ] Доступ к серверу ограничен по IP (если возможно)

### Команды аудита
```bash
# Проверка открытых портов
netstat -tlnp | grep -E ":(80|443|3001|22)"

# Проверка активных соединений
ss -tuln

# Проверка логов на подозрительную активность
grep -E "(403|401|500)" /var/log/nginx/fscoreboard_error.log | tail -20
```

## Инцидент-реагирование

### При подозрении на компрометацию
1. **Немедленно смените токен**
2. **Проверьте логи на подозрительную активность**
3. **Обновите все пароли и ключи**
4. **Перезапустите все сервисы**

```bash
# Экстренная смена токена
openssl rand -hex 32 > /tmp/new_token
NEW_TOKEN=$(cat /tmp/new_token)
sed -i "s/TOKEN=.*/TOKEN=$NEW_TOKEN/" /opt/fscoreboard/.env
pm2 restart fscoreboard
rm /tmp/new_token
```

## Дополнительные меры

### SSL/TLS (рекомендуется)
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com
```

### Мониторинг в реальном времени
```bash
# Установка fail2ban
sudo apt install fail2ban

# Настройка для Nginx
sudo nano /etc/fail2ban/jail.local
```

### Изоляция процессов
```bash
# Запуск под отдельным пользователем
useradd -r -s /bin/false fscoreboard
chown -R fscoreboard:fscoreboard /opt/fscoreboard
```