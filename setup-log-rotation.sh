#!/bin/bash

# =============================================================================
# FSCOREBOARD - Настройка ротации логов
# =============================================================================
# Версия: 1.0.0
# Описание: Настройка ротации логов для FSCOREBOARD
# =============================================================================

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📋 Настройка ротации логов FSCOREBOARD${NC}"

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Запустите скрипт с правами root: sudo $0${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Настройка logrotate...${NC}"

# Создание конфигурации logrotate
cat > /etc/logrotate.d/fscoreboard << 'EOF'
/opt/fscoreboard/logs/*.log {
    daily
    missingok
    rotate 3
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

echo -e "${YELLOW}🔧 Настройка PM2 logrotate...${NC}"

# Установка и настройка PM2 logrotate
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 3
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

echo -e "${YELLOW}🔧 Создание скрипта очистки логов...${NC}"

# Создание скрипта для ручной очистки логов
cat > /usr/local/bin/fscoreboard-clean-logs << 'EOF'
#!/bin/bash
# Очистка старых логов FSCOREBOARD

echo "🧹 Очистка логов FSCOREBOARD..."

# Очистка логов старше 3 дней
find /opt/fscoreboard/logs -name "*.log" -mtime +3 -delete
find /opt/fscoreboard/logs -name "*.log.*" -mtime +3 -delete

# Очистка логов PM2 старше 3 дней
find ~/.pm2/logs -name "*fscoreboard*" -mtime +3 -delete

echo "✅ Логи очищены"
EOF

chmod +x /usr/local/bin/fscoreboard-clean-logs

echo -e "${YELLOW}🔧 Настройка cron для автоматической очистки...${NC}"

# Добавление задачи в cron для ежедневной очистки
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/fscoreboard-clean-logs") | crontab -

echo -e "${GREEN}✅ Ротация логов настроена!${NC}"
echo ""
echo -e "${BLUE}📋 Настройки:${NC}"
echo "• Ротация: ежедневно"
echo "• Хранение: 3 дня"
echo "• Размер файла: максимум 10MB"
echo "• Сжатие: включено"
echo "• Автоочистка: ежедневно в 2:00"
echo ""
echo -e "${BLUE}🔧 Команды управления:${NC}"
echo "• Ручная очистка: fscoreboard-clean-logs"
echo "• Проверка cron: crontab -l"
echo "• Статус PM2: pm2 status"
echo ""
echo -e "${GREEN}🚀 Готово!${NC}"



