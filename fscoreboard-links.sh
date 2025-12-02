#!/bin/bash

# FSCOREBOARD Links - Быстрое получение всех ссылок
# Автор: FSCORE Team
# Версия: 1.0.0

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
    echo "║                           FSCOREBOARD LINKS                              ║"
    echo "║                        Быстрое получение всех ссылок                    ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Проверка установки FSCOREBOARD
check_installation() {
    if [ ! -d "/opt/fscoreboard" ]; then
        print_error "FSCOREBOARD не установлен в /opt/fscoreboard"
        echo -e "\n${YELLOW}💡 Для установки используйте:${NC}"
        echo -e "${GREEN}curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash${NC}"
        exit 1
    fi
    
    if [ ! -f "/opt/fscoreboard/.env" ]; then
        print_error "Файл конфигурации .env не найден"
        exit 1
    fi
}

# Получение конфигурации
get_config() {
    local env_file="/opt/fscoreboard/.env"
    
    # Читаем порт
    PORT=$(grep -o 'PORT=[0-9]*' "$env_file" 2>/dev/null | cut -d'=' -f2 || echo "3001")
    
    # Читаем токен управления из .env
    TOKEN=$(grep -o 'TOKEN=[^[:space:]]*' "$env_file" 2>/dev/null | cut -d'=' -f2 || echo "MySecret111")
    
    # Читаем токены из config.json (если есть)
    local config_file="/opt/fscoreboard/server/config.json"
    STADIUM_TOKEN="StadiumSecret222"
    if [ -f "$config_file" ]; then
        if command -v jq &> /dev/null; then
            local json_token=$(jq -r '.token' "$config_file" 2>/dev/null || echo "")
            local json_stadium_token=$(jq -r '.stadiumToken' "$config_file" 2>/dev/null || echo "")
            if [ -n "$json_token" ] && [ "$json_token" != "null" ]; then
                TOKEN="$json_token"
            fi
            if [ -n "$json_stadium_token" ] && [ "$json_stadium_token" != "null" ]; then
                STADIUM_TOKEN="$json_stadium_token"
            fi
        else
            # Fallback: используем grep для простого парсинга JSON
            local json_token=$(grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" 2>/dev/null | cut -d'"' -f4 || echo "")
            local json_stadium_token=$(grep -o '"stadiumToken"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" 2>/dev/null | cut -d'"' -f4 || echo "")
            if [ -n "$json_token" ]; then
                TOKEN="$json_token"
            fi
            if [ -n "$json_stadium_token" ]; then
                STADIUM_TOKEN="$json_stadium_token"
            fi
        fi
    fi
    
    # Получаем IP адрес
    DOMAIN=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' | head -1)
    
    if [ -z "$DOMAIN" ]; then
        DOMAIN="localhost"
    fi
}

# Проверка работоспособности
check_status() {
    print_info "Проверка статуса FSCOREBOARD..."
    
    # Проверяем PM2 процесс
    if pm2 list | grep -q "fscoreboard.*online"; then
        print_success "PM2 процесс запущен"
    else
        print_error "PM2 процесс не запущен"
        echo -e "${YELLOW}💡 Запустите: pm2 start /opt/fscoreboard/server/app.js --name fscoreboard${NC}"
        return 1
    fi
    
    # Проверяем порт
    if netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
        print_success "Порт $PORT слушается"
    else
        print_error "Порт $PORT не слушается"
        return 1
    fi
    
    # Проверяем HTTP ответ
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/scoreboard.html" | grep -q "200"; then
        print_success "HTTP сервер отвечает"
    else
        print_error "HTTP сервер не отвечает"
        return 1
    fi
}

# Вывод ссылок
print_links() {
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                           ГОТОВЫЕ ССЫЛКИ ДЛЯ КОПИРОВАНИЯ                        ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${YELLOW}🎛️  ПАНЕЛЬ УПРАВЛЕНИЯ:${NC}"
    echo -e "  ${GREEN}http://$DOMAIN/private/control.html?token=$TOKEN${NC}"
    
    echo -e "\n${YELLOW}⚙️  НАСТРОЙКИ:${NC}"
    echo -e "  ${GREEN}http://$DOMAIN/private/settings.html?token=$TOKEN${NC}"
    
    echo -e "\n${YELLOW}📺 ОСНОВНЫЕ СТРАНИЦЫ ТАБЛО:${NC}"
    echo -e "  ${GREEN}http://$DOMAIN/scoreboard.html${NC}  (основное табло)"
    echo -e "  ${GREEN}http://$DOMAIN/penalti.html${NC}  (табло пенальти)"
    echo -e "  ${GREEN}http://$DOMAIN/public/scoreboard_vmix.html${NC}  (табло для vMix)"
    echo -e "  ${GREEN}http://$DOMAIN/stadium.html?token=$STADIUM_TOKEN${NC}  (стадион)"
    echo -e "  ${GREEN}http://$DOMAIN/prematch.html${NC}  (прематч)"
    echo -e "  ${GREEN}http://$DOMAIN/break.html${NC}  (перерыв)"
    echo -e "  ${GREEN}http://$DOMAIN/preloader.html${NC}  (заглушка для стримов)"
    echo -e "  ${GREEN}http://$DOMAIN/flag.html${NC}  (флаг)"
    echo -e "  ${GREEN}http://$DOMAIN/logo.html${NC}  (лого)"
    
    echo -e "\n${YELLOW}⚙️  КОНФИГУРАЦИЯ:${NC}"
    echo -e "  ${CYAN}IP/Домен:${NC}        $DOMAIN"
    echo -e "  ${CYAN}Порт:${NC}            $PORT"
    echo -e "  ${CYAN}Токен управления:${NC} $TOKEN"
    echo -e "  ${CYAN}Токен стадиона:${NC}   $STADIUM_TOKEN"
    echo -e "  ${CYAN}Директория:${NC}      /opt/fscoreboard"
    
    echo -e "\n${YELLOW}🔧 УПРАВЛЕНИЕ:${NC}"
    echo -e "  ${CYAN}Статус:${NC}          pm2 status"
    echo -e "  ${CYAN}Логи:${NC}            pm2 logs fscoreboard"
    echo -e "  ${CYAN}Перезапуск:${NC}      pm2 restart fscoreboard"
    echo -e "  ${CYAN}Остановка:${NC}       pm2 stop fscoreboard"
    
    echo -e "\n${GREEN}🎉 Скопируйте нужную ссылку и используйте!${NC}"
}

# Основная функция
main() {
    print_header
    
    check_installation
    get_config
    
    if check_status; then
        print_links
    else
        print_error "FSCOREBOARD не работает корректно"
        echo -e "\n${YELLOW}💡 Попробуйте:${NC}"
        echo -e "  ${GREEN}pm2 restart fscoreboard${NC}"
        echo -e "  ${GREEN}pm2 logs fscoreboard${NC}"
        exit 1
    fi
}

# Запуск
main "$@"


