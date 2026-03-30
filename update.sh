#!/bin/bash

# FSCOREBOARD Update Script
# Универсальный скрипт обновления проекта

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Функции для вывода
print_header() {
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                           FSCOREBOARD UPDATE                              ║"
    echo "║                        Универсальное обновление проекта                   ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "\n${YELLOW}⚠️  ВНИМАНИЕ: Этот скрипт предназначен только для обновления уже установленного FSCOREBOARD!${NC}"
    echo -e "${CYAN}Если FSCOREBOARD не установлен, используйте install.sh для установки.${NC}\n"
}

print_step() {
    echo -e "\n${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Проверка, что скрипт запущен от root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Запустите скрипт от root: sudo $0"
        exit 1
    fi
}

# Проверка, что проект установлен
check_installation() {
    local is_installed=false
    
    # Проверяем наличие директории проекта
    if [ -d "/opt/fscoreboard" ]; then
        is_installed=true
        print_info "Найдена директория проекта: /opt/fscoreboard"
    fi
    
    # Проверяем наличие PM2 процесса (любое имя с fscoreboard)
    if pm2 list | grep -q "fscoreboard.*online"; then
        is_installed=true
        local process_name=$(pm2 list | grep "fscoreboard.*online" | awk '{print $2}')
        print_info "Найден активный PM2 процесс: $process_name"
    elif pm2 list | grep -q "fscoreboard"; then
        is_installed=true
        local process_name=$(pm2 list | grep "fscoreboard" | awk '{print $2}')
        print_info "Найден неактивный PM2 процесс: $process_name"
    fi
    
    # Проверяем наличие конфигурации Nginx
    if [ -f "/etc/nginx/sites-enabled/fscoreboard" ] || [ -f "/etc/nginx/sites-available/fscoreboard" ]; then
        is_installed=true
        print_info "Найдена конфигурация Nginx для FSCOREBOARD"
    fi
    
    # Проверяем наличие файлов данных
    if [ -f "/opt/fscoreboard/server/state.json" ] || [ -f "/opt/fscoreboard/server/presets.json" ]; then
        is_installed=true
        print_info "Найдены файлы данных FSCOREBOARD"
    fi
    
    # Проверяем наличие .env файла
    if [ -f "/opt/fscoreboard/.env" ]; then
        is_installed=true
        print_info "Найден файл конфигурации .env"
    fi
    
    if [ "$is_installed" = false ]; then
        print_error "FSCOREBOARD не установлен. Используйте install.sh для установки."
        echo -e "\n${YELLOW}💡 Для установки FSCOREBOARD используйте:${NC}"
        echo -e "${GREEN}curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash${NC}"
        echo -e "\n${CYAN}Этот скрипт предназначен только для обновления уже установленного проекта.${NC}"
        exit 1
    fi
    
    print_success "FSCOREBOARD обнаружен, продолжаем обновление"
}

# Подтянуть origin и при необходимости починить ecosystem.config.js (чтобы curl | bash всегда всё чинил)
fetch_and_repair_ecosystem() {
    [ ! -d /opt/fscoreboard ] && return 0
    cd /opt/fscoreboard
    git fetch origin 2>/dev/null || true
    if [ -f ecosystem.config.js ] && ! node -e "require('./ecosystem.config.js')" 2>/dev/null; then
        print_info "Восстановление повреждённого ecosystem.config.js из репозитория..."
        git checkout origin/main -- ecosystem.config.js 2>/dev/null || true
        port=$(grep -o 'PORT=[0-9]*' .env 2>/dev/null | cut -d'=' -f2 || echo "3002")
        sed -i "s/PORT: [0-9]*/PORT: $port/" ecosystem.config.js 2>/dev/null || true
        print_success "ecosystem.config.js восстановлен"
    fi
}

# Определение типа изменений
detect_changes() {
    print_step "Анализ изменений..."
    
    cd /opt/fscoreboard
    
    # Получаем список измененных файлов
    local changed_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
    
    if [ -z "$changed_files" ]; then
        print_info "Нет изменений для анализа (первое обновление или нет истории)"
        return 0
    fi
    
    # Анализируем типы изменений
    local has_server_changes=false
    local has_config_changes=false
    local has_public_changes=false
    local has_private_changes=false
    local has_install_changes=false
    local has_docker_changes=false
    local has_nginx_changes=false
    
    for file in $changed_files; do
        case $file in
            server/*)
                has_server_changes=true
                ;;
            *.js|*.json|ecosystem.config.js|.env*)
                has_config_changes=true
                ;;
            public/*)
                has_public_changes=true
                ;;
            private/*)
                has_private_changes=true
                ;;
            install.sh|*.sh)
                has_install_changes=true
                ;;
            docker-compose.yml|Dockerfile)
                has_docker_changes=true
                ;;
            nginx*.conf)
                has_nginx_changes=true
                ;;
        esac
    done
    
    # Выводим информацию о изменениях
    if [ "$has_server_changes" = true ]; then
        print_info "Обнаружены изменения в серверном коде"
    fi
    if [ "$has_config_changes" = true ]; then
        print_info "Обнаружены изменения в конфигурации"
    fi
    if [ "$has_public_changes" = true ]; then
        print_info "Обнаружены изменения в публичных файлах"
    fi
    if [ "$has_private_changes" = true ]; then
        print_info "Обнаружены изменения в приватных файлах"
    fi
    if [ "$has_install_changes" = true ]; then
        print_warning "Обнаружены изменения в скрипте установки"
    fi
    if [ "$has_docker_changes" = true ]; then
        print_info "Обнаружены изменения в Docker конфигурации"
    fi
    if [ "$has_nginx_changes" = true ]; then
        print_info "Обнаружены изменения в Nginx конфигурации"
    fi
    
    # Определяем необходимые действия
    UPDATE_DEPENDENCIES=false
    RESTART_APP=true
    RELOAD_NGINX=false
    FULL_RESTART=false
    
    # Проверяем, есть ли PM2 процесс
    if ! pm2 list | grep -q "fscoreboard"; then
        print_info "PM2 процесс не найден, будет создан новый"
    fi
    
    if [ "$has_server_changes" = true ] || [ "$has_config_changes" = true ]; then
        UPDATE_DEPENDENCIES=true
    fi
    
    if [ "$has_nginx_changes" = true ]; then
        RELOAD_NGINX=true
    fi
    
    if [ "$has_install_changes" = true ]; then
        print_warning "Рекомендуется полная переустановка из-за изменений в install.sh"
        FULL_RESTART=true
    fi
}

# Обновление кода
update_code() {
    print_step "Обновление кода из репозитория..."
    
    cd /opt/fscoreboard
    
    # Сохраняем пользовательские данные
    print_info "Создание временной резервной копии данных..."
    local backup_dir="/tmp/fscoreboard_data_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Сохраняем файлы данных
    [ -f "server/state.json" ] && cp "server/state.json" "$backup_dir/"
    [ -f "server/presets.json" ] && cp "server/presets.json" "$backup_dir/"
    [ -f "server/teams.json" ] && cp "server/teams.json" "$backup_dir/" 2>/dev/null || true
    [ -d "public/logos" ] && cp -r "public/logos" "$backup_dir/" 2>/dev/null || true
    [ -d "public/team-tracks" ] && cp -r "public/team-tracks" "$backup_dir/" 2>/dev/null || true
    [ -f ".env" ] && cp ".env" "$backup_dir/"
    [ -f "server/config.json" ] && cp "server/config.json" "$backup_dir/" 2>/dev/null || true
    [ -f "server/ads.json" ] && cp "server/ads.json" "$backup_dir/" 2>/dev/null || true
    [ -d "public/ads" ] && cp -r "public/ads" "$backup_dir/" 2>/dev/null || true

    # Обновляем код
    git fetch origin
    git reset --hard origin/main

    # Восстанавливаем пользовательские данные
    print_info "Восстановление пользовательских данных..."
    [ -f "$backup_dir/state.json" ] && cp "$backup_dir/state.json" "server/"
    [ -f "$backup_dir/presets.json" ] && cp "$backup_dir/presets.json" "server/"
    [ -f "$backup_dir/teams.json" ] && cp "$backup_dir/teams.json" "server/" 2>/dev/null || true
    [ -d "$backup_dir/logos" ] && cp -r "$backup_dir/logos" "public/" 2>/dev/null || true
    [ -d "$backup_dir/team-tracks" ] && cp -r "$backup_dir/team-tracks" "public/" 2>/dev/null || true
    [ -f "$backup_dir/.env" ] && cp "$backup_dir/.env" "."
    [ -f "$backup_dir/config.json" ] && cp "$backup_dir/config.json" "server/" 2>/dev/null || true
    [ -f "$backup_dir/ads.json" ] && cp "$backup_dir/ads.json" "server/" 2>/dev/null || true
    [ -d "$backup_dir/ads" ] && cp -r "$backup_dir/ads" "public/" 2>/dev/null || true
    
    # Всегда подставляем валидный ecosystem.config.js из репозитория (токен — из config.json)
    (cd /opt/fscoreboard && git checkout origin/main -- ecosystem.config.js 2>/dev/null) || true
    port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    sed -i "s/PORT: [0-9]*/PORT: $port/" /opt/fscoreboard/ecosystem.config.js 2>/dev/null || true
    
    # Устанавливаем правильные права
    chown -R root:root server/state.json server/presets.json server/teams.json server/ads.json 2>/dev/null || true
    chown -R root:root public/logos public/ads public/team-tracks 2>/dev/null || true
    chown root:root .env 2>/dev/null || true
    chown root:root server/config.json 2>/dev/null || true
    
    # Очищаем временную папку
    rm -rf "$backup_dir"
    
    print_success "Код обновлен, пользовательские данные сохранены"
}

# Обновление зависимостей (всегда после обновления кода — гарантирует совместимость и устраняет 502)
update_dependencies() {
    print_step "Обновление зависимостей npm..."
    cd /opt/fscoreboard
    npm install
    print_success "Зависимости обновлены"
}

# Перезапуск приложения
restart_application() {
    if [ "$RESTART_APP" = true ]; then
        print_step "Перезапуск приложения..."
        
        cd /opt/fscoreboard
        
    # Проверяем, есть ли процесс в PM2 (любое имя с fscoreboard)
    local process_name=$(pm2 list | grep "fscoreboard" | awk '{print $2}' | head -1)
    if [ -n "$process_name" ]; then
        print_info "Перезапуск существующего процесса: $process_name"
        pm2 restart "$process_name" --update-env
    else
        print_info "Запуск нового процесса..."
        pm2 start ecosystem.config.js
        pm2 save
    fi
        
        # Ждем запуска
        sleep 3
        
        # Проверяем статус
        if pm2 list | grep -q "fscoreboard.*online"; then
            print_success "Приложение запущено"
        else
            print_warning "Приложение не запустилось, проверяем логи..."
            local process_name=$(pm2 list | grep "fscoreboard" | awk '{print $2}' | head -1)
            if [ -n "$process_name" ]; then
                pm2 logs "$process_name" --lines 10
            else
                pm2 logs --lines 10
            fi
            
            # Пытаемся запустить заново
            print_info "Попытка повторного запуска..."
            local process_name=$(pm2 list | grep "fscoreboard" | awk '{print $2}' | head -1)
            if [ -n "$process_name" ]; then
                pm2 delete "$process_name" 2>/dev/null || true
            fi
            pm2 start ecosystem.config.js
            pm2 save
            
            sleep 3
            
            if pm2 list | grep -q "fscoreboard.*online"; then
                print_success "Приложение запущено после повторной попытки"
            else
                print_error "Не удалось запустить приложение"
                print_info "Проверьте ошибку вручную: cd /opt/fscoreboard && node server/app.js"
                return 1
            fi
        fi
    fi
}

# Добавить в конфиг Nginx блок /api/ads с лимитом 1 ГБ, если его ещё нет
patch_nginx_ads_config() {
    local cfg="/etc/nginx/sites-available/fscoreboard"
    [ ! -f "$cfg" ] && return 0
    if grep -q "location /api/ads" "$cfg" 2>/dev/null; then
        return 0
    fi
    local port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    print_step "Добавление в Nginx лимитов загрузки (реклама 1 ГБ, треки команд 50 МБ)..."
    local tmpblock=$(mktemp)
    cat > "$tmpblock" << PATCHEOF
    # Загрузка рекламных роликов — лимит 1 ГБ (иначе 413)
    location /api/ads {
        client_max_body_size 1024M;
        proxy_request_buffering off;
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }

    # Загрузка командных треков (MP3) — лимит 50 МБ
    location ~ ^/api/teams/[^/]+/track\$ {
        client_max_body_size 50M;
        proxy_request_buffering off;
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

PATCHEOF
    awk -v blockfile="$tmpblock" '
        /^[[:space:]]*location \/ \{/ && !done {
            while ((getline line < blockfile) > 0) print line
            close(blockfile)
            done=1
        }
        { print }
    ' "$cfg" > "$cfg.new" && mv "$cfg.new" "$cfg"
    rm -f "$tmpblock"
    if grep -q "location /api/ads" "$cfg" 2>/dev/null; then
        print_success "Блок /api/ads добавлен в конфиг Nginx"
    else
        print_warning "Не удалось добавить блок автоматически; добавьте вручную (см. nginx-scoreboard.conf)"
    fi
}

# Отключить proxy_buffering для /public/ (картинки, звук, логотипы) — устраняет
# net::ERR_CONTENT_LENGTH_MISMATCH в Chrome при проксировании на Node (см. OPERATIONS.md)
patch_nginx_public_static() {
    local cfg=""
    for f in /etc/nginx/sites-enabled/fscoreboard /etc/nginx/sites-available/fscoreboard; do
        if [ -f "$f" ]; then cfg="$f"; break; fi
    done
    [ -n "$cfg" ] || return 0
    if grep -qE 'location[[:space:]]+\^~[[:space:]]+/public/' "$cfg" 2>/dev/null; then
        return 0
    fi
    local port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    print_step "Добавление в Nginx: /public/ без proxy_buffering (исправление ERR_CONTENT_LENGTH_MISMATCH)..."
    local tmpblock=$(mktemp)
    cat > "$tmpblock" << PATCHEOF
    # Статика /public/ — без буферизации прокси (иначе Chrome: net::ERR_CONTENT_LENGTH_MISMATCH)
    location ^~ /public/ {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        gzip off;
    }

PATCHEOF
    awk -v blockfile="$tmpblock" '
        /^[[:space:]]*location \/ \{/ && !done {
            while ((getline line < blockfile) > 0) print line
            close(blockfile)
            done=1
        }
        { print }
    ' "$cfg" > "$cfg.new" && mv "$cfg.new" "$cfg"
    rm -f "$tmpblock"
    if grep -qE 'location[[:space:]]+\^~[[:space:]]+/public/' "$cfg" 2>/dev/null; then
        print_success "Блок ^~ /public/ добавлен в конфиг Nginx"
    else
        print_warning "Не удалось добавить ^~ /public/ автоматически; см. nginx-scoreboard.conf"
    fi
}

# Добавить в Nginx лимит загрузки командных треков (50 МБ), если ещё нет
patch_nginx_team_track_config() {
    local cfg=""
    for f in /etc/nginx/sites-enabled/fscoreboard /etc/nginx/sites-available/fscoreboard; do
        if [ -f "$f" ]; then cfg="$f"; break; fi
    done
    [ -n "$cfg" ] || return 0
    if grep -q "api/teams.*track" "$cfg" 2>/dev/null; then
        return 0
    fi
    local port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    print_step "Добавление в Nginx лимита загрузки командных треков (50 МБ)..."
    local tmpblock=$(mktemp)
    cat > "$tmpblock" << PATCHEOF
    # Загрузка командных треков (MP3) — лимит 50 МБ
    location ~ ^/api/teams/[^/]+/track\$ {
        client_max_body_size 50M;
        proxy_request_buffering off;
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

PATCHEOF
    awk -v blockfile="$tmpblock" '
        /^[[:space:]]*location \/ \{/ && !done {
            while ((getline line < blockfile) > 0) print line
            close(blockfile)
            done=1
        }
        { print }
    ' "$cfg" > "$cfg.new" && mv "$cfg.new" "$cfg"
    rm -f "$tmpblock"
    if grep -q "api/teams.*track" "$cfg" 2>/dev/null; then
        print_success "Блок загрузки треков команд добавлен в конфиг Nginx"
    else
        print_warning "Добавьте вручную location для /api/teams/.../track с client_max_body_size 50M (см. nginx-scoreboard.conf)"
    fi
}

# Перезагрузка Nginx (всегда после обновления — подхватывает лимит для /api/ads и др.)
reload_nginx() {
    if [ -f "/etc/nginx/sites-enabled/fscoreboard" ] || [ -f "/etc/nginx/sites-available/fscoreboard" ]; then
        patch_nginx_ads_config
        patch_nginx_team_track_config
        patch_nginx_public_static
        print_step "Перезагрузка Nginx..."
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            print_success "Nginx перезагружен"
        else
            print_warning "Nginx: конфиг с ошибками, перезагрузка пропущена (проверьте nginx -t)"
        fi
    fi
}

# Установка команды для получения ссылок
install_links_command() {
    print_step "Установка команды для получения ссылок..."
    
    # Скачиваем скрипт для ссылок
    curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/fscoreboard-links.sh -o "/opt/fscoreboard/fscoreboard-links.sh"
    
    # Делаем исполняемым
    chmod +x "/opt/fscoreboard/fscoreboard-links.sh"
    
    # Создаем глобальную команду
    ln -sf "/opt/fscoreboard/fscoreboard-links.sh" /usr/local/bin/fscoreboard-links
    
    # Дополнительно исправляем права на симлинк
    chmod +x /usr/local/bin/fscoreboard-links
    
    # Проверяем, что команда работает
    if /usr/local/bin/fscoreboard-links --help >/dev/null 2>&1 || /usr/local/bin/fscoreboard-links >/dev/null 2>&1; then
        print_success "Команда fscoreboard-links установлена и работает"
    else
        print_warning "Команда установлена, но может потребоваться перезагрузка терминала"
    fi
    
    print_info "Использование: fscoreboard-links"
}

# Полная переустановка
full_reinstall() {
    if [ "$FULL_RESTART" = true ]; then
        print_warning "Выполняется полная переустановка..."
        
        # Запускаем скрипт установки
        curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | bash -s -- --non-interactive
        
        print_success "Полная переустановка завершена"
    fi
}

# Проверка работоспособности
verify_update() {
    print_step "Проверка работоспособности..."
    
    # Проверяем PM2
    if pm2 list | grep -q "fscoreboard.*online"; then
        print_success "PM2 процесс работает"
    else
        print_error "PM2 процесс не запущен"
        return 1
    fi
    
    # Проверяем HTTP ответ
    local port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/scoreboard.html" | grep -q "200"; then
        print_success "HTTP сервер отвечает"
    else
        print_warning "HTTP сервер не отвечает (возможно, еще загружается)"
    fi
    
    print_success "Проверка завершена"
}

# Очистка старых бэкапов
cleanup_backups() {
    print_step "Очистка старых бэкапов..."
    
    # Удаляем старые резервные копии из /opt/
    if [ -d "/opt" ]; then
        local removed_count=0
        for backup_dir in /opt/fscoreboard_backup_*; do
            if [ -d "$backup_dir" ]; then
                rm -rf "$backup_dir"
                removed_count=$((removed_count + 1))
            fi
        done
        if [ $removed_count -gt 0 ]; then
            print_success "Удалено $removed_count резервных копий из /opt/"
        fi
    fi
    
    # Удаляем старые временные бэкапы из /tmp/
    if [ -d "/tmp" ]; then
        local removed_count=0
        for backup_dir in /tmp/fscoreboard_data_backup_*; do
            if [ -d "$backup_dir" ]; then
                rm -rf "$backup_dir"
                removed_count=$((removed_count + 1))
            fi
        done
        if [ $removed_count -gt 0 ]; then
            print_success "Удалено $removed_count временных бэкапов из /tmp/"
        fi
    fi
    
    if [ $removed_count -eq 0 ] && [ ${removed_count:-0} -eq 0 ]; then
        print_info "Старых бэкапов не найдено"
    fi
}

# Вывод результатов
print_results() {
    local current_domain=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    local current_port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    local current_token=$(grep -o 'TOKEN=[^[:space:]]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "unknown")
    
    # Читаем токены из config.json (если есть)
    local config_file="/opt/fscoreboard/server/config.json"
    local current_stadium_token="StadiumSecret222"
    local current_service_token=""
    if [ -f "$config_file" ]; then
        if command -v jq &> /dev/null; then
            local json_token=$(jq -r '.token' "$config_file" 2>/dev/null || echo "")
            local json_stadium_token=$(jq -r '.stadiumToken' "$config_file" 2>/dev/null || echo "")
            local json_service_token=$(jq -r '.serviceToken' "$config_file" 2>/dev/null || echo "")
            if [ -n "$json_token" ] && [ "$json_token" != "null" ]; then
                current_token="$json_token"
            fi
            if [ -n "$json_stadium_token" ] && [ "$json_stadium_token" != "null" ]; then
                current_stadium_token="$json_stadium_token"
            fi
            if [ -n "$json_service_token" ] && [ "$json_service_token" != "null" ]; then
                current_service_token="$json_service_token"
            fi
        else
            # Fallback: используем grep для простого парсинга JSON
            local json_stadium_token=$(grep -o '"stadiumToken"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" 2>/dev/null | cut -d'"' -f4 || echo "")
            local json_service_token=$(grep -o '"serviceToken"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" 2>/dev/null | cut -d'"' -f4 || echo "")
            if [ -n "$json_stadium_token" ]; then
                current_stadium_token="$json_stadium_token"
            fi
            if [ -n "$json_service_token" ]; then
                current_service_token="$json_service_token"
            fi
        fi
    fi
    
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                         ОБНОВЛЕНИЕ ЗАВЕРШЕНО!                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}🌐 АКТУАЛЬНЫЕ ССЫЛКИ:${NC}"
    echo -e "${YELLOW}Панель управления:${NC}"
    echo -e "  ${GREEN}http://$current_domain/private/control.html?token=$current_token${NC}"
    echo ""
    echo -e "${YELLOW}Страницы табло:${NC}"
    echo -e "  ${GREEN}http://$current_domain/scoreboard.html${NC}  (основное табло)"
    echo -e "  ${GREEN}http://$current_domain/penalti.html${NC}  (табло пенальти)"
    echo -e "  ${GREEN}http://$current_domain/public/scoreboard_vmix.html${NC}  (табло для vMix)"
    echo -e "  ${GREEN}http://$current_domain/stadium.html?token=$current_stadium_token${NC}  (стадион)"
    echo -e "  ${GREEN}http://$current_domain/service.html?token=$current_service_token${NC}  (service — составы по токену; «Награждение»: фанфары / гимн РФ / Champions)"
    echo -e "  ${GREEN}http://$current_domain/members.html${NC}  (составы команд)"
    echo -e "  ${GREEN}http://$current_domain/prematch.html${NC}  (прематч)"
    echo -e "  ${GREEN}http://$current_domain/break.html${NC}  (перерыв)"
    echo -e "  ${GREEN}http://$current_domain/preloader.html${NC}  (заглушка для стримов)"
    echo -e "  ${GREEN}http://$current_domain/flag.html${NC}  (флаг)"
    echo -e "  ${GREEN}http://$current_domain/logo.html${NC}  (лого)"
    
    echo -e "\n${CYAN}⚙️  КОНФИГУРАЦИЯ:${NC}"
    echo -e "${YELLOW}Порт:${NC}               $current_port"
    echo -e "${YELLOW}Токен управления:${NC}    $current_token"
    echo -e "${YELLOW}Токен стадиона:${NC}      $current_stadium_token"
    echo -e "${YELLOW}Токен Service:${NC}       $current_service_token"
    echo -e "${YELLOW}Директория:${NC}         /opt/fscoreboard"
    
    echo -e "\n${GREEN}🎉 FSCOREBOARD обновлен и готов к использованию!${NC}"
}

# Основная функция
main() {
    print_header
    
    # Дополнительная проверка "на дурака" - если ничего не найдено, сразу выходим
    if [ ! -d "/opt/fscoreboard" ] && ! pm2 list | grep -q "fscoreboard" && [ ! -f "/etc/nginx/sites-enabled/fscoreboard" ] && [ ! -f "/etc/nginx/sites-available/fscoreboard" ]; then
        print_error "FSCOREBOARD не установлен на этом сервере!"
        echo -e "\n${YELLOW}💡 Для установки FSCOREBOARD используйте:${NC}"
        echo -e "${GREEN}curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash${NC}"
        echo -e "\n${CYAN}Этот скрипт предназначен только для обновления уже установленного проекта.${NC}"
        exit 1
    fi
    
    check_root
    check_installation
    fetch_and_repair_ecosystem
    detect_changes
    update_code
    update_dependencies
    install_links_command
    restart_application
    reload_nginx
    full_reinstall
    
    # После full_reinstall — снова подставляем валидный ecosystem.config.js (install.sh мог сломать из‑за \r в .env)
    if [ -f /opt/fscoreboard/ecosystem.config.js ]; then
        (cd /opt/fscoreboard && git checkout origin/main -- ecosystem.config.js 2>/dev/null) || true
        port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
        sed -i "s/PORT: [0-9]*/PORT: $port/" /opt/fscoreboard/ecosystem.config.js 2>/dev/null || true
        if ! pm2 list 2>/dev/null | grep -q "fscoreboard.*online"; then
            (cd /opt/fscoreboard && pm2 start ecosystem.config.js 2>/dev/null) && pm2 save 2>/dev/null || true
        fi
    fi
    
    # Проверяем успешность обновления перед очисткой
    if verify_update; then
        # Очищаем старые бэкапы только если обновление прошло успешно
        cleanup_backups
    else
        print_warning "Обновление завершилось с ошибками, бэкапы сохранены"
    fi
    
    print_results
}

# Запуск
main "$@"
