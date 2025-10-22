# Безопасность FSCOREBOARD

Руководство по безопасности системы FSCOREBOARD, модели угроз и рекомендации по защите.

## Модель угроз

### Основные угрозы

1. **Несанкционированный доступ к панели управления**
   - Атаки брутфорс на токены
   - Перехват токенов в логах
   - Социальная инженерия

2. **Атаки на WebSocket соединения**
   - Подделка событий
   - DoS атаки через множественные соединения
   - Инъекция данных через Socket.IO

3. **Атаки на веб-сервер**
   - DDoS атаки
   - Атаки на Nginx
   - SSL/TLS атаки

4. **Компрометация сервера**
   - Эксплойты в Node.js
   - Небезопасные зависимости
   - Неправильная конфигурация

## Защитные механизмы

### Аутентификация и авторизация

#### Токен-проверка для панели управления

```javascript
// Проверка токена в query параметре
app.get('/control', (req, res) => {
  const { token } = req.query;
  if (token !== process.env.TOKEN) {
    return res.status(403).send('Access denied');
  }
  // ...
});
```

#### Bearer токен для API

```javascript
// Проверка Bearer токена
app.get('/api/state', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const token = authHeader.substring(7);
  if (token !== process.env.TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  // ...
});
```

#### Socket.IO namespace защита

```javascript
// Middleware для проверки токена в Socket.IO
controlNamespace.use((socket, next) => {
  const { token } = socket.handshake.query || {};
  if (token && token === process.env.TOKEN) {
    return next();
  }
  next(new Error('Unauthorized'));
});
```

### Валидация данных

#### Строгая валидация входных данных

```javascript
function validateData(data) {
  const validated = {};
  
  // Счёт - только неотрицательные целые
  if (data.score1 !== undefined) {
    validated.score1 = Math.max(0, parseInt(data.score1) || 0);
  }
  
  // Шорткоды - только A-ZА-Я0-9, до 3 символов
  if (data.team1Short !== undefined) {
    validated.team1Short = String(data.team1Short)
      .toUpperCase()
      .substring(0, 3)
      .replace(/[^A-ZА-Я0-9]/g, '');
  }
  
  // Цвета - только hex формат
  if (data.kit1Color !== undefined) {
    const color = String(data.kit1Color);
    validated.kit1Color = /^#[0-9A-Fa-f]{6}$/.test(color) 
      ? color 
      : state.kit1Color;
  }
  
  return validated;
}
```

### Rate Limiting

#### Ограничение API запросов

```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // 100 запросов на IP
});

app.put('/api/state', apiLimiter, (req, res) => {
  // ...
});
```

#### Nginx rate limiting

```nginx
# Ограничение для панели управления
limit_req_zone $binary_remote_addr zone=control:10m rate=5r/s;

location /control {
    limit_req zone=control burst=10 nodelay;
    # ...
}
```

### Заголовки безопасности

#### Helmet.js конфигурация

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss:", "ws:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### Nginx заголовки безопасности

```nginx
# Security headers
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Рекомендации по безопасности

### Управление токенами

#### Генерация сильных токенов

```bash
# Генерация криптографически стойкого токена
openssl rand -hex 32

# Или с использованием Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Безопасное хранение токенов

```bash
# В .env файле (не в git)
TOKEN=your-very-secure-token-here

# Права доступа к .env
chmod 600 .env
chown fscoreboard:fscoreboard .env
```

#### Ротация токенов

```bash
# Скрипт для обновления токена
#!/bin/bash
NEW_TOKEN=$(openssl rand -hex 32)
echo "TOKEN=$NEW_TOKEN" > .env.new
mv .env .env.backup
mv .env.new .env
sudo pm2 restart fscoreboard
```

### Конфигурация Nginx

#### Блокировка подозрительных запросов

```nginx
# Блокировка подозрительных User-Agent
if ($http_user_agent ~* (bot|crawler|spider|scraper)) {
    return 403;
}

# Блокировка прямого доступа к .env
location ~ /\.env {
    deny all;
}

# Блокировка доступа к служебным файлам
location ~ /(\.git|node_modules|logs|server/state\.json) {
    deny all;
}
```

#### SSL/TLS конфигурация

```nginx
# Современные SSL настройки
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Мониторинг безопасности

#### Логирование подозрительной активности

```javascript
// Middleware для логирования запросов
app.use((req, res, next) => {
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /eval\(/i  // Code injection
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || pattern.test(req.body)
  );
  
  if (isSuspicious) {
    console.warn(`Suspicious request from ${req.ip}: ${req.url}`);
  }
  
  next();
});
```

#### Мониторинг неудачных попыток входа

```bash
# Скрипт для анализа логов
#!/bin/bash
LOG_FILE="/var/log/nginx/access.log"

# Поиск неудачных попыток доступа к панели управления
grep "403\|401" $LOG_FILE | grep "/control" | tail -20

# Поиск подозрительных IP
grep "403\|401" $LOG_FILE | awk '{print $1}' | sort | uniq -c | sort -nr
```

### Обновления и патчи

#### Регулярные обновления

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Обновление Node.js зависимостей
npm audit
npm audit fix

# Проверка уязвимостей
npm audit --audit-level moderate
```

#### Мониторинг зависимостей

```bash
# Проверка уязвимостей в зависимостях
npm audit

# Автоматическое исправление
npm audit fix

# Проверка конкретных пакетов
npm audit express socket.io helmet
```

### Резервное копирование

#### Безопасное резервное копирование

```bash
#!/bin/bash
# Скрипт безопасного бэкапа
BACKUP_DIR="/opt/backups/fscoreboard"
DATE=$(date +%Y%m%d_%H%M%S)

# Создание зашифрованного архива
tar -czf - /opt/fscoreboard/server/state.json | \
gpg --symmetric --cipher-algo AES256 --output "$BACKUP_DIR/state_$DATE.tar.gz.gpg"

# Очистка старых бэкапов
find $BACKUP_DIR -name "*.gpg" -mtime +30 -delete
```

## Инцидент-реагирование

### Процедуры при компрометации

1. **Немедленные действия:**
   ```bash
   # Остановка сервиса
   sudo pm2 stop fscoreboard
   
   # Блокировка подозрительных IP
   sudo ufw deny from <suspicious-ip>
   
   # Смена токенов
   sudo nano /opt/fscoreboard/.env
   sudo pm2 restart fscoreboard
   ```

2. **Анализ логов:**
   ```bash
   # Поиск подозрительной активности
   sudo grep -i "error\|failed\|denied" /var/log/nginx/access.log
   sudo pm2 logs fscoreboard --err
   ```

3. **Восстановление:**
   ```bash
   # Восстановление из чистого бэкапа
   sudo cp /opt/backups/fscoreboard/state_clean.json \
           /opt/fscoreboard/server/state.json
   ```

### Мониторинг безопасности

#### Настройка алертов

```bash
# Скрипт мониторинга
#!/bin/bash
LOG_FILE="/var/log/nginx/access.log"
ALERT_EMAIL="admin@your-domain.com"

# Проверка на атаки
ATTACK_COUNT=$(grep -c "403\|401" $LOG_FILE | tail -100)
if [ $ATTACK_COUNT -gt 50 ]; then
    echo "High number of failed requests detected: $ATTACK_COUNT" | \
    mail -s "Security Alert" $ALERT_EMAIL
fi
```

## Соответствие стандартам

### OWASP Top 10

1. **A01: Broken Access Control** — Защищено токенами
2. **A02: Cryptographic Failures** — HTTPS, сильные токены
3. **A03: Injection** — Валидация всех входных данных
4. **A04: Insecure Design** — Минимальная поверхность атаки
5. **A05: Security Misconfiguration** — Безопасная конфигурация
6. **A06: Vulnerable Components** — Регулярные обновления
7. **A07: Authentication Failures** — Строгая аутентификация
8. **A08: Software Integrity Failures** — Контроль целостности
9. **A09: Logging Failures** — Подробное логирование
10. **A10: Server-Side Request Forgery** — Не применимо

### GDPR соответствие

- Минимальная обработка данных
- Отсутствие персональных данных
- Прозрачность обработки
- Право на удаление данных

## Чек-лист безопасности

### Перед развёртыванием

- [ ] Сгенерирован сильный токен
- [ ] Настроен HTTPS с современными настройками
- [ ] Настроены заголовки безопасности
- [ ] Настроен rate limiting
- [ ] Проверены права доступа к файлам
- [ ] Настроено логирование
- [ ] Настроен мониторинг

### Регулярные проверки

- [ ] Обновления системы и зависимостей
- [ ] Анализ логов на подозрительную активность
- [ ] Проверка SSL сертификатов
- [ ] Ротация токенов
- [ ] Тестирование резервных копий
- [ ] Проверка конфигурации безопасности

