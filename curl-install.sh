#!/bin/bash

# =============================================================================
# FSCOREBOARD - Curl Installer (One-liner)
# =============================================================================
# Версия: 1.0.0
# Описание: Однострочная установка FSCOREBOARD через curl
# =============================================================================

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 FSCOREBOARD - Быстрая установка${NC}"
echo -e "${YELLOW}Скачивание и запуск установщика...${NC}"

# Скачивание и запуск основного установщика
curl -fsSL https://raw.githubusercontent.com/andycollens/fscoreboard/main/install.sh | sudo bash

echo -e "${GREEN}✅ Установка завершена!${NC}"
echo -e "${YELLOW}Для проверки статуса: fscoreboard-status${NC}"
echo -e "${YELLOW}Для обновления: fscoreboard-update${NC}"
