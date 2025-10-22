# Руководство по развёртыванию FSCOREBOARD

Пошаговое руководство по развёртыванию FSCOREBOARD на Ubuntu 24.04 с PM2 и Nginx.

## Предварительные требования

- Ubuntu 24.04 LTS
- Root доступ или sudo права
- Доменное имя (для SSL)

## 1. Подготовка сервера

### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### Установка Node.js LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Установка PM2
```bash
sudo npm install -g pm2
```

### Установка Nginx
```bash
sudo apt install nginx -y
```

## 2. Развёртывание приложения

### Клонирование репозитория
```bash
cd /opt
sudo git clone <your-repository-url> fscoreboard
cd fscoreboard
```

### Установка зависимостей
```bash
sudo npm ci --only=production
```

### Создание пользователя для приложения
```bash
sudo useradd -r -s /bin/false fscoreboard
sudo chown -R fscoreboard:fscoreboard /opt/fscoreboard
```

### Настройка окружения
```bash
sudo cp env.example .env
sudo nano .env
```

Настройте переменные в `.env`:
```env
PORT=3001
TOKEN=your-very-secure-token-here
SAVE_PATH=/opt/fscoreboard/server/state.json
NODE_ENV=production
```

### Создание директории для логов
```bash
sudo mkdir -p /opt/fscoreboard/logs
sudo chown fscoreboard:fscoreboard /opt/fscoreboard/logs
```

## 3. Настройка PM2

### Запуск приложения через PM2
```bash
cd /opt/fscoreboard
sudo pm2 start ecosystem.config.js --env production
```

### Сохранение конфигурации PM2
```bash
sudo pm2 save
```

### Настройка автозапуска
```bash
sudo pm2 startup
# Выполните команду, которую выведет PM2
```

### Проверка статуса
```bash
sudo pm2 status
sudo pm2 logs fscoreboard
```

## 4. Настройка Nginx

### Копирование конфигурации
```bash
sudo cp nginx-scoreboard.conf /etc/nginx/sites-available/fscoreboard
sudo ln -s /etc/nginx/sites-available/fscoreboard /etc/nginx/sites-enabled/
```

### Редактирование конфигурации
```bash
sudo nano /etc/nginx/sites-available/fscoreboard
```

Замените `your-domain.com` на ваш домен:
```nginx
server_name your-domain.com;
```

### Удаление дефолтной конфигурации
```bash
sudo rm /etc/nginx/sites-enabled/default
```

### Проверка конфигурации
```bash
sudo nginx -t
```

### Перезапуск Nginx
```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 5. Настройка SSL (Let's Encrypt)

### Установка Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Получение SSL сертификата
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

## 6. Настройка файрвола

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 7. Проверка развёртывания

### Проверка статуса сервисов
```bash
sudo systemctl status nginx
sudo pm2 status
```

### Проверка доступности
```bash
curl -I http://localhost:3001/healthz
curl -I https://your-domain.com/healthz
```

### Тестирование панели управления
Откройте в браузере:
```
https://your-domain.com/control?token=your-very-secure-token-here
```

### Тестирование оверлеев
- `https://your-domain.com/scoreboard_vmix.html`
- `https://your-domain.com/htbreak.html`
- `https://your-domain.com/htbreak_score.html`
- `https://your-domain.com/preloader.html`

## 8. Мониторинг и логи

### Просмотр логов PM2
```bash
sudo pm2 logs fscoreboard
sudo pm2 logs fscoreboard --lines 100
```

### Просмотр логов Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Мониторинг ресурсов
```bash
sudo pm2 monit
```

## 9. Резервное копирование

### Создание скрипта бэкапа
```bash
sudo nano /opt/backup-fscoreboard.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/fscoreboard"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Бэкап состояния
cp /opt/fscoreboard/server/state.json $BACKUP_DIR/state_$DATE.json

# Бэкап логов
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /opt/fscoreboard/logs/

# Очистка старых бэкапов (старше 30 дней)
find $BACKUP_DIR -name "*.json" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
sudo chmod +x /opt/backup-fscoreboard.sh
```

### Настройка автоматического бэкапа
```bash
sudo crontab -e
```

Добавьте:
```
0 2 * * * /opt/backup-fscoreboard.sh
```

## 10. Обновление приложения

### Остановка приложения
```bash
sudo pm2 stop fscoreboard
```

### Обновление кода
```bash
cd /opt/fscoreboard
sudo git pull origin main
sudo npm ci --only=production
```

### Запуск обновлённого приложения
```bash
sudo pm2 start fscoreboard
sudo pm2 save
```

## Устранение неполадок

### Проблемы с портами
```bash
sudo netstat -tlnp | grep :3001
sudo lsof -i :3001
```

### Проблемы с правами доступа
```bash
sudo chown -R fscoreboard:fscoreboard /opt/fscoreboard
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
sudo pm2 logs fscoreboard --err
sudo pm2 restart fscoreboard
```

## Безопасность

- Регулярно обновляйте систему: `sudo apt update && sudo apt upgrade`
- Используйте сильные токены в `.env`
- Настройте fail2ban для защиты от брутфорса
- Регулярно проверяйте логи на подозрительную активность
- Настройте мониторинг ресурсов сервера

## Производительность

- Настройте мониторинг CPU и памяти
- Используйте CDN для статических файлов
- Настройте кэширование в Nginx
- Рассмотрите использование Redis для сессий (если необходимо)

