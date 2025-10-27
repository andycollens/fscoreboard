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
    
    # Проверяем наличие PM2 процесса
    if pm2 list | grep -q "fscoreboard.*online"; then
        is_installed=true
        print_info "Найден активный PM2 процесс fscoreboard"
    elif pm2 list | grep -q "fscoreboard"; then
        is_installed=true
        print_info "Найден неактивный PM2 процесс fscoreboard"
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
        exit 1
    fi
    
    print_success "FSCOREBOARD обнаружен, продолжаем обновление"
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
    
    # Создаем резервную копию текущего состояния
    print_info "Создание резервной копии..."
    cp -r . ../fscoreboard_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Сохраняем пользовательские данные
    print_info "Сохранение пользовательских данных..."
    local backup_dir="/tmp/fscoreboard_data_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Сохраняем файлы данных
    [ -f "server/state.json" ] && cp "server/state.json" "$backup_dir/"
    [ -f "server/presets.json" ] && cp "server/presets.json" "$backup_dir/"
    [ -d "public/logos" ] && cp -r "public/logos" "$backup_dir/"
    [ -f ".env" ] && cp ".env" "$backup_dir/"
    
    # Обновляем код
    git fetch origin
    git reset --hard origin/main
    
    # Восстанавливаем пользовательские данные
    print_info "Восстановление пользовательских данных..."
    [ -f "$backup_dir/state.json" ] && cp "$backup_dir/state.json" "server/"
    [ -f "$backup_dir/presets.json" ] && cp "$backup_dir/presets.json" "server/"
    [ -d "$backup_dir/logos" ] && cp -r "$backup_dir/logos" "public/"
    [ -f "$backup_dir/.env" ] && cp "$backup_dir/.env" "."
    
    # Устанавливаем правильные права
    chown -R root:root server/state.json server/presets.json 2>/dev/null || true
    chown -R root:root public/logos 2>/dev/null || true
    chown root:root .env 2>/dev/null || true
    
    # Очищаем временную папку
    rm -rf "$backup_dir"
    
    print_success "Код обновлен, пользовательские данные сохранены"
}

# Обновление зависимостей
update_dependencies() {
    if [ "$UPDATE_DEPENDENCIES" = true ]; then
        print_step "Обновление зависимостей..."
        
        cd /opt/fscoreboard
        npm install
        
        print_success "Зависимости обновлены"
    fi
}

# Перезапуск приложения
restart_application() {
    if [ "$RESTART_APP" = true ]; then
        print_step "Перезапуск приложения..."
        
        cd /opt/fscoreboard
        
        # Проверяем, есть ли процесс в PM2
        if pm2 list | grep -q "fscoreboard"; then
            print_info "Перезапуск существующего процесса..."
            pm2 restart fscoreboard --update-env
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
            pm2 logs fscoreboard --lines 10
            
            # Пытаемся запустить заново
            print_info "Попытка повторного запуска..."
            pm2 delete fscoreboard 2>/dev/null || true
            pm2 start ecosystem.config.js
            pm2 save
            
            sleep 3
            
            if pm2 list | grep -q "fscoreboard.*online"; then
                print_success "Приложение запущено после повторной попытки"
            else
                print_error "Не удалось запустить приложение"
                return 1
            fi
        fi
    fi
}

# Перезагрузка Nginx
reload_nginx() {
    if [ "$RELOAD_NGINX" = true ]; then
        print_step "Перезагрузка Nginx..."
        
        systemctl reload nginx
        
        print_success "Nginx перезагружен"
    fi
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
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/public/iskracup_scoreboard.html" | grep -q "200"; then
        print_success "HTTP сервер отвечает"
    else
        print_warning "HTTP сервер не отвечает (возможно, еще загружается)"
    fi
    
    print_success "Проверка завершена"
}

# Вывод результатов
print_results() {
    local current_domain=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    local current_port=$(grep -o 'PORT=[0-9]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "3002")
    local current_token=$(grep -o 'TOKEN=[^[:space:]]*' /opt/fscoreboard/.env 2>/dev/null | cut -d'=' -f2 || echo "unknown")
    
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                         ОБНОВЛЕНИЕ ЗАВЕРШЕНО!                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}🌐 АКТУАЛЬНЫЕ ССЫЛКИ:${NC}"
    echo -e "${YELLOW}Панель управления:${NC}"
    echo -e "  ${GREEN}http://$current_domain/private/control.html?token=$current_token${NC}"
    echo ""
    echo -e "${YELLOW}Страницы табло:${NC}"
    echo -e "  ${GREEN}http://$current_domain/public/scoreboard_vmix.html${NC}  (основное табло)"
    echo -e "  ${GREEN}http://$current_domain/public/stadium.html${NC}  (стадион)"
    echo -e "  ${GREEN}http://$current_domain/public/htbreak.html${NC}  (перерыв)"
    echo -e "  ${GREEN}http://$current_domain/public/preloader.html${NC}  (загрузочный экран)"
    echo ""
    echo -e "${YELLOW}ISKRA CUP страницы:${NC}"
    echo -e "  ${GREEN}http://$current_domain/public/iskracup_scoreboard.html${NC}  (табло)"
    echo -e "  ${GREEN}http://$current_domain/public/iskracup_break.html${NC}  (перерыв)"
    echo -e "  ${GREEN}http://$current_domain/public/iskracup_prematch.html${NC}  (прематч)"
    
    echo -e "\n${CYAN}⚙️  КОНФИГУРАЦИЯ:${NC}"
    echo -e "${YELLOW}Порт:${NC}               $current_port"
    echo -e "${YELLOW}Токен:${NC}              $current_token"
    echo -e "${YELLOW}Директория:${NC}         /opt/fscoreboard"
    
    echo -e "\n${GREEN}🎉 FSCOREBOARD обновлен и готов к использованию!${NC}"
}

# Основная функция
main() {
    print_header
    
    check_root
    check_installation
    detect_changes
    update_code
    update_dependencies
    restart_application
    reload_nginx
    full_reinstall
    verify_update
    print_results
}

# Запуск
main "$@"
