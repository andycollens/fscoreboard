#!/bin/bash

# =============================================================================
# FSCOREBOARD - Автоматический установщик для Ubuntu Server
# =============================================================================
# Версия: 1.0.0
# Автор: FSCOREBOARD Team
# Описание: Полная автоматическая установка FSCOREBOARD на Ubuntu Server
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

# Логирование
LOG_FILE="/tmp/fscoreboard_install.log"
exec > >(tee -a "$LOG_FILE")
exec 2>&1

# Функции
print_header() {
    echo -e "${BLUE}"
    echo "============================================================================="
    echo "🚀 FSCOREBOARD - Автоматический установщик"
    echo "============================================================================="
    echo -e "${NC}"
    echo -e "${YELLOW}⚠️  Рекомендация: Перед установкой обновите систему:${NC}"
    echo -e "${CYAN}   sudo apt update && sudo apt upgrade -y${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}📋 $1${NC}"
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

# Генерация случайных значений
generate_random_string() {
    local length=${1:-32}
    openssl rand -hex $((length/2))
}

generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-64
}

generate_api_token() {
    openssl rand -hex 32
}

# Проверка системы
check_system() {
    print_step "Проверка системы..."
    
    # Проверка Ubuntu
    if ! grep -q "Ubuntu" /etc/os-release; then
        print_error "Этот скрипт предназначен для Ubuntu Server"
        exit 1
    fi
    
    # Проверка версии Ubuntu
    UBUNTU_VERSION=$(lsb_release -rs)
    if [[ $(echo "$UBUNTU_VERSION < 20.04" | bc -l) -eq 1 ]]; then
        print_error "Требуется Ubuntu 20.04 или новее. Текущая версия: $UBUNTU_VERSION"
        exit 1
    fi
    
    print_success "Система совместима (Ubuntu $UBUNTU_VERSION)"
}

# Установка необходимых пакетов
install_packages() {
    print_step "Установка необходимых пакетов..."
    
    # Установка только необходимых пакетов для проекта
    apt install -y curl wget git unzip software-properties-common build-essential \
                   nginx ufw fail2ban htop bc openssl
    
    print_success "Пакеты установлены"
}

# Установка Node.js
install_nodejs() {
    print_step "Установка Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_info "Node.js уже установлен: $NODE_VERSION"
    else
        # Добавление репозитория NodeSource
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
        
        NODE_VERSION=$(node --version)
        print_success "Node.js установлен: $NODE_VERSION"
    fi
}

# Установка PM2
install_pm2() {
    print_step "Установка PM2..."
    
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 --version)
        print_info "PM2 уже установлен: $PM2_VERSION"
    else
        npm install -g pm2
        PM2_VERSION=$(pm2 --version)
        print_success "PM2 установлен: $PM2_VERSION"
    fi
    
    # Настройка автозапуска PM2
    pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER || true
}

# Настройка файрвола
setup_firewall() {
    print_step "Настройка файрвола..."
    
    ufw --force enable
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw allow 3000/tcp comment 'FSCOREBOARD App'
    
    print_success "Файрвол настроен"
}

# Клонирование проекта
clone_project() {
    print_step "Клонирование проекта..."
    
    PROJECT_DIR="/opt/fscoreboard"
    GITHUB_REPO="https://github.com/andycollens/fscoreboard.git"
    
    if [ -d "$PROJECT_DIR" ]; then
        print_info "Проект уже существует, обновляем..."
        cd "$PROJECT_DIR"
        git pull origin main
    else
        git clone "$GITHUB_REPO" "$PROJECT_DIR"
        cd "$PROJECT_DIR"
    fi
    
    print_success "Проект клонирован в $PROJECT_DIR"
}

# Установка зависимостей
install_dependencies() {
    print_step "Установка зависимостей проекта..."
    
    cd "$PROJECT_DIR"
    npm install --production
    
    print_success "Зависимости установлены"
}

# Генерация конфигурации
generate_config() {
    print_step "Генерация конфигурации..."
    
    # Генерация случайных значений
    JWT_SECRET=$(generate_jwt_secret)
    API_TOKEN=$(generate_api_token)
    APP_PORT=${APP_PORT:-3000}
    
    # Создание .env файла
    cat > "$PROJECT_DIR/.env" << EOF
# Server Configuration
PORT=$APP_PORT
NODE_ENV=production

# Security
JWT_SECRET=$JWT_SECRET
API_TOKEN=$API_TOKEN

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Generated on: $(date)
EOF
    
    print_success "Конфигурация создана"
    print_info "API Token: $API_TOKEN"
    print_info "JWT Secret: ${JWT_SECRET:0:20}..."
}

# Настройка Nginx
setup_nginx() {
    print_step "Настройка Nginx..."
    
    # Создание конфигурации Nginx
    cat > /etc/nginx/sites-available/fscoreboard << EOF
server {
    listen 80;
    server_name _;
    
    # Основное приложение
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket поддержка
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Статические файлы
    location /public/ {
        alias $PROJECT_DIR/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Логи
    access_log /var/log/nginx/fscoreboard_access.log;
    error_log /var/log/nginx/fscoreboard_error.log;
}
EOF
    
    # Активация конфигурации
    ln -sf /etc/nginx/sites-available/fscoreboard /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Проверка конфигурации
    nginx -t
    
    # Перезапуск Nginx
    systemctl reload nginx
    
    print_success "Nginx настроен"
}

# Запуск приложения
start_application() {
    print_step "Запуск приложения..."
    
    cd "$PROJECT_DIR"
    
    # Остановка существующих процессов
    pm2 delete fscoreboard 2>/dev/null || true
    
    # Запуск приложения
    pm2 start ecosystem.config.js
    pm2 save
    
    # Ожидание запуска
    sleep 5
    
    # Проверка статуса
    if pm2 list | grep -q "fscoreboard.*online"; then
        print_success "Приложение запущено"
    else
        print_error "Ошибка запуска приложения"
        pm2 logs fscoreboard --lines 20
        exit 1
    fi
}

# Создание скрипта обновления
create_update_script() {
    print_step "Создание скрипта обновления..."
    
    cat > /usr/local/bin/fscoreboard-update << 'EOF'
#!/bin/bash
# FSCOREBOARD Update Script

PROJECT_DIR="/opt/fscoreboard"
cd "$PROJECT_DIR"

echo "🔄 Обновление FSCOREBOARD..."

# Получение изменений
git pull origin main

# Установка зависимостей
npm install --production

# Остановка и удаление старого процесса
pm2 stop fscoreboard 2>/dev/null || true
pm2 delete fscoreboard 2>/dev/null || true

# Запуск нового процесса
pm2 start ecosystem.config.js
pm2 save

# Исправление конфигурации Nginx (если нужно)
if [ -f "/etc/nginx/sites-available/fscoreboard" ]; then
    echo "🔧 Исправление конфигурации Nginx..."
    sed -i 's/localhost:3000/localhost:3001/g' /etc/nginx/sites-available/fscoreboard
    nginx -t && systemctl reload nginx
    echo "✅ Nginx конфигурация обновлена"
fi

echo "✅ Обновление завершено: $(date)"
EOF
    
    chmod +x /usr/local/bin/fscoreboard-update
    
    print_success "Скрипт обновления создан: fscoreboard-update"
}

# Настройка ротации логов
setup_log_rotation() {
    print_step "Настройка ротации логов..."
    
    # Создание конфигурации logrotate для FSCOREBOARD
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
    
    # Настройка PM2 logrotate
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 3
    pm2 set pm2-logrotate:compress true
    pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
    
    print_success "Ротация логов настроена (3 дня, 10MB)"
}

# Создание скрипта мониторинга
create_monitor_script() {
    print_step "Создание скрипта мониторинга..."
    
    cat > /usr/local/bin/fscoreboard-status << 'EOF'
#!/bin/bash
# FSCOREBOARD Status Script

echo "📊 Статус FSCOREBOARD:"
echo "========================"

# Статус PM2
echo "🔄 PM2 Status:"
pm2 status

echo ""

# Последние логи
echo "📋 Последние логи:"
pm2 logs fscoreboard --lines 5

echo ""

# Использование ресурсов
echo "💻 Использование ресурсов:"
pm2 monit --no-interaction
EOF
    
    chmod +x /usr/local/bin/fscoreboard-status
    
    print_success "Скрипт мониторинга создан: fscoreboard-status"
}

# Финальная проверка
final_check() {
    print_step "Финальная проверка..."
    
    # Проверка сервисов
    if systemctl is-active --quiet nginx; then
        print_success "Nginx работает"
    else
        print_error "Nginx не работает"
    fi
    
    if pm2 list | grep -q "fscoreboard.*online"; then
        print_success "FSCOREBOARD работает"
    else
        print_error "FSCOREBOARD не работает"
    fi
    
    # Проверка портов
    if netstat -tlnp | grep -q ":$APP_PORT"; then
        print_success "Порт $APP_PORT открыт"
    else
        print_error "Порт $APP_PORT не открыт"
    fi
    
    # Тест HTTP
    if curl -f -s http://localhost:$APP_PORT/health > /dev/null; then
        print_success "HTTP тест пройден"
    else
        print_error "HTTP тест не пройден"
    fi
}

# Вывод информации о завершении
show_completion_info() {
    echo -e "${GREEN}"
    echo "============================================================================="
    echo "🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!"
    echo "============================================================================="
    echo -e "${NC}"
    
    echo -e "${CYAN}📋 Информация о системе:${NC}"
    echo "• Node.js: $(node --version)"
    echo "• NPM: $(npm --version)"
    echo "• PM2: $(pm2 --version)"
    echo "• Nginx: $(nginx -v 2>&1)"
    
    echo ""
    echo -e "${CYAN}🌐 Доступ к приложению:${NC}"
    SERVER_IP=$(curl -s ifconfig.me)
    echo "• Панель управления: http://$SERVER_IP/private/control.html?token=MySecret111"
    echo "• Табло vMix: http://$SERVER_IP/scoreboard_vmix.html"
    echo "• Перерыв: http://$SERVER_IP/htbreak.html"
    echo "• Счет перерыва: http://$SERVER_IP/htbreak_score.html"
    echo "• Заставка: http://$SERVER_IP/preloader.html"
    echo "• API Health: http://$SERVER_IP/api/health"
    
    echo ""
    echo -e "${CYAN}🎯 Как использовать:${NC}"
    echo "• Откройте панель управления для настройки команд и таймера"
    echo "• Используйте предустановки для быстрой настройки матчей"
    echo "• Добавьте URL оверлеев в vMix как Web источники"
    echo "• Управляйте таймером, счетом и цветами команд"
    
    echo ""
    echo -e "${CYAN}🔧 Управление системой:${NC}"
    echo "• Статус: fscoreboard-status"
    echo "• Обновление: fscoreboard-update"
    echo "• Логи: pm2 logs fscoreboard"
    echo "• Перезапуск: pm2 restart fscoreboard"
    
    echo ""
    echo -e "${CYAN}📁 Файлы:${NC}"
    echo "• Проект: $PROJECT_DIR"
    echo "• Конфигурация: $PROJECT_DIR/.env"
    echo "• Логи: $PROJECT_DIR/logs/"
    echo "• Nginx: /etc/nginx/sites-available/fscoreboard"
    
    echo ""
    echo -e "${YELLOW}⚠️  Важно:${NC}"
    echo "• Токен доступа к панели управления: MySecret111"
    echo "• Сохраните API Token из .env файла"
    echo "• Настройте SSL сертификат для продакшн"
    echo "• Регулярно обновляйте систему: apt update && apt upgrade"
    
    echo ""
    echo -e "${GREEN}📖 Документация:${NC}"
    echo "• README: $PROJECT_DIR/README.md"
    echo "• Быстрый старт: $PROJECT_DIR/QUICK_START.md"
    echo "• Автоустановка: $PROJECT_DIR/AUTO_INSTALL.md"
    
    echo ""
    echo -e "${CYAN}📋 Настройки логов:${NC}"
    echo "• Ротация: ежедневно, хранение 3 дня"
    echo "• Размер: максимум 10MB на файл"
    echo "• Сжатие: включено для старых логов"
    echo "• PM2 logrotate: настроен автоматически"
    
    echo ""
    echo -e "${GREEN}🚀 FSCOREBOARD готов к работе!${NC}"
}

# Основная функция
main() {
    print_header
    
    # Проверка прав root
    if [ "$EUID" -ne 0 ]; then
        print_error "Запустите скрипт с правами root: sudo $0"
        exit 1
    fi
    
    # Установка переменных
    APP_PORT=${APP_PORT:-3000}
    
    # Выполнение установки
    check_system
    install_packages
    install_nodejs
    install_pm2
    setup_firewall
    clone_project
    install_dependencies
    generate_config
    setup_nginx
    start_application
    setup_log_rotation
    create_update_script
    create_monitor_script
    final_check
    show_completion_info
    
    print_success "Установка завершена! Лог сохранен в $LOG_FILE"
}

# Запуск
main "$@"
