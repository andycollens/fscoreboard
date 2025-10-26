#!/bin/bash

# =============================================================================
# FSCOREBOARD - Универсальный скрипт установки
# =============================================================================
# Автор: FSCORE Team
# Версия: 1.0.0
# Описание: Автоматическая установка системы табло с проверкой конфликтов
# =============================================================================

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Переменные
INSTALL_DIR="/opt/fscoreboard"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
REPO_URL="https://github.com/andycollens/fscoreboard.git"
DEFAULT_PORT=3001
DEFAULT_TOKEN="MySecret111"

# Функции
print_header() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                           FSCOREBOARD INSTALLER                              ║"
    echo "║                        Система табло для спортивных матчей                   ║"
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

# Проверка прав root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Этот скрипт должен быть запущен с правами root"
        print_info "Используйте: sudo $0"
        exit 1
    fi
}

# Проверка системы
check_system() {
    print_step "Проверка системы..."
    
    if ! command -v apt &> /dev/null; then
        print_error "Этот скрипт поддерживает только Ubuntu/Debian системы"
        exit 1
    fi
    
    print_success "Система совместима"
}

# Обновление системы
update_system() {
    print_step "Обновление системы..."
    apt update -y
    apt upgrade -y
    print_success "Система обновлена"
}

# Проверка и установка Node.js
install_nodejs() {
    print_step "Проверка Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_success "Node.js $NODE_VERSION уже установлен"
            return
        else
            print_warning "Node.js версии $NODE_VERSION устарел, обновляем до 18.x"
        fi
    fi
    
    print_info "Установка Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    print_success "Node.js установлен: $(node --version)"
}

# Проверка и установка PM2
install_pm2() {
    print_step "Проверка PM2..."
    
    if command -v pm2 &> /dev/null; then
        print_success "PM2 уже установлен"
    else
        print_info "Установка PM2..."
        npm install -g pm2
        print_success "PM2 установлен"
    fi
}

# Проверка и установка Nginx
install_nginx() {
    print_step "Проверка Nginx..."
    
    if command -v nginx &> /dev/null; then
        print_success "Nginx уже установлен"
    else
        print_info "Установка Nginx..."
        apt install nginx -y
        systemctl enable nginx
        systemctl start nginx
        print_success "Nginx установлен и запущен"
    fi
}

# Поиск свободного порта
find_free_port() {
    local port=$1
    local max_port=65535
    
    while [ $port -le $max_port ]; do
        if ! netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            echo $port
            return
        fi
        port=$((port + 1))
    done
    
    print_error "Не удалось найти свободный порт"
    exit 1
}

# Генерация токена
generate_token() {
    openssl rand -hex 16
}

# Интерактивная настройка
interactive_setup() {
    print_step "Интерактивная настройка..."
    
    # Порт
    if netstat -tlnp 2>/dev/null | grep -q ":$DEFAULT_PORT "; then
        print_warning "Порт $DEFAULT_PORT занят"
        read -p "Введите порт для FSCOREBOARD (или Enter для автопоиска): " custom_port
        if [ -z "$custom_port" ]; then
            PORT=$(find_free_port $DEFAULT_PORT)
            print_info "Выбран свободный порт: $PORT"
        else
            PORT=$custom_port
            if netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
                print_error "Порт $PORT занят"
                exit 1
            fi
        fi
    else
        PORT=$DEFAULT_PORT
        print_success "Порт $PORT свободен"
    fi
    
    # Токен
    read -p "Введите токен для панели управления (или Enter для автогенерации): " custom_token
    if [ -z "$custom_token" ]; then
        TOKEN=$(generate_token)
        print_info "Сгенерирован токен: $TOKEN"
    else
        TOKEN=$custom_token
    fi
    
    # Домен/IP
    read -p "Введите домен или IP сервера (или Enter для автодетекции): " custom_domain
    if [ -z "$custom_domain" ]; then
        DOMAIN=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
        print_info "Автодетекция домена/IP: $DOMAIN"
    else
        DOMAIN=$custom_domain
    fi
}

# Проверка существующих проектов
check_existing_projects() {
    print_step "Проверка существующих проектов..."
    
    local conflicts=()
    
    # Проверка Nginx конфигураций
    if [ -d "$NGINX_SITES_ENABLED" ]; then
        local nginx_configs=$(ls $NGINX_SITES_ENABLED/ 2>/dev/null | wc -l)
        if [ "$nginx_configs" -gt 0 ]; then
            print_warning "Найдены существующие конфигурации Nginx:"
            ls -la $NGINX_SITES_ENABLED/
            conflicts+=("nginx")
        fi
    fi
    
    # Проверка PM2 процессов
    if command -v pm2 &> /dev/null; then
        local pm2_processes=$(pm2 list --no-color | grep -c "online" || true)
        if [ "$pm2_processes" -gt 0 ]; then
            print_warning "Найдены запущенные PM2 процессы:"
            pm2 list
            conflicts+=("pm2")
        fi
    fi
    
    # Проверка портов
    local occupied_ports=()
    for port in 80 443 3001 3002 3003; do
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            occupied_ports+=("$port")
        fi
    done
    
    if [ ${#occupied_ports[@]} -gt 0 ]; then
        print_warning "Занятые порты: ${occupied_ports[*]}"
        conflicts+=("ports")
    fi
    
    if [ ${#conflicts[@]} -gt 0 ]; then
        print_warning "Обнаружены конфликты: ${conflicts[*]}"
        read -p "Продолжить установку? (y/N): " continue_install
        if [[ ! "$continue_install" =~ ^[Yy]$ ]]; then
            print_info "Установка отменена"
            exit 0
        fi
    else
        print_success "Конфликтов не обнаружено"
    fi
}

# Клонирование репозитория
clone_repository() {
    print_step "Клонирование репозитория..."
    
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Директория $INSTALL_DIR уже существует"
        read -p "Удалить существующую установку? (y/N): " remove_existing
        if [[ "$remove_existing" =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
            print_info "Существующая установка удалена"
        else
            print_info "Обновление существующей установки..."
            cd "$INSTALL_DIR"
            git pull origin main
            return
        fi
    fi
    
    git clone "$REPO_URL" "$INSTALL_DIR"
    chown -R $SUDO_USER:$SUDO_USER "$INSTALL_DIR"
    print_success "Репозиторий клонирован"
}

# Установка зависимостей
install_dependencies() {
    print_step "Установка зависимостей..."
    cd "$INSTALL_DIR"
    npm install
    print_success "Зависимости установлены"
}

# Создание директорий
create_directories() {
    print_step "Создание необходимых директорий..."
    mkdir -p "$INSTALL_DIR/logs"
    mkdir -p "$INSTALL_DIR/public/logos"
    chown -R $SUDO_USER:$SUDO_USER "$INSTALL_DIR"
    print_success "Директории созданы"
}

# Создание конфигурации Nginx
create_nginx_config() {
    print_step "Создание конфигурации Nginx..."
    
    local nginx_config="$NGINX_SITES_AVAILABLE/fscoreboard"
    
    cat > "$nginx_config" << EOF
server {
    listen 80;
    server_name _;

    # WebSocket поддержка для Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Все остальные запросы проксируются на Express сервер
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Логи
    access_log /var/log/nginx/fscoreboard_access.log;
    error_log /var/log/nginx/fscoreboard_error.log;
}
EOF

    # Активация конфигурации
    ln -sf "$nginx_config" "$NGINX_SITES_ENABLED/fscoreboard"
    
    # Удаление дефолтной конфигурации только если нет других сайтов
    local other_sites=$(ls $NGINX_SITES_ENABLED/ 2>/dev/null | grep -v fscoreboard | wc -l)
    if [ "$other_sites" -eq 0 ]; then
        rm -f "$NGINX_SITES_ENABLED/default"
    else
        print_warning "Оставлены существующие конфигурации Nginx"
    fi
    
    # Проверка конфигурации
    if nginx -t; then
        print_success "Конфигурация Nginx создана и проверена"
    else
        print_error "Ошибка в конфигурации Nginx"
        exit 1
    fi
}

# Создание .env файла
create_env_file() {
    print_step "Создание файла конфигурации..."
    
    cat > "$INSTALL_DIR/.env" << EOF
PORT=$PORT
TOKEN=$TOKEN
NODE_ENV=production
EOF
    
    chown $SUDO_USER:$SUDO_USER "$INSTALL_DIR/.env"
    print_success "Файл .env создан"
}

# Запуск приложения
start_application() {
    print_step "Запуск приложения..."
    
    cd "$INSTALL_DIR"
    
    # Остановка существующего процесса если есть
    pm2 stop fscoreboard 2>/dev/null || true
    pm2 delete fscoreboard 2>/dev/null || true
    
    # Запуск нового процесса
    pm2 start server/app.js --name fscoreboard --env production
    pm2 save
    pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER
    
    print_success "Приложение запущено"
}

# Перезапуск Nginx
restart_nginx() {
    print_step "Перезапуск Nginx..."
    systemctl reload nginx
    print_success "Nginx перезапущен"
}

# Проверка работоспособности
verify_installation() {
    print_step "Проверка работоспособности..."
    
    # Ожидание запуска приложения
    sleep 5
    
    # Проверка PM2
    if pm2 list | grep -q "fscoreboard.*online"; then
        print_success "PM2 процесс запущен"
    else
        print_error "PM2 процесс не запущен"
        return 1
    fi
    
    # Проверка порта
    if netstat -tlnp 2>/dev/null | grep -q ":$PORT "; then
        print_success "Порт $PORT слушается"
    else
        print_error "Порт $PORT не слушается"
        return 1
    fi
    
    # Проверка HTTP ответа
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/public/scoreboard_vmix.html" | grep -q "200"; then
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

# Вывод результатов
print_results() {
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                           УСТАНОВКА ЗАВЕРШЕНА!                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}🌐 АДРЕСА СТРАНИЦ:${NC}"
    echo -e "${YELLOW}Панель управления:${NC} http://$DOMAIN/private/control.html?token=$TOKEN"
    echo -e "${YELLOW}Основное табло:${NC}     http://$DOMAIN/public/scoreboard_vmix.html"
    echo -e "${YELLOW}Стадион:${NC}            http://$DOMAIN/public/stadium.html"
    echo -e "${YELLOW}Перерыв:${NC}            http://$DOMAIN/public/htbreak.html"
    echo -e "${YELLOW}ISKRA CUP табло:${NC}    http://$DOMAIN/public/iskracup_scoreboard.html"
    echo -e "${YELLOW}ISKRA CUP перерыв:${NC}  http://$DOMAIN/public/iskracup_break.html"
    echo -e "${YELLOW}ISKRA CUP прематч:${NC}  http://$DOMAIN/public/iskracup_prematch.html"
    echo -e "${YELLOW}Загрузочный экран:${NC}  http://$DOMAIN/public/preloader.html"
    
    echo -e "\n${CYAN}⚙️  КОНФИГУРАЦИЯ:${NC}"
    echo -e "${YELLOW}Порт:${NC}               $PORT"
    echo -e "${YELLOW}Токен:${NC}              $TOKEN"
    echo -e "${YELLOW}Директория:${NC}         $INSTALL_DIR"
    
    echo -e "\n${CYAN}🔧 УПРАВЛЕНИЕ:${NC}"
    echo -e "${YELLOW}Статус:${NC}             pm2 status"
    echo -e "${YELLOW}Логи:${NC}               pm2 logs fscoreboard"
    echo -e "${YELLOW}Перезапуск:${NC}         pm2 restart fscoreboard"
    echo -e "${YELLOW}Остановка:${NC}          pm2 stop fscoreboard"
    
    echo -e "\n${GREEN}🎉 FSCOREBOARD готов к использованию!${NC}"
    echo -e "${BLUE}Откройте панель управления по ссылке выше для начала работы.${NC}"
}

# Основная функция
main() {
    print_header
    
    check_root
    check_system
    update_system
    install_nodejs
    install_pm2
    install_nginx
    check_existing_projects
    interactive_setup
    clone_repository
    install_dependencies
    create_directories
    create_nginx_config
    create_env_file
    start_application
    restart_nginx
    verify_installation
    print_results
}

# Запуск
main "$@"