# 🚀 Полная инструкция по подключению к GitHub с нуля v1.0.0

## 📋 Обзор процесса

Эта инструкция поможет вам:
1. ✅ Отключить старые синхронизации
2. ✅ Установить и настроить Git на Windows
3. ✅ Создать новый репозиторий на GitHub
4. ✅ Настроить проект с нуля
5. ✅ Настроить все синхронизации

---

## 🔧 Шаг 1: Отключение старых синхронизаций

### Если у вас уже есть Git репозиторий:

```bash
# Перейдите в папку проекта
cd d:\!fscore

# Проверьте текущие удалённые репозитории
git remote -v

# Удалите старые удалённые репозитории (если есть)
git remote remove origin
git remote remove upstream

# Очистите историю (ОСТОРОЖНО! Это удалит всю историю)
# Выполните только если хотите начать с чистого листа
rm -rf .git
```

### Если у вас есть другие системы синхронизации:
- **OneDrive/Google Drive**: Отключите синхронизацию папки проекта
- **Dropbox**: Исключите папку из синхронизации
- **Другие Git репозитории**: Удалите папки `.git` в подпапках

---

## 🖥️ Шаг 2: Установка Git на Windows

### Способ 1: Официальный установщик (рекомендуется)

1. **Скачайте Git:**
   - Перейдите на https://git-scm.com/download/win
   - Скачайте последнюю версию для Windows

2. **Установка:**
   - Запустите установщик
   - Выберите "Use Git from the command line and also from 3rd-party software"
   - Выберите "Use the OpenSSL library"
   - Выберите "Checkout Windows-style, commit Unix-style line endings"
   - Выберите "Use Windows' default console window"
   - Нажмите "Install"

3. **Проверка установки:**
   ```powershell
   # Откройте PowerShell или Command Prompt
   git --version
   ```

### Способ 2: Через Chocolatey (для продвинутых пользователей)

```powershell
# Установка Chocolatey (если не установлен)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Установка Git
choco install git

# Установка Git LFS (для больших файлов)
choco install git-lfs
```

### Способ 3: Через winget (Windows 10/11)

```powershell
# Установка Git
winget install --id Git.Git -e --source winget

# Установка Git LFS
winget install --id Git.Git-LFS -e --source winget
```

---

## ⚙️ Шаг 3: Настройка Git

### Базовая настройка:

```bash
# Настройка пользователя (замените на свои данные)
git config --global user.name "Ваше Имя"
git config --global user.email "ваш-email@example.com"

# Настройка редактора (опционально)
git config --global core.editor "code --wait"

# Настройка окончаний строк для Windows
git config --global core.autocrlf true

# Настройка кодировки для Windows
git config --global core.quotepath false

# Настройка цветного вывода
git config --global color.ui auto
```

### Проверка настроек:

```bash
# Просмотр всех настроек
git config --list

# Проверка конкретных настроек
git config user.name
git config user.email
```

---

## 🔑 Шаг 4: Настройка аутентификации GitHub

### Способ 1: Personal Access Token (рекомендуется)

1. **Создание токена:**
   - Перейдите на https://github.com/settings/tokens
   - Нажмите "Generate new token" → "Generate new token (classic)"
   - Заполните:
     - **Note**: "FSCOREBOARD Development"
     - **Expiration**: 90 days (или по вашему выбору)
     - **Scopes**: Выберите `repo`, `workflow`, `write:packages`
   - Нажмите "Generate token"
   - **СОХРАНИТЕ ТОКЕН** (он больше не будет показан!)

2. **Настройка Git Credential Manager:**

```bash
# Настройка для использования токена
git config --global credential.helper manager-core

# При первом push Git попросит ввести:
# Username: ваш-github-username
# Password: ваш-personal-access-token
```

### Способ 2: SSH ключи (для продвинутых пользователей)

```bash
# Генерация SSH ключа
ssh-keygen -t ed25519 -C "ваш-email@example.com"

# Запуск ssh-agent (Windows)
eval "$(ssh-agent -s)"

# Добавление ключа
ssh-add ~/.ssh/id_ed25519

# Копирование публичного ключа
cat ~/.ssh/id_ed25519.pub
```

**Добавление ключа в GitHub:**
1. Перейдите на https://github.com/settings/keys
2. Нажмите "New SSH key"
3. Вставьте скопированный ключ
4. Сохраните

---

## 📁 Шаг 5: Создание нового репозитория на GitHub

### Создание репозитория:

1. **Перейдите на GitHub:**
   - Откройте https://github.com
   - Войдите в свой аккаунт

2. **Создание репозитория:**
   - Нажмите зелёную кнопку "New" или "+" → "New repository"
   - Заполните форму:
     - **Repository name**: `fscoreboard`
     - **Description**: `Real-time scoreboard system with Express + Socket.IO`
     - **Visibility**: 
       - ✅ Public (для открытых проектов)
       - ✅ Private (для приватных проектов)
     - **Initialize this repository with**:
       - ❌ НЕ добавляйте README
       - ❌ НЕ добавляйте .gitignore
       - ❌ НЕ добавляйте license
   - Нажмите "Create repository"

3. **Скопируйте URL репозитория:**
   - HTTPS: `https://github.com/YOUR_USERNAME/fscoreboard.git`
   - SSH: `git@github.com:YOUR_USERNAME/fscoreboard.git`

---

## 🚀 Шаг 6: Инициализация проекта с нуля

### Подготовка проекта:

```bash
# Перейдите в папку проекта
cd d:\!fscore

# Удалите старые Git файлы (если есть)
if (Test-Path .git) { Remove-Item -Recurse -Force .git }

# Инициализация нового Git репозитория
git init

# Создание .gitignore (если его нет)
@"
# Environment variables
.env
.env.local
.env.*.local

# State files
server/state.json

# Logs
logs/
*.log

# Dependencies
node_modules/

# OS files
.DS_Store
Thumbs.db
Desktop.ini

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.temp
"@ | Out-File -FilePath .gitignore -Encoding UTF8
```

### Первый коммит:

```bash
# Добавление всех файлов
git add .

# Проверка статуса
git status

# Первый коммит
git commit -m "feat: initial FSCOREBOARD implementation

- Complete Express + Socket.IO server with security
- Control panel with token protection
- Four overlay types (main, halftime, score, preloader)
- REST API with Bearer token authentication
- Socket.IO namespaces with token validation
- Server-side timer with persistence
- Data validation and normalization
- Rate limiting and security headers
- Complete documentation (README, DEPLOY, OPERATIONS, API, SECURITY)
- PM2 and Nginx configurations
- Docker support
- Production-ready deployment guide"

# Переименование основной ветки в main
git branch -M main
```

---

## 🔗 Шаг 7: Подключение к GitHub

### Добавление удалённого репозитория:

```bash
# Добавление origin (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/fscoreboard.git

# Проверка удалённых репозиториев
git remote -v

# Первая загрузка на GitHub
git push -u origin main
```

### Если возникли проблемы с аутентификацией:

```bash
# Для Windows с Git Credential Manager
git config --global credential.helper manager-core

# Для использования токена вместо пароля
# При запросе пароля введите ваш Personal Access Token
```

---

## ✅ Шаг 8: Проверка и настройка синхронизации

### Проверка подключения:

```bash
# Проверка статуса
git status

# Проверка удалённых репозиториев
git remote -v

# Проверка веток
git branch -a

# Проверка последних коммитов
git log --oneline -5
```

### Настройка автоматической синхронизации:

```bash
# Настройка push по умолчанию
git config --global push.default simple

# Настройка автоматического отслеживания веток
git config --global branch.autosetupmerge always
git config --global branch.autosetuprebase never

# Настройка pull стратегии
git config --global pull.rebase false
```

---

## 🔄 Шаг 9: Рабочий процесс с GitHub

### Ежедневная работа:

```bash
# Проверка изменений
git status

# Добавление изменений
git add .

# Коммит с описанием
git commit -m "feat: add new feature"

# Загрузка на GitHub
git push origin main

# Получение обновлений (если работаете в команде)
git pull origin main
```

### Создание веток для новых функций:

```bash
# Создание новой ветки
git checkout -b feature/new-feature

# Работа в ветке...
git add .
git commit -m "feat: implement new feature"

# Загрузка ветки на GitHub
git push origin feature/new-feature

# Возврат на основную ветку
git checkout main

# Слияние ветки
git merge feature/new-feature

# Удаление локальной ветки
git branch -d feature/new-feature

# Удаление удалённой ветки
git push origin --delete feature/new-feature
```

---

## 🛠️ Шаг 10: Дополнительные настройки для Windows

### Настройка PowerShell для Git:

```powershell
# Добавление Git в PATH (если нужно)
$env:PATH += ";C:\Program Files\Git\bin"

# Настройка алиасов для PowerShell
function gst { git status }
function gaa { git add . }
function gcm { git commit -m $args }
function gps { git push }
function gpl { git pull }

# Сохранение алиасов в профиль PowerShell
$aliases | Out-File -FilePath $PROFILE -Append
```

### Настройка VS Code для Git:

```json
// В settings.json
{
    "git.enableSmartCommit": true,
    "git.confirmSync": false,
    "git.autofetch": true,
    "git.autofetchPeriod": 180,
    "git.enableCommitSigning": false
}
```

### Настройка Windows Terminal для Git:

```json
// В settings.json Windows Terminal
{
    "profiles": {
        "list": [
            {
                "name": "Git Bash",
                "commandline": "C:\\Program Files\\Git\\bin\\bash.exe",
                "icon": "C:\\Program Files\\Git\\mingw64\\share\\git\\git-for-windows.ico"
            }
        ]
    }
}
```

---

## 🔍 Шаг 11: Проверка и тестирование

### Проверочный список:

- [ ] Git установлен и настроен
- [ ] GitHub репозиторий создан
- [ ] Проект загружен на GitHub
- [ ] Удалённые репозитории настроены
- [ ] Аутентификация работает
- [ ] Push/Pull работает
- [ ] .gitignore настроен правильно
- [ ] Ветки работают корректно

### Тестирование синхронизации:

```bash
# Создание тестового файла
echo "Test sync" > test-sync.txt

# Добавление и коммит
git add test-sync.txt
git commit -m "test: verify sync works"

# Загрузка на GitHub
git push origin main

# Проверка на GitHub.com
# Удаление тестового файла
git rm test-sync.txt
git commit -m "test: remove test file"
git push origin main
```

---

## 🚨 Решение проблем

### Проблема: "Authentication failed"

```bash
# Очистка кэша учётных данных
git config --global --unset credential.helper
git config --global credential.helper manager-core

# Или удаление сохранённых учётных данных в Windows
# Панель управления → Учётные записи → Диспетчер учётных данных
```

### Проблема: "Permission denied (publickey)"

```bash
# Проверка SSH ключей
ssh-add -l

# Тестирование SSH подключения
ssh -T git@github.com
```

### Проблема: "Repository not found"

```bash
# Проверка URL репозитория
git remote -v

# Обновление URL
git remote set-url origin https://github.com/YOUR_USERNAME/fscoreboard.git
```

---

## 📚 Полезные команды для Windows

### PowerShell алиасы:

```powershell
# Создание файла с алиасами
@"
# Git aliases
function gst { git status }
function gaa { git add . }
function gcm { git commit -m `$args }
function gps { git push }
function gpl { git pull }
function gco { git checkout `$args }
function gbr { git branch }
function glog { git log --oneline --graph }
"@ | Out-File -FilePath $PROFILE -Append
```

### Batch файлы для быстрого доступа:

```batch
@echo off
REM git-status.bat
git status
pause

@echo off
REM git-push.bat
git add .
git commit -m "update"
git push origin main
pause
```

---

## 🎯 Готово!

Теперь ваш проект FSCOREBOARD полностью настроен для работы с GitHub:

### ✅ Что настроено:
- Git установлен и настроен для Windows
- GitHub репозиторий создан
- Аутентификация настроена
- Синхронизация работает
- Старые синхронизации отключены

### 🚀 Следующие шаги:
1. **Регулярные коммиты**: `git add . && git commit -m "описание" && git push`
2. **Создание релизов**: GitHub → Releases → Create a new release
3. **Настройка CI/CD**: Добавьте GitHub Actions
4. **Коллаборация**: Пригласите участников в репозиторий

### 📖 Дополнительная документация:
- **README.md** - Описание проекта
- **DEPLOY.md** - Развёртывание
- **API.md** - API документация
- **SECURITY.md** - Безопасность

---

## 🔄 Рабочий процесс обновления проекта на сервере

### 📋 Полный цикл разработки: Локальная разработка → GitHub → Сервер

После первоначального развёртывания проекта, вот пошаговый процесс для внесения изменений и их развёртывания на сервере:

---

## 🛠️ Шаг 1: Локальная разработка

### Внесение изменений в код:

```bash
# Перейдите в папку проекта
cd d:\!fscore

# Проверьте текущий статус
git status

# Внесите изменения в файлы (через VS Code или другой редактор)
# Например: изменили server/app.js, public/scoreboard_vmix.html и т.д.

# Проверьте изменения
git diff
```

### Тестирование локально:

```bash
# Запустите проект локально для проверки
npm start

# Откройте http://localhost:3000
# Проверьте все функции, которые изменили
# Убедитесь, что всё работает корректно

# Остановите сервер (Ctrl+C)
```

---

## 📤 Шаг 2: Загрузка изменений в GitHub

### Коммит и загрузка:

```bash
# Добавление всех изменений
git add .

# Проверка того, что будет закоммичено
git status

# Создание коммита с описанием изменений
git commit -m "feat: add new scoreboard feature

- Updated scoreboard layout
- Added new timer controls
- Fixed responsive design issues
- Updated API endpoints"

# Загрузка на GitHub
git push origin main
```

### Проверка на GitHub:

1. Перейдите на https://github.com/YOUR_USERNAME/fscoreboard
2. Убедитесь, что изменения загружены
3. Проверьте, что коммит отображается в истории

---

## 🚀 Шаг 3: Обновление на сервере

### Подключение к серверу:

```bash
# Подключение по SSH (замените на ваши данные)
ssh username@your-server-ip

# Или через пароль
ssh username@your-server-ip
# Введите пароль при запросе
```

### Обновление кода на сервере:

```bash
# Перейдите в папку проекта на сервере
cd /path/to/your/fscoreboard

# Проверьте текущий статус
git status

# Получите последние изменения с GitHub
git pull origin main

# Проверьте, что изменения загружены
git log --oneline -3
```

### Перезапуск сервисов:

```bash
# Если используете PM2
pm2 restart fscoreboard

# Или перезапуск через systemd
sudo systemctl restart fscoreboard

# Проверка статуса
pm2 status
# или
sudo systemctl status fscoreboard
```

### Проверка работы:

```bash
# Проверка логов
pm2 logs fscoreboard

# Или для systemd
sudo journalctl -u fscoreboard -f

# Проверка портов
netstat -tlnp | grep :3000
```

---

## 🔧 Автоматизация процесса обновления

### Создание скрипта обновления на сервере:

```bash
# Создайте файл update.sh на сервере
nano /path/to/your/fscoreboard/update.sh
```

**Содержимое update.sh:**

```bash
#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Обновление FSCOREBOARD...${NC}"

# Переход в папку проекта
cd /path/to/your/fscoreboard

# Проверка статуса Git
echo -e "${YELLOW}📋 Проверка статуса Git...${NC}"
git status

# Получение изменений
echo -e "${YELLOW}📥 Получение изменений с GitHub...${NC}"
git pull origin main

# Проверка изменений
echo -e "${YELLOW}📊 Проверка последних коммитов...${NC}"
git log --oneline -3

# Перезапуск PM2
echo -e "${YELLOW}🔄 Перезапуск PM2...${NC}"
pm2 restart fscoreboard

# Проверка статуса
echo -e "${YELLOW}✅ Проверка статуса...${NC}"
pm2 status

# Проверка логов
echo -e "${YELLOW}📋 Последние логи:${NC}"
pm2 logs fscoreboard --lines 10

echo -e "${GREEN}🎉 Обновление завершено!${NC}"
```

### Сделайте скрипт исполняемым:

```bash
chmod +x /path/to/your/fscoreboard/update.sh
```

### Использование скрипта:

```bash
# Запуск обновления одной командой
./update.sh
```

---

## 🖥️ Локальный скрипт для быстрого деплоя

### Создайте файл deploy.bat на Windows:

```batch
@echo off
echo 🚀 Быстрый деплой FSCOREBOARD

echo 📋 Проверка статуса...
git status

echo 📤 Добавление изменений...
git add .

echo 💾 Создание коммита...
set /p commit_msg="Введите описание изменений: "
git commit -m "%commit_msg%"

echo 📡 Загрузка на GitHub...
git push origin main

echo ✅ Изменения загружены на GitHub!
echo 🔄 Теперь обновите сервер командой: ssh username@server "./update.sh"

pause
```

### Создайте файл deploy.ps1 для PowerShell:

```powershell
# Быстрый деплой через PowerShell
param(
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

Write-Host "🚀 Быстрый деплой FSCOREBOARD" -ForegroundColor Green

Write-Host "📋 Проверка статуса..." -ForegroundColor Yellow
git status

Write-Host "📤 Добавление изменений..." -ForegroundColor Yellow
git add .

Write-Host "💾 Создание коммита..." -ForegroundColor Yellow
git commit -m $CommitMessage

Write-Host "📡 Загрузка на GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Изменения загружены на GitHub!" -ForegroundColor Green
Write-Host "🔄 Теперь обновите сервер командой: ssh username@server './update.sh'" -ForegroundColor Cyan
```

### Использование PowerShell скрипта:

```powershell
# Запуск с описанием изменений
.\deploy.ps1 -CommitMessage "feat: add new scoreboard animations"
```

---

## 🔄 Полный рабочий цикл (пример)

### 1. Локальная разработка:

```bash
# Внесли изменения в server/app.js
# Добавили новую функцию анимации

# Тестирование
npm start
# Проверили в браузере - всё работает
```

### 2. Коммит и загрузка:

```bash
# Быстрый деплой
.\deploy.bat
# Ввели: "feat: add scoreboard animations"

# Или через PowerShell
.\deploy.ps1 -CommitMessage "feat: add scoreboard animations"
```

### 3. Обновление на сервере:

```bash
# Подключение к серверу
ssh username@your-server-ip

# Запуск обновления
cd /path/to/fscoreboard
./update.sh
```

### 4. Проверка на сервере:

```bash
# Проверка статуса
pm2 status

# Проверка логов
pm2 logs fscoreboard --lines 20

# Тестирование в браузере
curl http://localhost:3000/health
```

---

## 🚨 Решение проблем при обновлении

### Проблема: Конфликты при git pull

```bash
# Если есть конфликты
git stash
git pull origin main
git stash pop

# Или принудительное обновление (ОСТОРОЖНО!)
git reset --hard origin/main
```

### Проблема: PM2 не перезапускается

```bash
# Принудительный перезапуск
pm2 kill
pm2 start ecosystem.config.js

# Или полная перезагрузка
pm2 delete fscoreboard
pm2 start ecosystem.config.js
```

### Проблема: Порт занят

```bash
# Проверка процессов на порту
lsof -i :3000

# Убийство процесса
kill -9 PID_NUMBER

# Перезапуск PM2
pm2 restart fscoreboard
```

---

## 📊 Мониторинг обновлений

### Создайте скрипт мониторинга:

```bash
# monitor.sh
#!/bin/bash

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
pm2 monit
```

### Автоматическая проверка после обновления:

```bash
# Добавьте в update.sh после перезапуска
echo -e "${YELLOW}🔍 Проверка работоспособности...${NC}"

# Проверка HTTP ответа
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Сервер отвечает корректно${NC}"
else
    echo -e "${RED}❌ Проблема с сервером!${NC}"
    pm2 logs fscoreboard --lines 20
fi
```

---

## 🎯 Рекомендации для эффективной работы

### 1. **Частые мелкие коммиты:**
```bash
# Лучше делать много маленьких коммитов
git commit -m "fix: timer display issue"
git commit -m "feat: add new button"
git commit -m "style: improve mobile layout"
```

### 2. **Тестирование перед коммитом:**
```bash
# Всегда тестируйте локально
npm start
# Проверьте все функции
# Только потом коммитьте
```

### 3. **Описательные сообщения коммитов:**
```bash
# Хорошо
git commit -m "feat: add real-time score updates with WebSocket"

# Плохо
git commit -m "fix"
```

### 4. **Регулярные обновления сервера:**
```bash
# Обновляйте сервер после каждого значимого изменения
# Не накапливайте много изменений
```

---

**Проект готов к разработке! 🎉**