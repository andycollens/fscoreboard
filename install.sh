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

# Проверка обновлений (опционально)
check_updates() {
    print_step "Проверка обновлений системы..."
    
    local updates_available=$(apt list --upgradable 2>/dev/null | grep -c "upgradable" 2>/dev/null || echo "0")
    
    # Убираем лишние символы и проверяем что это число
    updates_available=$(echo "$updates_available" | tr -d '\n\r' | grep -o '^[0-9]*$' || echo "0")
    
    if [ "$updates_available" -gt 0 ]; then
        print_warning "Доступно $updates_available обновлений пакетов"
        read -p "Обновить систему перед установкой? (y/N): " update_system
        
        if [[ "$update_system" =~ ^[Yy]$ ]]; then
            print_info "Обновление системы..."
            apt update -y
            apt upgrade -y
            print_success "Система обновлена"
        else
            print_info "Обновление пропущено"
        fi
    else
        print_success "Система актуальна"
    fi
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

# Поиск уникального имени для PM2 процесса
find_unique_pm2_name() {
    local base_name="fscoreboard"
    local name="$base_name"
    local counter=1
    
    while pm2 list --no-color 2>/dev/null | grep -q " $name "; do
        name="${base_name}_${counter}"
        counter=$((counter + 1))
    done
    
    echo "$name"
}

# Проверка и освобождение порта
ensure_port_free() {
    local port=$1
    local processes=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | sort -u)
    
    if [ -n "$processes" ]; then
        print_warning "Порт $port занят процессами: $processes"
        
        for pid in $processes; do
            if [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
                print_info "Останавливаем процесс $pid на порту $port"
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
        
        sleep 2
        
        # Проверяем, освободился ли порт
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            print_warning "Порт $port все еще занят, ищем альтернативный"
            return 1
        else
            print_success "Порт $port освобожден"
            return 0
        fi
    fi
    
    return 0
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
    
    # Токен управления
    read -p "Введите токен для панели управления (или Enter для автогенерации): " custom_token
    if [ -z "$custom_token" ]; then
        TOKEN=$(generate_token)
        print_info "Сгенерирован токен управления: $TOKEN"
    else
        TOKEN=$custom_token
    fi
    
    # Токен для Stadium
    read -p "Введите токен для Stadium (или Enter для автогенерации): " custom_stadium_token
    if [ -z "$custom_stadium_token" ]; then
        STADIUM_TOKEN=$(generate_token)
        print_info "Сгенерирован токен для Stadium: $STADIUM_TOKEN"
    else
        STADIUM_TOKEN=$custom_stadium_token
    fi
    
    # Токен для Service (страница составов)
    read -p "Введите токен для Service (или Enter для автогенерации): " custom_service_token
    if [ -z "$custom_service_token" ]; then
        SERVICE_TOKEN=$(generate_token)
        print_info "Сгенерирован токен для Service: $SERVICE_TOKEN"
    else
        SERVICE_TOKEN=$custom_service_token
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

# Проверка типа установки и существующих проектов
check_installation_type() {
    print_step "Определение типа установки..."
    
    local is_existing_installation=false
    local warnings=()
    
    # Проверка существующей установки FSCOREBOARD
    if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/server/app.js" ]; then
        is_existing_installation=true
        print_info "Обнаружена существующая установка FSCOREBOARD в $INSTALL_DIR"
        
        # Проверяем статус PM2 процесса
        if pm2 list | grep -q "fscoreboard.*online"; then
            print_info "FSCOREBOARD процесс запущен в PM2"
        else
            print_warning "FSCOREBOARD процесс не запущен в PM2"
        fi
    fi
    
    # Проверка Nginx конфигураций
    if [ -d "$NGINX_SITES_ENABLED" ]; then
        local nginx_configs=$(ls $NGINX_SITES_ENABLED/ 2>/dev/null | wc -l)
        if [ "$nginx_configs" -gt 0 ]; then
            print_warning "Найдены существующие конфигурации Nginx:"
            ls -la $NGINX_SITES_ENABLED/
            
            # Специальная проверка для default конфигурации
            if [ -L "$NGINX_SITES_ENABLED/default" ]; then
                print_warning "⚠️  Обнаружена default конфигурация Nginx - будет отключена для избежания конфликтов"
            fi
            
            warnings+=("nginx")
        fi
    fi
    
    # Проверка PM2 процессов
    if command -v pm2 &> /dev/null; then
        local pm2_processes=$(pm2 list --no-color | grep -c "online" || true)
        if [ "$pm2_processes" -gt 0 ]; then
            print_warning "Найдены запущенные PM2 процессы:"
            pm2 list
            warnings+=("pm2")
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
        warnings+=("ports")
    fi
    
    # Определение типа установки
    if [ "$is_existing_installation" = true ]; then
        echo -e "\n${PURPLE}🔄 РЕЖИМ: ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕЙ УСТАНОВКИ${NC}"
        echo -e "${CYAN}Обнаружена существующая установка FSCOREBOARD.${NC}"
        echo ""
        echo -e "${GREEN}✅ Что будет сделано:${NC}"
        echo -e "  • Обновление кода из репозитория"
        echo -e "  • Перезапуск сервисов с новой конфигурацией"
        echo -e "  • Сохранение всех настроек и данных"
        echo -e "  • Проверка работоспособности"
        echo ""
        
        # Интерактивный запрос для обновления
        if [ -t 0 ] && [ -z "$NONINTERACTIVE" ]; then
            echo -n "Обновить существующую установку FSCOREBOARD? (Y/n): "
            read -t 10 update_existing
            if [ $? -ne 0 ] || [ -z "$update_existing" ]; then
                print_info "Таймаут или пустой ответ - продолжаем обновление автоматически"
            elif [[ "$update_existing" =~ ^[Nn]$ ]]; then
                print_info "Обновление отменено"
                exit 0
            fi
        else
            print_info "Неинтерактивный режим - продолжаем обновление автоматически"
        fi
    elif [ ${#warnings[@]} -gt 0 ]; then
        echo -e "\n${BLUE}🆕 РЕЖИМ: УСТАНОВКА НА СЕРВЕР С СУЩЕСТВУЮЩИМИ ПРОЕКТАМИ${NC}"
        echo -e "${CYAN}FSCOREBOARD будет установлен БЕЗОПАСНО рядом с существующими сервисами.${NC}"
    else
        echo -e "\n${GREEN}🆕 РЕЖИМ: ЧИСТАЯ УСТАНОВКА${NC}"
        echo -e "${CYAN}Выполняется установка на чистый сервер.${NC}"
    fi
    
    # Обработка конфликтов
    if [ ${#warnings[@]} -gt 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Что будет сделано:${NC}"
        if [ "$is_existing_installation" = true ]; then
            echo -e "  • Обновление кода из репозитория"
            echo -e "  • Перезапуск сервисов с новой конфигурацией"
            echo -e "  • Сохранение всех настроек и данных"
        else
            echo -e "  • Nginx: добавлена новая конфигурация (существующие сохранены)"
            echo -e "  • PM2: добавлен новый процесс (существующие не затронуты)"
            echo -e "  • Порты: выбран свободный порт или предложен альтернативный"
        fi
        echo ""
        echo -e "${BLUE}🔧 Управление после установки:${NC}"
        echo -e "  • FSCOREBOARD: pm2 restart fscoreboard"
        if [ "$is_existing_installation" = false ]; then
            echo -e "  • Другие проекты: работают независимо"
        fi
        echo ""
        
        echo ""
        
        # Проверяем интерактивность и наличие переменной окружения
        if [ -t 0 ] && [ -z "$NONINTERACTIVE" ]; then
            echo -n "Продолжить установку? (Y/n): "
            read -t 10 continue_install
            if [ $? -ne 0 ] || [ -z "$continue_install" ]; then
                print_info "Таймаут или пустой ответ - продолжаем установку автоматически"
            elif [[ "$continue_install" =~ ^[Nn]$ ]]; then
                print_info "Установка отменена"
                exit 0
            fi
        else
            print_info "Неинтерактивный режим - продолжаем установку автоматически"
        fi
        
        print_success "Продолжаем установку..."
    else
        print_success "Конфликтов не обнаружено"
    fi
    
    # Сохраняем тип установки для использования в других функциях
    export INSTALLATION_TYPE=$([ "$is_existing_installation" = true ] && echo "update" || echo "fresh")
}

# Клонирование или обновление репозитория
clone_repository() {
    if [ "$INSTALLATION_TYPE" = "update" ]; then
        print_step "Обновление репозитория..."
        cd "$INSTALL_DIR"
        
        # Создание резервной копии конфигурации
        if [ -f ".env" ]; then
            cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
            print_info "Создана резервная копия конфигурации"
        fi
        
        # Обновление кода
        git fetch origin
        git reset --hard origin/main
        print_success "Код обновлен из репозитория"
    else
        print_step "Клонирование репозитория..."
        git clone "$REPO_URL" "$INSTALL_DIR"
        chown -R $SUDO_USER:$SUDO_USER "$INSTALL_DIR"
        print_success "Репозиторий клонирован"
    fi
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
    
    # Отключаем default конфигурацию Nginx, чтобы избежать конфликтов
    if [ -L "$NGINX_SITES_ENABLED/default" ]; then
        print_info "Отключение default конфигурации Nginx для избежания конфликтов..."
        rm -f "$NGINX_SITES_ENABLED/default"
        print_success "Default конфигурация отключена"
    fi
    
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

    # Загрузка рекламных роликов — лимит 1 ГБ (иначе 413 Request Entity Too Large)
    location /api/ads {
        client_max_body_size 1024M;
        proxy_request_buffering off;
        proxy_pass http://localhost:$PORT;
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
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

    # Статика /public/ — без буферизации прокси (net::ERR_CONTENT_LENGTH_MISMATCH в Chrome)
    location ^~ /public/ {
        proxy_pass http://localhost:$PORT;
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

# Создание или обновление .env файла
create_env_file() {
    if [ "$INSTALLATION_TYPE" = "update" ]; then
        print_step "Обновление файла конфигурации..."
        
        # Восстанавливаем резервную копию если есть
        local latest_backup=$(ls -t "$INSTALL_DIR"/.env.backup.* 2>/dev/null | head -1)
        if [ -n "$latest_backup" ]; then
            cp "$latest_backup" "$INSTALL_DIR/.env"
            print_info "Восстановлена конфигурация из резервной копии"
        fi
        
        # Обновляем только если файл не существует
        if [ ! -f "$INSTALL_DIR/.env" ]; then
            cat > "$INSTALL_DIR/.env" << EOF
PORT=$PORT
TOKEN=$TOKEN
NODE_ENV=production
EOF
            print_info "Создан новый файл .env"
        else
            print_info "Сохранена существующая конфигурация"
        fi
    else
        print_step "Создание файла конфигурации..."
        
        cat > "$INSTALL_DIR/.env" << EOF
PORT=$PORT
TOKEN=$TOKEN
NODE_ENV=production
EOF
        print_success "Файл .env создан"
    fi
    
        chown $SUDO_USER:$SUDO_USER "$INSTALL_DIR/.env"
    
    # Создаем или обновляем config.json для токенов
    print_step "Создание файла конфигурации токенов..."
    
    local config_file="$INSTALL_DIR/server/config.json"
    if [ "$INSTALLATION_TYPE" = "update" ] && [ -f "$config_file" ]; then
        print_info "Сохранена существующая конфигурация токенов"
    else
        cat > "$config_file" << EOF
{
  "token": "$TOKEN",
  "stadiumToken": "$STADIUM_TOKEN",
  "serviceToken": "$SERVICE_TOKEN"
}
EOF
        print_success "Файл config.json создан"
    fi
    
    chown $SUDO_USER:$SUDO_USER "$config_file"
}

# Установка команды для получения ссылок
install_links_command() {
    print_step "Установка команды для получения ссылок..."
    
    # Скачиваем скрипт для ссылок
    curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/fscoreboard-links.sh -o "$INSTALL_DIR/fscoreboard-links.sh"
    
    # Делаем исполняемым
    chmod +x "$INSTALL_DIR/fscoreboard-links.sh"
    
    # Создаем глобальную команду
    ln -sf "$INSTALL_DIR/fscoreboard-links.sh" /usr/local/bin/fscoreboard-links
    
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

# Запуск приложения
start_application() {
    print_step "Запуск приложения..."
    cd "$INSTALL_DIR"
    
    # Получаем уникальное имя для процесса
    PM2_NAME=$(find_unique_pm2_name)
    print_info "Используем имя процесса: $PM2_NAME"
    
    # Останавливаем и удаляем существующие процессы с похожими именами
    pm2 stop fscoreboard 2>/dev/null || true
    pm2 delete fscoreboard 2>/dev/null || true
    
    # Останавливаем процессы с похожими именами
    for i in {1..10}; do
        pm2 stop "fscoreboard_$i" 2>/dev/null || true
        pm2 delete "fscoreboard_$i" 2>/dev/null || true
    done
    
    # Проверяем и освобождаем порт
    if ! ensure_port_free $PORT; then
        print_warning "Не удалось освободить порт $PORT, ищем альтернативный"
        PORT=$(find_free_port $PORT)
        print_info "Выбран альтернативный порт: $PORT"
        
        # Обновляем .env файл с новым портом
        sed -i "s/PORT=.*/PORT=$PORT/" "$INSTALL_DIR/.env"
    fi
    
    # Создаем ecosystem.config.js для правильной работы с переменными окружения
    # Убираем \r и переводы строк из значений (иначе кавычка ломается и PM2: malformated)
    PORT=$(echo "$PORT" | tr -d '\r\n')
    TOKEN=$(echo "$TOKEN" | tr -d '\r\n')
    cat > "$INSTALL_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: '$PM2_NAME',
    script: 'server/app.js',
    cwd: '$INSTALL_DIR',
    env: {
      NODE_ENV: 'production',
      PORT: '$PORT',
      TOKEN: '$TOKEN'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/root/.pm2/logs/$PM2_NAME-error.log',
    out_file: '/root/.pm2/logs/$PM2_NAME-out.log',
    log_file: '/root/.pm2/logs/$PM2_NAME-combined.log',
    time: true
  }]
};
EOF

    # Запуск через ecosystem файл
    pm2 start ecosystem.config.js
    pm2 save
    
    if [ "$INSTALLATION_TYPE" = "fresh" ]; then
        pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER
    fi
    
    print_success "Приложение запущено как '$PM2_NAME' на порту $PORT"
}

# Перезапуск Nginx
restart_nginx() {
    print_step "Перезапуск Nginx..."
    
    # Дополнительная проверка - убеждаемся, что default отключен
    if [ -L "$NGINX_SITES_ENABLED/default" ]; then
        print_warning "Default конфигурация все еще активна, отключаем..."
        rm -f "$NGINX_SITES_ENABLED/default"
    fi
    
    # Проверяем конфигурацию перед перезапуском
    if nginx -t; then
        systemctl reload nginx
        print_success "Nginx перезапущен"
    else
        print_error "Ошибка в конфигурации Nginx"
        print_info "Проверьте конфигурацию: nginx -t"
        return 1
    fi
}

# Проверка работоспособности
verify_installation() {
    print_step "Проверка работоспособности..."
    
    # Ожидание запуска приложения
    sleep 5
    
    # Проверка PM2 (используем динамическое имя)
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
    print_step "Подготовка результатов установки..."
    
    # Получаем актуальные данные
    local current_domain=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    local current_port=$(grep -o 'PORT=[0-9]*' "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "$PORT")
    local current_token=$(grep -o 'TOKEN=[^[:space:]]*' "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "$TOKEN")
    
    # Читаем токены из config.json (если есть), иначе из переменных
    local config_file="$INSTALL_DIR/server/config.json"
    local current_stadium_token="$STADIUM_TOKEN"
    local current_service_token="$SERVICE_TOKEN"
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
    
    # Отладочная информация
    print_info "Домен: $current_domain"
    print_info "Порт: $current_port"
    print_info "Токен управления: $current_token"
    print_info "Токен Stadium: $current_stadium_token"
    print_info "Токен Service: $current_service_token"
    
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════════════════════╗"
    if [ "$INSTALLATION_TYPE" = "update" ]; then
        echo "║                         ОБНОВЛЕНИЕ ЗАВЕРШЕНО!                              ║"
    else
        echo "║                           УСТАНОВКА ЗАВЕРШЕНА!                              ║"
    fi
    echo "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}🌐 ГОТОВЫЕ ССЫЛКИ ДЛЯ КОПИРОВАНИЯ:${NC}"
    echo -e "${YELLOW}Панель управления:${NC}"
    echo -e "  ${GREEN}http://$current_domain/private/control.html?token=$current_token${NC}"
    echo ""
    echo -e "${YELLOW}Страницы табло:${NC}"
    echo -e "  ${GREEN}http://$current_domain/scoreboard.html${NC}  (основное табло)"
    echo -e "  ${GREEN}http://$current_domain/penalti.html${NC}  (табло пенальти)"
    echo -e "  ${GREEN}http://$current_domain/public/scoreboard_vmix.html${NC}  (табло для vMix)"
    echo -e "  ${GREEN}http://$current_domain/stadium.html?token=$current_stadium_token${NC}  (стадион)"
    echo -e "  ${GREEN}http://$current_domain/service.html?token=$current_service_token${NC}  (service — составы по токену; кнопка «Награждение»: фанфары / гимн РФ / Champions)"
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
    echo -e "${YELLOW}Директория:${NC}         $INSTALL_DIR"
    
    echo -e "\n${CYAN}🔧 УПРАВЛЕНИЕ:${NC}"
    echo -e "${YELLOW}Статус:${NC}             pm2 status"
    echo -e "${YELLOW}Логи:${NC}               pm2 logs fscoreboard"
    echo -e "${YELLOW}Перезапуск:${NC}         pm2 restart fscoreboard"
    echo -e "${YELLOW}Остановка:${NC}          pm2 stop fscoreboard"
    echo -e "${YELLOW}Поиск процесса:${NC}     pm2 list | grep fscoreboard"
    
    echo -e "\n${GREEN}🎉 FSCOREBOARD готов к использованию!${NC}"
    echo -e "${BLUE}Скопируйте ссылку панели управления выше для начала работы.${NC}"
}

# Основная функция
main() {
    print_header
    
    # Проверяем флаг принудительного неинтерактивного режима
    if [ "$1" = "--non-interactive" ] || [ "$1" = "-y" ]; then
        export NONINTERACTIVE=1
        print_info "Принудительный неинтерактивный режим"
    fi
    
    check_root
    check_system
    check_updates
    install_nodejs
    install_pm2
    install_nginx
    check_installation_type
    
    # Интерактивная настройка только для новых установок и интерактивного режима
    if [ "$INSTALLATION_TYPE" = "fresh" ] && [ -t 0 ]; then
        interactive_setup
    else
        # Для обновлений или неинтерактивного режима используем автоматические настройки
        if [ "$INSTALLATION_TYPE" = "update" ]; then
            PORT=$(grep -o 'PORT=[0-9]*' "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '\r\n' || echo "3001")
            TOKEN=$(grep -o 'TOKEN=[^[:space:]]*' "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '\r\n' || echo "$DEFAULT_TOKEN")
            print_info "Используются существующие настройки: порт $PORT"
        else
            PORT=$(find_free_port $DEFAULT_PORT)
            TOKEN=$(generate_token)
            STADIUM_TOKEN=$(generate_token)
            print_info "Автоматически выбраны настройки: порт $PORT"
        fi
        DOMAIN=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
        print_info "Домен/IP: $DOMAIN"
    fi
    clone_repository
    install_dependencies
    create_directories
    create_nginx_config
    create_env_file
    install_links_command
    start_application
    restart_nginx
    # Всегда показываем результаты, даже если есть ошибки
    echo -e "\n${PURPLE}🔍 ОТЛАДКА: Вызываем print_results...${NC}"
    print_results
    
    if verify_installation; then
        print_success "Установка завершена успешно!"
    else
        print_error "Установка завершена с ошибками"
        print_info "Проверьте логи: pm2 logs fscoreboard"
        print_info "Попробуйте перезапустить: pm2 restart fscoreboard"
        print_info "Или найдите процесс: pm2 list"
    fi
    
    echo -e "\n${PURPLE}🔍 ОТЛАДКА: Функция main завершена${NC}"
}

# Обработчик ошибок для гарантированного вывода результатов
trap 'echo -e "\n${RED}❌ ОШИБКА: Скрипт завершился с ошибкой${NC}"; print_results; exit 1' ERR

# Запуск
main "$@"

# Принудительный вывод результатов в самом конце
echo -e "\n${PURPLE}🔍 ОТЛАДКА: Принудительный вывод результатов в конце скрипта${NC}"
print_results