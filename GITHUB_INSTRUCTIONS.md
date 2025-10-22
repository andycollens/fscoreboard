# 📤 Инструкции по загрузке FSCOREBOARD на GitHub

## Шаг 1: Установка Git

### Windows
1. Скачайте Git: https://git-scm.com/download/win
2. Установите с настройками по умолчанию
3. Перезапустите терминал

### Проверка установки
```bash
git --version
```

## Шаг 2: Настройка Git

```bash
# Настройка пользователя (замените на свои данные)
git config --global user.name "Ваше Имя"
git config --global user.email "ваш-email@example.com"
```

## Шаг 3: Создание репозитория на GitHub

1. Перейдите на https://github.com
2. Нажмите **"New repository"** (зелёная кнопка)
3. Заполните:
   - **Repository name:** `fscoreboard`
   - **Description:** `Real-time scoreboard system with Express + Socket.IO`
   - **Visibility:** Public или Private
   - **НЕ добавляйте** README, .gitignore, license (они уже есть)
4. Нажмите **"Create repository"**

## Шаг 4: Загрузка проекта

### Откройте терминал в папке проекта:
```bash
# Перейдите в папку проекта
cd d:\!fscore

# Инициализация git
git init

# Добавление всех файлов
git add .

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

# Добавление удалённого репозитория (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/fscoreboard.git

# Переименование основной ветки в main
git branch -M main

# Загрузка на GitHub
git push -u origin main
```

## Шаг 5: Проверка

1. Перейдите на https://github.com/YOUR_USERNAME/fscoreboard
2. Убедитесь, что все файлы загружены
3. Проверьте, что README.md отображается корректно

## 🎉 Готово!

Ваш проект FSCOREBOARD теперь на GitHub! 

### Что дальше:

1. **Поделитесь ссылкой** с коллегами
2. **Создайте релиз** (GitHub → Releases → Create a new release)
3. **Настройте GitHub Pages** (если нужно)
4. **Добавьте темы** в настройках репозитория

### Полезные ссылки:
- **Клонирование:** `git clone https://github.com/YOUR_USERNAME/fscoreboard.git`
- **Обновление:** `git add . && git commit -m "update" && git push`
- **Документация:** См. README.md в репозитории

## 🔧 Дополнительные настройки

### Настройка SSH ключей (рекомендуется)
```bash
# Генерация SSH ключа
ssh-keygen -t ed25519 -C "ваш-email@example.com"

# Копирование публичного ключа
cat ~/.ssh/id_ed25519.pub
```

Добавьте ключ в GitHub: Settings → SSH and GPG keys → New SSH key

### Настройка .gitignore
Убедитесь, что в .gitignore есть:
```
.env
server/state.json
logs/
node_modules/
```

## 📚 Документация в репозитории

После загрузки пользователи увидят:

- **README.md** - Главная страница с описанием
- **QUICK_START.md** - Быстрый старт за 5 минут
- **DEPLOY.md** - Развёртывание на продакшн
- **OPERATIONS.md** - Управление и мониторинг
- **API.md** - API документация
- **SECURITY.md** - Безопасность
- **SMOKE_TEST.md** - Проверочный список

## 🚀 Следующие шаги

1. **Тестирование:** Запустите `npm start` и проверьте все функции
2. **Продакшн:** Следуйте DEPLOY.md для развёртывания
3. **Мониторинг:** Настройте алерты и логирование
4. **Обновления:** Регулярно обновляйте зависимости

---

**Проект FSCOREBOARD готов к использованию! 🎯**

