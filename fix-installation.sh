#!/bin/bash

# =============================================================================
# FSCOREBOARD - Скрипт исправления установки
# =============================================================================
# Автор: FSCORE Team
# Версия: 1.0.0
# Описание: Диагностика и исправление проблем с существующей установкой
# =============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Переменные
INSTALL_DIR="/opt/fscoreboard"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"

print_header() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                        FSCOREBOARD DIAGNOSTIC & FIX                          ║"
    echo "║                        Диагностика и исправление проблем                     ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
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

# Диагностика системы
diagnose_system() {
    print_step "Диагностика системы..."
    
    echo -e "\n${CYAN}📊 СТАТУС СЕРВИСОВ:${NC}"
    
    # PM2 статус
    if command -v pm2 &> /dev/null; then
        echo -e "\n${YELLOW}PM2 Процессы:${NC}"
        pm2 list
    else
        print_error "PM2 не установлен"
    fi
    
    # Nginx статус
    if command -v nginx &> /dev/null; then
        echo -e "\n${YELLOW}Nginx статус:${NC}"
        systemctl status nginx --no-pager -l
    else
        print_error "Nginx не установлен"
    fi
    
    # Порты
    echo -e "\n${YELLOW}Занятые порты:${NC}"
    netstat -tlnp | grep -E ":(80|443|3001|3002|3003) " || echo "Нет занятых портов"
    
    # Конфигурации Nginx
    echo -e "\n${YELLOW}Конфигурации Nginx:${NC}"
    ls -la $NGINX_SITES_ENABLED/ 2>/dev/null || echo "Нет конфигураций"
    
    # Файлы проекта
    echo -e "\n${YELLOW}Файлы проекта:${NC}"
    if [ -d "$INSTALL_DIR" ]; then
        ls -la "$INSTALL_DIR/"
    else
        print_error "Директория проекта не найдена: $INSTALL_DIR"
    fi
}

# Проверка WebSocket соединений
check_websocket() {
    print_step "Проверка WebSocket соединений..."
    
    if [ -f "$INSTALL_DIR/server/app.js" ]; then
        cd "$INSTALL_DIR"
        
        # Проверка доступности Socket.IO
        if curl -s "http://localhost:3001/socket.io/" | grep -q "socket.io"; then
            print_success "Socket.IO доступен"
        else
            print_error "Socket.IO недоступен"
        fi
        
        # Проверка статических файлов
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/public/scoreboard_vmix.html" | grep -q "200"; then
            print_success "Статические файлы доступны"
        else
            print_error "Статические файлы недоступны"
        fi
    else
        print_error "Файл сервера не найден"
    fi
}

# Исправление Nginx конфигурации
fix_nginx_config() {
    print_step "Исправление конфигурации Nginx..."
    
    local nginx_config="$NGINX_SITES_AVAILABLE/fscoreboard"
    
    if [ ! -f "$nginx_config" ]; then
        print_error "Конфигурация Nginx не найдена"
        return 1
    fi
    
    # Создание резервной копии
    cp "$nginx_config" "${nginx_config}.backup.$(date +%Y%m%d_%H%M%S)"
    print_info "Создана резервная копия конфигурации"
    
    # Создание правильной конфигурации
    cat > "$nginx_config" << 'EOF'
server {
    listen 80;
    server_name _;

    # WebSocket поддержка для Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Все остальные запросы проксируются на Express сервер
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
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Логи
    access_log /var/log/nginx/fscoreboard_access.log;
    error_log /var/log/nginx/fscoreboard_error.log;
}
EOF

    # Проверка конфигурации
    if nginx -t; then
        print_success "Конфигурация Nginx исправлена"
        systemctl reload nginx
        print_success "Nginx перезагружен"
    else
        print_error "Ошибка в конфигурации Nginx"
        return 1
    fi
}

# Перезапуск сервисов
restart_services() {
    print_step "Перезапуск сервисов..."
    
    # Перезапуск PM2
    if command -v pm2 &> /dev/null; then
        pm2 restart fscoreboard 2>/dev/null || {
            print_warning "PM2 процесс не найден, запускаем заново"
            cd "$INSTALL_DIR"
            pm2 start server/app.js --name fscoreboard
        }
        print_success "PM2 перезапущен"
    fi
    
    # Перезапуск Nginx
    if command -v nginx &> /dev/null; then
        systemctl reload nginx
        print_success "Nginx перезагружен"
    fi
}

# Проверка работоспособности
verify_fix() {
    print_step "Проверка исправлений..."
    
    sleep 3
    
    # Проверка PM2
    if pm2 list | grep -q "fscoreboard.*online"; then
        print_success "PM2 процесс работает"
    else
        print_error "PM2 процесс не работает"
        return 1
    fi
    
    # Проверка HTTP
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/public/scoreboard_vmix.html" | grep -q "200"; then
        print_success "HTTP сервер отвечает"
    else
        print_error "HTTP сервер не отвечает"
        return 1
    fi
    
    # Проверка Nginx
    if systemctl is-active --quiet nginx; then
        print_success "Nginx активен"
    else
        print_error "Nginx не активен"
        return 1
    fi
    
    print_success "Все проверки пройдены"
}

# Получение информации о системе
get_system_info() {
    print_step "Информация о системе..."
    
    local domain=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    local port=$(grep -o 'PORT=[0-9]*' "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "3001")
    local token=$(grep -o 'TOKEN=[^[:space:]]*' "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "MySecret111")
    
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                           СИСТЕМА РАБОТАЕТ!                                 ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}🌐 АДРЕСА СТРАНИЦ:${NC}"
    echo -e "${YELLOW}Панель управления:${NC} http://$domain/private/control.html?token=$token"
    echo -e "${YELLOW}Основное табло:${NC}     http://$domain/public/scoreboard_vmix.html"
    echo -e "${YELLOW}Стадион:${NC}            http://$domain/public/stadium.html"
    echo -e "${YELLOW}ISKRA CUP табло:${NC}    http://$domain/public/iskracup_scoreboard.html"
    
    echo -e "\n${CYAN}🔧 УПРАВЛЕНИЕ:${NC}"
    echo -e "${YELLOW}Статус:${NC}             pm2 status"
    echo -e "${YELLOW}Логи:${NC}               pm2 logs fscoreboard"
    echo -e "${YELLOW}Перезапуск:${NC}         pm2 restart fscoreboard"
}

# Основная функция
main() {
    print_header
    
    if [[ $EUID -ne 0 ]]; then
        print_error "Этот скрипт должен быть запущен с правами root"
        print_info "Используйте: sudo $0"
        exit 1
    fi
    
    diagnose_system
    check_websocket
    fix_nginx_config
    restart_services
    verify_fix
    get_system_info
}

# Запуск
main "$@"
