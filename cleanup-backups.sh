#!/bin/bash

# Скрипт для очистки всех старых бэкапов FSCOREBOARD

echo "🧹 Очистка старых бэкапов FSCOREBOARD..."

# Удаляем резервные копии из /opt/
removed_opt=0
if [ -d "/opt" ]; then
    for backup_dir in /opt/fscoreboard_backup_*; do
        if [ -d "$backup_dir" ]; then
            echo "Удаление: $backup_dir"
            rm -rf "$backup_dir"
            removed_opt=$((removed_opt + 1))
        fi
    done
fi

# Удаляем временные бэкапы из /tmp/
removed_tmp=0
if [ -d "/tmp" ]; then
    for backup_dir in /tmp/fscoreboard_data_backup_*; do
        if [ -d "$backup_dir" ]; then
            echo "Удаление: $backup_dir"
            rm -rf "$backup_dir"
            removed_tmp=$((removed_tmp + 1))
        fi
    done
fi

total=$((removed_opt + removed_tmp))

if [ $total -gt 0 ]; then
    echo "✅ Удалено бэкапов: $total (из /opt/: $removed_opt, из /tmp/: $removed_tmp)"
    echo "💾 Освобождено место на диске"
else
    echo "ℹ️  Старых бэкапов не найдено"
fi

