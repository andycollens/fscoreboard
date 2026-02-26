#!/bin/bash
# Удаление логов PM2 старше 7 дней (по времени изменения файла).
# Не трогает активные логи, с которыми PM2 сейчас работает (у них недавний mtime).
#
# Установка cron (запуск каждый день в 03:00):
#   sudo cp /opt/fscoreboard/scripts/pm2-log-cleanup.sh /usr/local/bin/
#   sudo chmod +x /usr/local/bin/pm2-log-cleanup.sh
#   sudo crontab -e
#   Добавить строку: 0 3 * * * /usr/local/bin/pm2-log-cleanup.sh

set -e

DAYS=7
PATHS="/home/scoreboard/.pm2 /root/.pm2"

for base in $PATHS; do
  [ ! -d "$base" ] && continue
  # Только файлы логов (*.log и *.log.*), старше DAYS дней
  find "$base" -type f \( -name "*.log" -o -name "*.log.*" \) -mtime +$DAYS -delete 2>/dev/null || true
done
