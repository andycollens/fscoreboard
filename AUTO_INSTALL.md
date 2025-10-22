# 🚀 Автоматическая установка FSCOREBOARD

## 📋 Обзор

FSCOREBOARD теперь поддерживает полностью автоматическую установку на Ubuntu Server одной командой. Установщик автоматически:

- ✅ Обновляет систему
- ✅ Устанавливает все зависимости (Node.js, PM2, Nginx)
- ✅ Настраивает файрвол
- ✅ Клонирует проект с GitHub
- ✅ Генерирует безопасные ключи и токены
- ✅ Настраивает Nginx с WebSocket поддержкой
- ✅ Запускает приложение через PM2
- ✅ Создает скрипты управления

---

## 🚀 Быстрая установка (одна команда)

### Для Ubuntu Server:

```bash
# Однострочная установка
curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash
```

### Альтернативный способ:

```bash
# Скачивание и запуск
wget -qO- https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash
```

---

## 📋 Что делает установщик

### 🔧 Системные требования:
- Ubuntu Server 20.04+ (рекомендуется 22.04 LTS)
- Минимум 1GB RAM, 2GB+ рекомендуется
- Минимум 10GB свободного места
- Root доступ или пользователь с sudo правами

### 🛠️ Автоматически устанавливается:

1. **Системные пакеты:**
   - curl, wget, git, unzip
   - build-essential, software-properties-common
   - nginx, ufw, fail2ban, htop, bc, openssl

2. **Node.js 18.x:**
   - Последняя LTS версия
   - NPM для управления пакетами

3. **PM2:**
   - Менеджер процессов
   - Автозапуск при перезагрузке
   - Мониторинг и логирование

4. **Nginx:**
   - Веб-сервер с reverse proxy
   - WebSocket поддержка
   - Статические файлы

5. **Безопасность:**
   - UFW файрвол с правилами
   - Fail2ban защита
   - Автогенерация ключей

---

## 🔐 Автогенерация конфигурации

### Установщик автоматически генерирует:

- **JWT Secret** - 64-символьный ключ для аутентификации
- **API Token** - 64-символьный токен для API
- **Порт приложения** - по умолчанию 3000
- **Nginx конфигурацию** - с WebSocket поддержкой
- **PM2 конфигурацию** - для автозапуска

### Пример сгенерированного .env:
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security (автогенерированные)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
API_TOKEN=9f8e7d6c5b4a3928170654321098765432109876543210987654321098765432

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

---

## 🎯 После установки

### 🌐 Доступ к приложению:
- **Основное приложение:** `http://YOUR_SERVER_IP`
- **Панель управления:** `http://YOUR_SERVER_IP/private/control.html`
- **API Health:** `http://YOUR_SERVER_IP/api/health`

### 🔧 Управление:
```bash
# Проверка статуса
fscoreboard-status

# Обновление проекта
fscoreboard-update

# Просмотр логов
pm2 logs fscoreboard

# Перезапуск
pm2 restart fscoreboard

# Мониторинг в реальном времени
pm2 monit
```

### 📁 Важные файлы:
- **Проект:** `/opt/fscoreboard/`
- **Конфигурация:** `/opt/fscoreboard/.env`
- **Логи:** `/opt/fscoreboard/logs/`
- **Nginx:** `/etc/nginx/sites-available/fscoreboard`

---

## 🔄 Обновление проекта

### Автоматическое обновление:
```bash
# Обновление одной командой
fscoreboard-update
```

### Ручное обновление:
```bash
cd /opt/fscoreboard
git pull origin main
npm install --production
pm2 restart fscoreboard
```

---

## 🛡️ Безопасность

### Автоматически настроено:
- **UFW файрвол** с правилами для SSH, HTTP, HTTPS
- **Fail2ban** для защиты от брутфорса
- **Автогенерация ключей** для JWT и API
- **Nginx** с правильной конфигурацией

### Рекомендации для продакшн:
```bash
# Настройка SSL сертификата
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Настройка SSH ключей
ssh-keygen -t ed25519 -C "your-email@example.com"
ssh-copy-id ubuntu@your-server-ip

# Отключение входа по паролю (после настройки SSH ключей)
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
sudo systemctl restart ssh
```

---

## 🚨 Решение проблем

### Проблема: Установка не запускается
```bash
# Проверка прав
sudo whoami

# Ручной запуск
sudo bash install.sh
```

### Проблема: Приложение не запускается
```bash
# Проверка логов
pm2 logs fscoreboard

# Проверка портов
sudo netstat -tlnp | grep :3000

# Перезапуск
pm2 restart fscoreboard
```

### Проблема: Nginx не работает
```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx

# Проверка статуса
sudo systemctl status nginx
```

### Проблема: Порт занят
```bash
# Поиск процесса
sudo lsof -i :3000

# Убийство процесса
sudo kill -9 PID_NUMBER

# Перезапуск PM2
pm2 restart fscoreboard
```

---

## 📊 Мониторинг

### Проверка статуса:
```bash
# Полная проверка
fscoreboard-status

# Быстрая проверка
pm2 status
sudo systemctl status nginx
```

### Логи:
```bash
# Логи приложения
pm2 logs fscoreboard --lines 50

# Логи Nginx
sudo tail -f /var/log/nginx/fscoreboard_access.log
sudo tail -f /var/log/nginx/fscoreboard_error.log

# Системные логи
sudo journalctl -u nginx -f
```

### Мониторинг ресурсов:
```bash
# PM2 мониторинг
pm2 monit

# Системный мониторинг
htop

# Использование диска
df -h
```

---

## 🔧 Дополнительные настройки

### Настройка домена:
```bash
# Редактирование Nginx конфигурации
sudo nano /etc/nginx/sites-available/fscoreboard

# Изменение server_name
server_name your-domain.com;

# Перезапуск Nginx
sudo systemctl reload nginx
```

### Настройка SSL:
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Настройка бэкапов:
```bash
# Создание скрипта бэкапа
sudo nano /usr/local/bin/fscoreboard-backup

# Содержимое:
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/fscoreboard_$DATE.tar.gz /opt/fscoreboard
find /backup -name "fscoreboard_*.tar.gz" -mtime +7 -delete

# Сделать исполняемым
sudo chmod +x /usr/local/bin/fscoreboard-backup

# Добавить в cron
sudo crontab -e
# Добавить: 0 2 * * * /usr/local/bin/fscoreboard-backup
```

---

## 📈 Масштабирование

### Для высоких нагрузок:
```bash
# Увеличение лимитов PM2
pm2 set pm2:max_memory_restart 1G

# Настройка Nginx для балансировки
sudo nano /etc/nginx/sites-available/fscoreboard

# Добавить upstream
upstream fscoreboard {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

# Изменить proxy_pass
proxy_pass http://fscoreboard;
```

### Кластерный режим:
```bash
# Запуск в кластерном режиме
pm2 start ecosystem.config.js -i max

# Или указать количество процессов
pm2 start ecosystem.config.js -i 4
```

---

## 🎯 Готово!

После установки ваш FSCOREBOARD будет полностью готов к работе:

### ✅ Что настроено:
- Полная автоматическая установка
- Безопасная конфигурация
- Мониторинг и логирование
- Скрипты управления
- Автообновления

### 🚀 Следующие шаги:
1. **Настройте домен** и SSL сертификат
2. **Настройте мониторинг** и алерты
3. **Создайте бэкапы** конфигурации
4. **Настройте CI/CD** для автоматических обновлений

---

**FSCOREBOARD готов к продакшн использованию! 🎉**
