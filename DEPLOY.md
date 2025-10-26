# Руководство по развёртыванию FSCOREBOARD

Пошаговое руководство по развёртыванию FSCOREBOARD на Ubuntu 24.04 с PM2 и Nginx.

> ⚠️ **ВАЖНО:** Данная инструкция предназначена для **чистого сервера** без предустановленного Nginx или других веб-серверов. Если на сервере уже установлены другие проекты (LAMP, 3xUI, Outline и т.д.), процесс установки будет отличаться и требует дополнительных проверок на конфликты портов и конфигураций.

## Предварительные требования

- Ubuntu 24.04 LTS
- Root доступ или sudo права
- Доменное имя (опционально) или IP-адрес сервера

## ⚠️ Установка на сервер с существующими проектами

Если на сервере уже установлены другие проекты (LAMP, 3xUI, Outline, другие веб-серверы), **НЕ ИСПОЛЬЗУЙТЕ** данную инструкцию без модификации:

1. **Проверьте занятые порты:**
   ```bash
   sudo netstat -tlnp | grep :80
   sudo netstat -tlnp | grep :3001
   ```

2. **НЕ удаляйте существующие конфигурации Nginx:**
   ```bash
   # ❌ НЕ ДЕЛАЙТЕ: sudo rm /etc/nginx/sites-enabled/default
   # ✅ Вместо этого создайте отдельную конфигурацию
   ```

3. **Используйте альтернативные порты** если необходимо

4. **Сделайте бэкап** существующих конфигураций перед установкой

## 1. Подготовка сервера

### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### Установка Node.js LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Установка PM2
```bash
sudo npm install -g pm2
```

### Установка Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

## 2. Развёртывание приложения

### Клонирование репозитория
```bash
cd /opt
sudo git clone https://github.com/andycollens/fscoreboard.git
sudo chown -R $USER:$USER /opt/fscoreboard
cd fscoreboard
```

### Установка зависимостей
```bash
npm install
```

## 3. Настройка Nginx

### Создание конфигурации Nginx
```bash
sudo nano /etc/nginx/sites-available/fscoreboard
```

**Вставьте следующую конфигурацию:**
```nginx
server {
    listen 80;
    server_name _;  # Работает с любым доменом или IP

    # Статические файлы (HTML страницы)
    location ~ \.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /opt/fscoreboard/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # WebSocket поддержка
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API и основное приложение
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Логи
    access_log /var/log/nginx/fscoreboard_access.log;
    error_log /var/log/nginx/fscoreboard_error.log;
}
```

### Активация конфигурации
```bash
sudo ln -s /etc/nginx/sites-available/fscoreboard /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Настройка PM2

### Запуск приложения
```bash
cd /opt/fscoreboard
pm2 start server/app.js --name fscoreboard
pm2 save
pm2 startup
```

### Проверка статуса
```bash
pm2 status
pm2 logs fscoreboard
```

## 5. Настройка файрвола

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 6. Проверка развёртывания

### Проверка доступности
Замените `YOUR_SERVER_IP` на IP-адрес вашего сервера:

**Панель управления:**
```
http://YOUR_SERVER_IP/private/control.html
```

**Основные страницы табло:**
- `http://YOUR_SERVER_IP/scoreboard_vmix.html` - основное табло
- `http://YOUR_SERVER_IP/stadium.html` - стадион
- `http://YOUR_SERVER_IP/htbreak.html` - перерыв
- `http://YOUR_SERVER_IP/htbreak_score.html` - перерыв со счетом
- `http://YOUR_SERVER_IP/preloader.html` - загрузочный экран

**ISKRA CUP страницы:**
- `http://YOUR_SERVER_IP/iskracup_break.html` - ISKRA CUP перерыв
- `http://YOUR_SERVER_IP/iskracup_prematch.html` - ISKRA CUP прематч
- `http://YOUR_SERVER_IP/iskracup_scoreboard.html` - ISKRA CUP табло

## 7. Настройка SSL (опционально)

### Установка Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Получение SSL сертификата (только если есть домен)
```bash
sudo certbot --nginx -d your-domain.com
```

### Автоматическое обновление сертификатов
```bash
sudo crontab -e
```

Добавьте строку:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

## 8. Мониторинг и логи

### Просмотр логов PM2
```bash
pm2 logs fscoreboard
pm2 logs fscoreboard --lines 100
```

### Просмотр логов Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Мониторинг ресурсов
```bash
pm2 monit
```

## 9. Обновление приложения

### Обновление кода
```bash
cd /opt/fscoreboard
git pull origin main
pm2 restart fscoreboard
```

## 10. Функциональность системы

### Основные возможности:
- **Управление матчем** - таймер, счет, команды
- **Предустановки** - сохранение и загрузка настроек матчей
- **Логотипы команд** - загрузка и управление логотипами
- **Защита от случайных действий** - подтверждение критических операций
- **Множественные страницы отображения** - для разных сценариев использования

### Страницы отображения:
- **scoreboard_vmix.html** - основное табло для vMix
- **stadium.html** - стадионное табло
- **htbreak.html** - экран перерыва
- **preloader.html** - загрузочный экран
- **ISKRA CUP страницы** - специализированные страницы для турнира

## Устранение неполадок

### Проблемы с портами
```bash
sudo netstat -tlnp | grep :3001
sudo lsof -i :3001
```

### Проблемы с правами доступа
```bash
sudo chown -R $USER:$USER /opt/fscoreboard
sudo chmod -R 755 /opt/fscoreboard
```

### Проблемы с Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx
```

### Проблемы с PM2
```bash
pm2 logs fscoreboard --err
pm2 restart fscoreboard
```

### Перезапуск всех сервисов
```bash
pm2 restart fscoreboard
sudo systemctl restart nginx
```

## Безопасность

- Регулярно обновляйте систему: `sudo apt update && sudo apt upgrade`
- Настройте fail2ban для защиты от брутфорса
- Регулярно проверяйте логи на подозрительную активность
- Настройте мониторинг ресурсов сервера

## Производительность

- Настройте мониторинг CPU и памяти
- Используйте CDN для статических файлов (опционально)
- Настройте кэширование в Nginx
- Рассмотрите использование Redis для сессий (если необходимо)

## Быстрая установка (одной командой)

Для опытных пользователей - полная установка одной командой:

```bash
sudo apt update && sudo apt upgrade -y && \
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && \
sudo apt-get install -y nodejs nginx && \
sudo npm install -g pm2 && \
cd /opt && \
sudo git clone https://github.com/andycollens/fscoreboard.git && \
sudo chown -R $USER:$USER /opt/fscoreboard && \
cd fscoreboard && \
npm install && \
pm2 start server/app.js --name fscoreboard && \
pm2 save && pm2 startup && \
sudo systemctl enable nginx && sudo systemctl start nginx
```

**Затем настройте Nginx согласно разделу 3.**

## Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs fscoreboard`
2. Проверьте статус сервисов: `pm2 status` и `sudo systemctl status nginx`
3. Проверьте конфигурацию Nginx: `sudo nginx -t`
4. Убедитесь, что порт 3001 свободен: `sudo netstat -tlnp | grep :3001`