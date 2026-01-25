const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// ====== Конфигурация ======
const PORT = process.env.PORT || 3002;
const TOKEN = process.env.TOKEN || 'MySecret111';
const STADIUM_TOKEN = process.env.STADIUM_TOKEN || 'StadiumSecret222';
const SAVE_PATH = path.join(__dirname, 'state.json');
const PRESETS_PATH = path.join(__dirname, 'presets.json');
const TOURNAMENTS_PATH = path.join(__dirname, 'tournaments.json');
const TEAMS_PATH = path.join(__dirname, 'teams.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const LOGOS_PATH = path.join(__dirname, '..', 'public', 'logos');
const CUSTOM_STYLES_PATH = path.join(__dirname, 'custom-styles.json');
const CUSTOM_STYLES_DIR = path.join(__dirname, '..', 'public', 'img', 'custom-styles');

// Ensure custom styles directory exists
if (!fs.existsSync(CUSTOM_STYLES_DIR)) {
  fs.mkdirSync(CUSTOM_STYLES_DIR, { recursive: true });
}

// Загрузка конфигурации (токены)
let config = { token: TOKEN, stadiumToken: STADIUM_TOKEN };
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...savedConfig };
  } catch (error) {
    console.error('Ошибка загрузки конфигурации:', error);
  }
}

let stadiumModeState = config.stadiumMode || 'scoreboard';

// Функция для получения актуального токена управления
function getActualToken() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return savedConfig.token || TOKEN;
    } catch (error) {
      return TOKEN;
    }
  }
  return TOKEN;
}

// Функция для получения актуального токена stadium
function getActualStadiumToken() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return savedConfig.stadiumToken || STADIUM_TOKEN;
    } catch (error) {
      return STADIUM_TOKEN;
    }
  }
  return STADIUM_TOKEN;
}

// Функция для получения tournamentTitle из конфига
function getTournamentTitle() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return savedConfig.tournamentTitle || null;
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Функция для добавления tournamentTitle к state перед отправкой
function enrichStateWithConfig(state) {
  const tournamentTitle = getTournamentTitle();
  if (tournamentTitle) {
    return { ...state, tournamentTitle };
  }
  return state;
}

// Используем токены из конфигурации для инициализации
const ACTUAL_TOKEN = config.token || TOKEN;
const ACTUAL_STADIUM_TOKEN = config.stadiumToken || STADIUM_TOKEN;

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, LOGOS_PATH);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    
    // Определяем расширение из MIME-типа, а не из имени файла
    // Это гарантирует, что имя файла полностью не зависит от оригинального имени
    let extension = '.png'; // По умолчанию
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      extension = '.jpg';
    } else if (file.mimetype === 'image/png') {
      extension = '.png';
    } else if (file.mimetype === 'image/gif') {
      extension = '.gif';
    } else if (file.mimetype === 'image/webp') {
      extension = '.webp';
    } else {
      // Если MIME-тип не распознан, пытаемся взять из оригинального имени как fallback
      const originalExt = path.extname(file.originalname).toLowerCase();
      if (originalExt && /\.(jpg|jpeg|png|gif|webp)$/i.test(originalExt)) {
        extension = originalExt;
      }
    }
    
    // Если передан tournamentId и teamId, используем их для уникальности
    const tournamentId = req.body.tournamentId || req.query.tournamentId || '';
    const teamId = req.body.teamId || req.query.teamId || '';
    const isBaseTeam = req.body.isBaseTeam === 'true' || req.query.isBaseTeam === 'true';
    
    let filename;
    if (isBaseTeam && teamId) {
      // Для команды из базы команд (без турнира): team_base_teamId_timestamp_random.ext
      filename = `team_base_${teamId}_${timestamp}_${random}${extension}`;
    } else if (tournamentId && teamId) {
      // Для редактирования команды в турнире: team_tournamentId_teamId_timestamp_random.ext
      // Имя полностью уникально и не зависит от оригинального имени файла
      // Этот логотип привязан к записи команды и удаляется только с удалением команды
      filename = `team_${tournamentId}_${teamId}_${timestamp}_${random}${extension}`;
    } else if (tournamentId) {
      // Для новой команды в турнире: team_tournamentId_timestamp_random.ext
      filename = `team_${tournamentId}_${timestamp}_${random}${extension}`;
    } else if (isBaseTeam) {
      // Для новой команды в базе (без teamId): team_base_timestamp_random.ext
      filename = `team_base_${timestamp}_${random}${extension}`;
    } else {
      // Для основной панели управления матчем: main_timestamp_random.ext
      // Логотип главного окна уникален и не связан с записями команд в турнирах
      filename = `main_${timestamp}_${random}${extension}`;
    }
    
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены!'));
    }
  }
});

// ====== Состояние табло ======
let state = {
  timerRunning: false,
  timerSeconds: 0,
  timerStartTS: null,
  time: "00:00",
  score1: 0,
  score2: 0,
  team1: "Хозяева",
  team2: "Гости",
  team1Short: "ХОЗ",
  team2Short: "ГОС",
  kit1Color: "#2b2b2b",
  kit2Color: "#2b2b2b",
  team1Name: "",
  team2Name: "",
  team1City: "",
  team2City: "",
  team1Logo: "",
  team2Logo: "",
  team1Id: null,
  team2Id: null,
  team1Players: [],
  team1Staff: [],
  team2Players: [],
  team2Staff: [],
  penaltyActive: false,
  penaltyMode: "adult",
  penaltyMaxAttempts: 5,
  penaltySeries: null
};

// ====== Предварительные настройки матчей ======
let matchPresets = [];

// ====== Турниры ======
let tournaments = [];

// ====== Команды (база команд) ======
let teams = [];

// ====== Загрузка состояния ======
if (fs.existsSync(SAVE_PATH)) {
  try {
    const savedData = JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
    state = { ...state, ...savedData };
    // Убеждаемся, что teamId поля инициализированы (для старых файлов)
    if (state.team1Id === undefined) state.team1Id = null;
    if (state.team2Id === undefined) state.team2Id = null;
  } catch (e) {
    console.error("Ошибка чтения state.json", e);
  }
}

// ====== Загрузка предустановок ======
if (fs.existsSync(PRESETS_PATH)) {
  try {
    const savedPresets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
    matchPresets = savedPresets;
  } catch (e) {
    console.error("Ошибка чтения presets.json", e);
  }
}

// ====== Загрузка турниров ======
if (fs.existsSync(TOURNAMENTS_PATH)) {
  try {
    const savedTournaments = JSON.parse(fs.readFileSync(TOURNAMENTS_PATH, 'utf8'));
    // Миграция: добавляем selectedTeamIds для существующих турниров
    tournaments = savedTournaments.map(t => ({
      ...t,
      selectedTeamIds: t.selectedTeamIds || []
    }));
    // Сохраняем обновленные данные, если были изменения
    if (savedTournaments.some(t => !t.selectedTeamIds)) {
      fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
    }
  } catch (e) {
    console.error("Ошибка чтения tournaments.json", e);
  }
}

// ====== Загрузка команд ======
if (fs.existsSync(TEAMS_PATH)) {
  try {
    const savedTeams = JSON.parse(fs.readFileSync(TEAMS_PATH, 'utf8'));
    teams = savedTeams;
  } catch (e) {
    console.error("Ошибка чтения teams.json", e);
  }
}

function resolveWinnerTeamById(compositeId) {
  if (!compositeId) return null;
  const parts = String(compositeId).split('_');
  if (parts.length < 2) return null;

  const tournamentIdStr = parts[0];
  const teamIdRest = parts.slice(1).join('_');

  const tournament = tournaments.find(t => String(t.id) === tournamentIdStr);
  if (!tournament || !Array.isArray(tournament.teams)) return null;

  const team = tournament.teams.find(team => {
    const id = String(team.id);
    return (
      id === teamIdRest ||
      id.startsWith(teamIdRest + '_') ||
      teamIdRest.startsWith(id + '_')
    );
  });

  if (!team) return null;

  return {
    id: compositeId,
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    teamId: team.id,
    name: team.name,
    city: team.city || '',
    logo: team.logo || '',
    kitColor: team.kitColor || '',
    shortName: team.shortName || ''
  };
}

// ====== Таймер — тикает каждую секунду ======
setInterval(() => {
  if (state.timerRunning) {
    const now = Date.now();
    state.timerSeconds = state.timerStartTS
      ? Math.floor((now - state.timerStartTS) / 1000)
      : state.timerSeconds + 1;
    
    const mm = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
    const ss = (state.timerSeconds % 60).toString().padStart(2, '0');
    state.time = `${mm}:${ss}`;
    
    io.emit('scoreboardUpdate', enrichStateWithConfig(state));
  }
  
  // Сохраняем состояние
  fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
}, 1000);

// ====== Middleware ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ignore favicon requests to avoid 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// ====== Раздача статики ======
// Защита stadium.html в публичной папке
app.use('/public', (req, res, next) => {
  // Если запрос к stadium.html - проверяем токен
  if (req.path === '/stadium.html' || req.path === '/stadium.html/') {
    if (req.query.token !== getActualStadiumToken()) {
      return res.status(403).send('Forbidden');
    }
  }
  next();
});
app.use('/public', express.static(path.join(__dirname, '../public')));
// app.use('/private', express.static(path.join(__dirname, '../private'))); // Отключено для безопасности

// ====== Маршруты ======
app.get('/scoreboard_vmix.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'scoreboard_vmix.html'));
});

app.get('/prematch.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'prematch.html'));
});

app.get('/preloader.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'preloader.html'));
});

app.get('/break.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'break.html'));
});

app.get('/scoreboard.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'scoreboard.html'));
});

app.get('/penalti.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'penalti.html'));
});

app.get('/flag.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'flag.html'));
});

app.get('/logo.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'logo.html'));
});

app.get('/stadium.html', (req, res) => {
  if (req.query.token !== getActualStadiumToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../public', 'stadium.html'));
});

app.get('/members.html', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'members.html'));
});

app.get('/control', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'control.html'));
});

app.get('/settings', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '../private', 'settings.html'));
});

// Защита статических файлов в /private/
app.get('/private/*', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, '..', req.path));
});

// ====== API для предустановок ======
app.get('/api/presets', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  res.json(matchPresets);
});

// Функция для копирования логотипа команды в логотип пресета
// Если logoUrl это логотип команды (начинается с /public/logos/team_),
// создается независимая копия с префиксом preset_
function copyTeamLogoToPreset(logoUrl, presetId, teamNum) {
  if (!logoUrl || !logoUrl.trim()) return logoUrl;
  
  // Извлекаем имя файла из URL
  const filename = logoUrl.split('/').pop();
  
  // Проверяем, является ли это логотипом команды (начинается с team_)
  if (!filename || !filename.startsWith('team_')) {
    // Если это не логотип команды (например, уже скопированный preset_ или пусто),
    // возвращаем как есть
    return logoUrl;
  }
  
  try {
    // Создаем новое имя файла для пресета
    const extension = path.extname(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const newFilename = `preset_${presetId}_team${teamNum}_${timestamp}_${random}${extension}`;
    
    // Копируем файл
    const sourcePath = path.join(LOGOS_PATH, filename);
    const destPath = path.join(LOGOS_PATH, newFilename);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      const newUrl = `/public/logos/${newFilename}`;
      console.log(`Copied team logo to preset logo: ${sourcePath} -> ${destPath}`);
      return newUrl;
    } else {
      console.warn(`Source logo file not found: ${sourcePath}`);
      return logoUrl; // Возвращаем оригинал, если файл не найден
    }
  } catch (error) {
    console.error('Error copying team logo to preset:', error);
    return logoUrl; // Возвращаем оригинал при ошибке
  }
}

app.post('/api/presets', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  console.log('Creating new preset:', req.body);
  
  const presetId = Date.now().toString();
  
  // Копируем логотипы команд в независимые файлы пресета
  const team1LogoUrl = copyTeamLogoToPreset(req.body.team1Logo || '', presetId, 1);
  const team2LogoUrl = copyTeamLogoToPreset(req.body.team2Logo || '', presetId, 2);
  
  const newPreset = {
    id: presetId,
    name: req.body.name,
    tournamentId: req.body.tournamentId || null,
    // Новое поле: дата матча (день), строка в формате YYYY-MM-DD
    matchDate: req.body.matchDate || null,
    team1Id: req.body.team1Id || null,
    team2Id: req.body.team2Id || null,
    team1Name: req.body.team1Name,
    team1City: req.body.team1City,
    team1Short: req.body.team1Short,
    team2Name: req.body.team2Name,
    team2City: req.body.team2City,
    team2Short: req.body.team2Short,
    kit1Color: req.body.kit1Color,
    kit2Color: req.body.kit2Color,
    team1Logo: team1LogoUrl,
    team2Logo: team2LogoUrl
  };
  
  matchPresets.push(newPreset);
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  
  console.log('Preset saved successfully:', newPreset.id);
  res.json(newPreset);
});

app.put('/api/presets/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const presetId = req.params.id;
  const presetIndex = matchPresets.findIndex(p => p.id === presetId);
  
  if (presetIndex === -1) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  
  console.log('Updating preset:', presetId, req.body);
  
  const oldPreset = matchPresets[presetIndex];
  const newTeam1Logo = req.body.team1Logo || '';
  const newTeam2Logo = req.body.team2Logo || '';
  
  // Логика работы с логотипами пресетов:
  // 1. Если новый логотип уже является preset_ логотипом - сохраняем его как есть (не трогаем)
  // 2. Если новый логотип - это логотип команды (team_) или изменился - создаем новый preset_ логотип
  // 3. Если логотип не изменился - сохраняем существующий preset_ логотип
  // 4. Старый preset_ логотип удаляется только если создается новый для того же пресета
  
  let finalTeam1Logo = newTeam1Logo;
  const newTeam1LogoFilename = newTeam1Logo ? newTeam1Logo.split('/').pop() : '';
  
  // Если новый логотип уже является preset_ логотипом - сохраняем его без изменений
  if (newTeam1LogoFilename && newTeam1LogoFilename.startsWith('preset_')) {
    finalTeam1Logo = newTeam1Logo;
    console.log('Keeping existing preset logo:', newTeam1Logo);
  } else if (newTeam1Logo !== oldPreset.team1Logo && newTeam1Logo) {
    // Логотип изменился и это не preset_ логотип - создаем новый preset_ логотип
    // Удаляем старый preset_ логотип только если он был
    if (oldPreset.team1Logo) {
      const oldFilename = oldPreset.team1Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo (replaced with new):', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
    // Создаем новый preset_ логотип из логотипа команды
    finalTeam1Logo = copyTeamLogoToPreset(newTeam1Logo, presetId, 1);
  } else if (!newTeam1Logo) {
    // Новый логотип пустой - удаляем старый preset_ логотип
    if (oldPreset.team1Logo) {
      const oldFilename = oldPreset.team1Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo (cleared):', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
  } else {
    // Логотип не изменился - сохраняем существующий preset_ логотип
    finalTeam1Logo = oldPreset.team1Logo;
  }
  
  let finalTeam2Logo = newTeam2Logo;
  const newTeam2LogoFilename = newTeam2Logo ? newTeam2Logo.split('/').pop() : '';
  
  // Если новый логотип уже является preset_ логотипом - сохраняем его без изменений
  if (newTeam2LogoFilename && newTeam2LogoFilename.startsWith('preset_')) {
    finalTeam2Logo = newTeam2Logo;
    console.log('Keeping existing preset logo:', newTeam2Logo);
  } else if (newTeam2Logo !== oldPreset.team2Logo && newTeam2Logo) {
    // Логотип изменился и это не preset_ логотип - создаем новый preset_ логотип
    // Удаляем старый preset_ логотип только если он был
    if (oldPreset.team2Logo) {
      const oldFilename = oldPreset.team2Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo (replaced with new):', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
    // Создаем новый preset_ логотип из логотипа команды
    finalTeam2Logo = copyTeamLogoToPreset(newTeam2Logo, presetId, 2);
  } else if (!newTeam2Logo) {
    // Новый логотип пустой - удаляем старый preset_ логотип
    if (oldPreset.team2Logo) {
      const oldFilename = oldPreset.team2Logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('preset_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old preset logo (cleared):', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old preset logo:', error);
          }
        }
      }
    }
  } else {
    // Логотип не изменился - сохраняем существующий preset_ логотип
    finalTeam2Logo = oldPreset.team2Logo;
  }
  
  // Обновляем предустановку
  matchPresets[presetIndex] = {
    ...matchPresets[presetIndex],
    name: req.body.name,
    matchDate: req.body.matchDate !== undefined ? req.body.matchDate : matchPresets[presetIndex].matchDate || null,
    tournamentId: req.body.tournamentId !== undefined ? req.body.tournamentId : matchPresets[presetIndex].tournamentId,
    team1Id: req.body.team1Id !== undefined ? req.body.team1Id : matchPresets[presetIndex].team1Id,
    team2Id: req.body.team2Id !== undefined ? req.body.team2Id : matchPresets[presetIndex].team2Id,
    team1Name: req.body.team1Name,
    team1City: req.body.team1City,
    team1Short: req.body.team1Short,
    team2Name: req.body.team2Name,
    team2City: req.body.team2City,
    team2Short: req.body.team2Short,
    kit1Color: req.body.kit1Color,
    kit2Color: req.body.kit2Color,
    team1Logo: finalTeam1Logo,
    team2Logo: finalTeam2Logo
  };
  
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  
  console.log('Preset updated successfully:', presetId);
  res.json(matchPresets[presetIndex]);
});

app.delete('/api/presets/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  // Находим пресет для удаления логотипов
  const presetToDelete = matchPresets.find(p => p.id === req.params.id);
  
  // Функция проверки использования логотипа в активной секции
  function isLogoInUse(logoUrl) {
    if (!logoUrl) return false;
    return (state.team1Logo === logoUrl || state.team2Logo === logoUrl);
  }
  
  // Удаляем только логотипы пресетов (начинающиеся с preset_), НЕ удаляем логотипы команд (team_)
  if (presetToDelete) {
    // Обрабатываем team1Logo
    if (presetToDelete.team1Logo) {
      const filename = presetToDelete.team1Logo.split('/').pop();
      // Удаляем ТОЛЬКО если это логотип пресета (начинается с preset_)
      // Логотипы команд (team_) НИКОГДА не удаляются при удалении пресета
      if (filename && filename.startsWith('preset_')) {
        if (!isLogoInUse(presetToDelete.team1Logo)) {
          const logoPath = path.join(LOGOS_PATH, filename);
          if (fs.existsSync(logoPath)) {
            try {
              fs.unlinkSync(logoPath);
              console.log('Deleted preset team1 logo:', logoPath);
            } catch (error) {
              console.error('Error deleting preset logo:', error);
            }
          }
        } else {
          console.log('Protected preset team1 logo from deletion (in use in scoreboard):', presetToDelete.team1Logo);
        }
      } else {
        console.log('Skipped deletion of team logo (team logo, not preset logo):', presetToDelete.team1Logo);
      }
    }
    
    // Обрабатываем team2Logo
    if (presetToDelete.team2Logo) {
      const filename = presetToDelete.team2Logo.split('/').pop();
      // Удаляем ТОЛЬКО если это логотип пресета (начинается с preset_)
      // Логотипы команд (team_) НИКОГДА не удаляются при удалении пресета
      if (filename && filename.startsWith('preset_')) {
        if (!isLogoInUse(presetToDelete.team2Logo)) {
          const logoPath = path.join(LOGOS_PATH, filename);
          if (fs.existsSync(logoPath)) {
            try {
              fs.unlinkSync(logoPath);
              console.log('Deleted preset team2 logo:', logoPath);
            } catch (error) {
              console.error('Error deleting preset logo:', error);
            }
          }
        } else {
          console.log('Protected preset team2 logo from deletion (in use in scoreboard):', presetToDelete.team2Logo);
        }
      } else {
        console.log('Skipped deletion of team logo (team logo, not preset logo):', presetToDelete.team2Logo);
      }
    }
  }
  
  matchPresets = matchPresets.filter(p => p.id !== req.params.id);
  fs.writeFileSync(PRESETS_PATH, JSON.stringify(matchPresets, null, 2));
  res.json({ success: true });
});

// ====== API для логотипов ======
// Загрузка логотипа для команды
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  
  const logoUrl = `/public/logos/${req.file.filename}`;
  res.json({ 
    success: true, 
    filename: req.file.filename,
    url: logoUrl 
  });
});

// Удаление логотипа
app.delete('/api/logo/:filename', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const filename = req.params.filename;
  const filePath = path.join(LOGOS_PATH, filename);
  const logoUrl = `/public/logos/${filename}`;
  
  // КРИТИЧНО: Защищаем логотипы команд (team_) от удаления
  // Логотипы команд удаляются ТОЛЬКО при удалении записи команды из турнира
  if (filename && filename.startsWith('team_')) {
    return res.status(403).json({ 
      error: 'Логотип команды не может быть удален через этот API. Удалите запись команды из турнира.',
      protected: true 
    });
  }
  
  // Проверяем, используется ли логотип в активной секции (для main_ и preset_ логотипов)
  const isInUse = (state.team1Logo === logoUrl || state.team2Logo === logoUrl);
  
  if (isInUse) {
    return res.status(403).json({ 
      error: 'Логотип используется в активной секции и не может быть удален',
      protected: true 
    });
  }
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Deleted logo file:', filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Файл не найден' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// Копирование логотипа
app.post('/api/copy-logo', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const { sourceUrl, newFilename } = req.body;
  
  if (!sourceUrl || !newFilename) {
    return res.status(400).json({ error: 'Не указаны sourceUrl и newFilename' });
  }
  
  try {
    // Извлекаем имя файла из URL
    const sourceFilename = sourceUrl.split('/').pop();
    const sourcePath = path.join(LOGOS_PATH, sourceFilename);
    const destPath = path.join(LOGOS_PATH, newFilename);
    
    // Проверяем существование исходного файла
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Исходный файл не найден' });
    }
    
    // Копируем файл
    fs.copyFileSync(sourcePath, destPath);
    
    const newUrl = `/public/logos/${newFilename}`;
    console.log('Copied logo:', sourcePath, '->', destPath);
    
    res.json({ 
      success: true, 
      url: newUrl,
      filename: newFilename 
    });
    
  } catch (error) {
    console.error('Ошибка копирования логотипа:', error);
    res.status(500).json({ error: 'Ошибка копирования файла' });
  }
});

// ====== API для турниров ======
// Получить все турниры
app.get('/api/tournaments', (req, res) => {
  // Разрешаем доступ с токеном управления ИЛИ токеном стадиона
  const token = req.query.token;
  const actualToken = getActualToken();
  const actualStadiumToken = getActualStadiumToken();
  
  if (token !== actualToken && token !== actualStadiumToken) {
    return res.status(403).send('Forbidden');
  }
  
  res.json(tournaments);
});

// Создать турнир
app.post('/api/tournaments', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const newTournament = {
    id: Date.now().toString(),
    name: req.body.name,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null,
    teams: [],
    selectedTeamIds: []
  };
  
  tournaments.push(newTournament);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament created:', newTournament.id);
  res.json(newTournament);
});

// Обновить турнир
app.put('/api/tournaments/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
  
  if (tournamentIndex === -1) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  tournaments[tournamentIndex] = {
    ...tournaments[tournamentIndex],
    name: req.body.name,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null,
    selectedTeamIds: req.body.selectedTeamIds !== undefined ? req.body.selectedTeamIds : tournaments[tournamentIndex].selectedTeamIds || []
  };
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament updated:', tournamentId);
  res.json(tournaments[tournamentIndex]);
});

// Обновить выбранные команды турнира
app.put('/api/tournaments/:id/selectedTeams', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
  
  if (tournamentIndex === -1) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  const selectedTeamIds = req.body.selectedTeamIds || [];
  
  tournaments[tournamentIndex] = {
    ...tournaments[tournamentIndex],
    selectedTeamIds: selectedTeamIds
  };
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament selected teams updated:', tournamentId, selectedTeamIds);
  res.json({ success: true, selectedTeamIds: selectedTeamIds });
});

// Удалить турнир
app.delete('/api/tournaments/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  // Удаляем логотипы команд турнира (ТОЛЬКО логотипы команд team_, не пресетов preset_)
  if (tournament.teams) {
    tournament.teams.forEach(team => {
      if (team.logo) {
        const filename = team.logo.split('/').pop();
        // Удаляем ТОЛЬКО если это логотип команды (начинается с team_)
        // Логотипы пресетов (preset_) НИКОГДА не удаляются при удалении турнира
        if (filename && filename.startsWith('team_')) {
          const logoPath = path.join(LOGOS_PATH, filename);
          if (fs.existsSync(logoPath)) {
            try {
              fs.unlinkSync(logoPath);
              console.log('Deleted team logo:', logoPath);
            } catch (error) {
              console.error('Error deleting team logo:', error);
            }
          }
        } else {
          console.log('Skipped deletion (preset logo, not team logo):', team.logo);
        }
      }
    });
  }
  
  tournaments = tournaments.filter(t => t.id !== tournamentId);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Tournament deleted:', tournamentId);
  res.json({ success: true });
});

// ====== API для команд турнира ======
// Добавить команду в турнир
app.post('/api/tournaments/:id/teams', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  if (!tournament.teams) {
    tournament.teams = [];
  }
  
  const sanitizePlayers = (players) => {
    if (!Array.isArray(players)) return [];
    return players
      .map(p => ({
        name: typeof p?.name === 'string' ? p.name.trim() : '',
        number: p?.number !== undefined && p?.number !== null ? String(p.number).trim() : ''
      }))
      .filter(p => p.name);
  };

  const sanitizeStaff = (staff) => {
    if (!Array.isArray(staff)) return [];
    return staff
      .map(s => ({
        name: typeof s?.name === 'string' ? s.name.trim() : ''
      }))
      .filter(s => s.name);
  };

  const sanitizeBirthYear = (value) => {
    const str = value === undefined || value === null ? '' : String(value).trim();
    return /^\d{4}$/.test(str) ? str : '';
  };

  const newTeam = {
    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    birthYear: sanitizeBirthYear(req.body.birthYear),
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: req.body.logo || '',
    players: sanitizePlayers(req.body.players),
    staff: sanitizeStaff(req.body.staff)
  };
  
  tournament.teams.push(newTeam);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team added to tournament:', tournamentId, newTeam.id);
  res.json(newTeam);
});

// Обновить команду в турнире
app.put('/api/tournaments/:id/teams/:teamId', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const teamId = req.params.teamId;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament || !tournament.teams) {
    return res.status(404).json({ error: 'Tournament or team not found' });
  }
  
  const teamIndex = tournament.teams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // КРИТИЧНО: Логотип команды НЕ должен изменяться при сохранении пресетов или применении пресетов
  // Логотип изменяется ТОЛЬКО при редактировании записи команды в турнире (когда передается новый файл)
  // Если logo передан явно (даже если это тот же URL) - используем его (это означает редактирование команды)
  // Если logo не передан (undefined) - сохраняем существующий (это защита от случайного изменения)
  const existingLogo = tournament.teams[teamIndex].logo || '';
  const newLogo = (req.body.logo !== undefined && req.body.logo !== null) ? req.body.logo : existingLogo;
  const existingBirthYear = tournament.teams[teamIndex].birthYear || '';

  const sanitizeBirthYear = (value) => {
    const str = value === undefined || value === null ? '' : String(value).trim();
    return /^\d{4}$/.test(str) ? str : '';
  };

  const newBirthYear = (req.body.birthYear !== undefined) ? sanitizeBirthYear(req.body.birthYear) : existingBirthYear;

  const sanitizePlayers = (players) => {
    if (!Array.isArray(players)) return tournament.teams[teamIndex].players || [];
    return players
      .map(p => ({
        name: typeof p?.name === 'string' ? p.name.trim() : '',
        number: p?.number !== undefined && p?.number !== null ? String(p.number).trim() : ''
      }))
      .filter(p => p.name);
  };

  const sanitizeStaff = (staff) => {
    if (!Array.isArray(staff)) return tournament.teams[teamIndex].staff || [];
    return staff
      .map(s => ({
        name: typeof s?.name === 'string' ? s.name.trim() : ''
      }))
      .filter(s => s.name);
  };
  
  tournament.teams[teamIndex] = {
    ...tournament.teams[teamIndex],
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    birthYear: newBirthYear,
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: newLogo, // Всегда используем newLogo, который уже содержит существующий если новый пустой
    players: sanitizePlayers(req.body.players),
    staff: sanitizeStaff(req.body.staff)
  };
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team updated:', tournamentId, teamId);
  res.json(tournament.teams[teamIndex]);
});

// Удалить команду из турнира
app.delete('/api/tournaments/:id/teams/:teamId', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const teamId = req.params.teamId;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament || !tournament.teams) {
    return res.status(404).json({ error: 'Tournament or team not found' });
  }
  
  const team = tournament.teams.find(t => t.id === teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Удаляем логотип команды если есть (ТОЛЬКО логотипы команд team_, не пресетов preset_)
  if (team.logo) {
    const filename = team.logo.split('/').pop();
    // Удаляем ТОЛЬКО если это логотип команды (начинается с team_)
    // Логотипы пресетов (preset_) НИКОГДА не удаляются при удалении команды
    if (filename && filename.startsWith('team_')) {
      const logoPath = path.join(LOGOS_PATH, filename);
      if (fs.existsSync(logoPath)) {
        try {
          fs.unlinkSync(logoPath);
          console.log('Deleted team logo:', logoPath);
        } catch (error) {
          console.error('Error deleting team logo:', error);
        }
      }
    } else {
      console.log('Skipped deletion (preset logo, not team logo):', team.logo);
    }
  }
  
  tournament.teams = tournament.teams.filter(t => t.id !== teamId);
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Team deleted:', tournamentId, teamId);
  res.json({ success: true });
});

// Изменить порядок команд в турнире
app.post('/api/tournaments/:id/teams/reorder', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const tournamentId = req.params.id;
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!tournament || !tournament.teams) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  const { teamIds } = req.body;
  
  if (!Array.isArray(teamIds)) {
    return res.status(400).json({ error: 'teamIds must be an array' });
  }
  
  // Проверяем что все ID команд принадлежат этому турниру
  const tournamentTeamIds = tournament.teams.map(t => t.id);
  const allValid = teamIds.every(id => tournamentTeamIds.includes(id));
  
  if (!allValid || teamIds.length !== tournamentTeamIds.length) {
    return res.status(400).json({ error: 'Invalid team IDs or count mismatch' });
  }
  
  // Переупорядочиваем команды согласно новому порядку
  const reorderedTeams = teamIds.map(id => tournament.teams.find(t => t.id === id));
  tournament.teams = reorderedTeams;
  
  fs.writeFileSync(TOURNAMENTS_PATH, JSON.stringify(tournaments, null, 2));
  
  console.log('Teams reordered:', tournamentId);
  res.json({ success: true });
});

// ====== API для команд (база команд) ======
// Получить все команды
app.get('/api/teams', (req, res) => {
  // Разрешаем доступ с токеном управления ИЛИ токеном стадиона
  const token = req.query.token;
  const actualToken = getActualToken();
  const actualStadiumToken = getActualStadiumToken();
  
  if (token !== actualToken && token !== actualStadiumToken) {
    return res.status(403).send('Forbidden');
  }
  
  res.json(teams);
});

// Создать команду
app.post('/api/teams', upload.single('logo'), (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const sanitizePlayers = (players) => {
    if (!Array.isArray(players)) return [];
    return players
      .map(p => ({
        name: typeof p?.name === 'string' ? p.name.trim() : '',
        number: p?.number !== undefined && p?.number !== null ? String(p.number).trim() : ''
      }))
      .filter(p => p.name);
  };

  const sanitizeStaff = (staff) => {
    if (!Array.isArray(staff)) return [];
    return staff
      .map(s => ({
        name: typeof s?.name === 'string' ? s.name.trim() : ''
      }))
      .filter(s => s.name);
  };

  const sanitizeBirthYear = (value) => {
    const str = value === undefined || value === null ? '' : String(value).trim();
    return /^\d{4}$/.test(str) ? str : '';
  };

  // Обработка логотипа
  let logoUrl = '';
  if (req.file) {
    logoUrl = `/public/logos/${req.file.filename}`;
  } else if (req.body.logo) {
    logoUrl = req.body.logo;
  }

  const newTeam = {
    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    birthYear: sanitizeBirthYear(req.body.birthYear),
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: logoUrl,
    players: sanitizePlayers(req.body.players ? JSON.parse(req.body.players) : []),
    staff: sanitizeStaff(req.body.staff ? JSON.parse(req.body.staff) : []),
    useAltNumbers: false // По умолчанию выключено
  };
  
  teams.push(newTeam);
  fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2));
  
  console.log('Team created:', newTeam.id);
  res.json(newTeam);
});

// Обновить команду
app.put('/api/teams/:id', upload.single('logo'), (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const teamId = req.params.id;
  const teamIndex = teams.findIndex(t => t.id === teamId);
  
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  const existingTeam = teams[teamIndex];
  
  // Обработка логотипа
  let logoUrl = existingTeam.logo || '';
  if (req.file) {
    // Новый файл загружен - удаляем старый если это был team_ логотип
    if (existingTeam.logo) {
      const oldFilename = existingTeam.logo.split('/').pop();
      if (oldFilename && oldFilename.startsWith('team_')) {
        const oldLogoPath = path.join(LOGOS_PATH, oldFilename);
        if (fs.existsSync(oldLogoPath)) {
          try {
            fs.unlinkSync(oldLogoPath);
            console.log('Deleted old team logo:', oldLogoPath);
          } catch (error) {
            console.error('Error deleting old team logo:', error);
          }
        }
      }
    }
    logoUrl = `/public/logos/${req.file.filename}`;
  } else if (req.body.logo !== undefined) {
    logoUrl = req.body.logo || '';
  }

  const sanitizePlayers = (players) => {
    if (!Array.isArray(players)) return existingTeam.players || [];
    return players
      .map(p => ({
        name: typeof p?.name === 'string' ? p.name.trim() : '',
        number: p?.number !== undefined && p?.number !== null ? String(p.number).trim() : ''
      }))
      .filter(p => p.name);
  };

  const sanitizeStaff = (staff) => {
    if (!Array.isArray(staff)) return existingTeam.staff || [];
    return staff
      .map(s => ({
        name: typeof s?.name === 'string' ? s.name.trim() : ''
      }))
      .filter(s => s.name);
  };

  const sanitizeBirthYear = (value) => {
    const str = value === undefined || value === null ? '' : String(value).trim();
    return /^\d{4}$/.test(str) ? str : '';
  };
  
  // Обработка useAltNumbers (состояние галочки альтернативных номеров)
  let useAltNumbers = existingTeam.useAltNumbers || false;
  if (req.body.useAltNumbers !== undefined) {
    useAltNumbers = req.body.useAltNumbers === true || req.body.useAltNumbers === 'true';
  }
  
  teams[teamIndex] = {
    ...existingTeam,
    name: req.body.name,
    city: req.body.city || '',
    short: req.body.short || '',
    birthYear: sanitizeBirthYear(req.body.birthYear),
    kitColor: req.body.kitColor || '#2b2b2b',
    logo: logoUrl,
    players: sanitizePlayers(req.body.players ? JSON.parse(req.body.players) : existingTeam.players),
    staff: sanitizeStaff(req.body.staff ? JSON.parse(req.body.staff) : existingTeam.staff),
    useAltNumbers: useAltNumbers
  };
  
  fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2));
  
  console.log('Team updated:', teamId);
  res.json(teams[teamIndex]);
});

// Обновить только состояние альтернативных номеров команды
app.put('/api/teams/:id/useAltNumbers', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const teamId = req.params.id;
  const teamIndex = teams.findIndex(t => t.id === teamId);
  
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  const useAltNumbers = req.body.useAltNumbers === true || req.body.useAltNumbers === 'true';
  teams[teamIndex].useAltNumbers = useAltNumbers;
  
  fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2));
  
  // Отправляем событие всем подключенным клиентам для синхронизации
  io.emit('teamUseAltNumbersUpdated', {
    teamId: teamId,
    useAltNumbers: useAltNumbers
  });
  
  console.log('Team useAltNumbers updated:', teamId, useAltNumbers);
  res.json({ success: true, useAltNumbers: useAltNumbers });
});

// Удалить команду
app.delete('/api/teams/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const teamId = req.params.id;
  const team = teams.find(t => t.id === teamId);
  
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Удаляем логотип команды если есть (ТОЛЬКО логотипы команд team_, не пресетов preset_)
  if (team.logo) {
    const filename = team.logo.split('/').pop();
    if (filename && filename.startsWith('team_')) {
      const logoPath = path.join(LOGOS_PATH, filename);
      if (fs.existsSync(logoPath)) {
        try {
          fs.unlinkSync(logoPath);
          console.log('Deleted team logo:', logoPath);
        } catch (error) {
          console.error('Error deleting team logo:', error);
        }
      }
    }
  }
  
  teams = teams.filter(t => t.id !== teamId);
  fs.writeFileSync(TEAMS_PATH, JSON.stringify(teams, null, 2));
  
  console.log('Team deleted:', teamId);
  res.json({ success: true });
});

// ====== WebSocket ======
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Отправляем текущее состояние при подключении
  socket.emit('scoreboardUpdate', enrichStateWithConfig(state));
  socket.emit('stadiumModeChange', { mode: stadiumModeState });
  
  // Обработчик запроса текущего состояния
  socket.on('getCurrentState', () => {
    socket.emit('currentState', enrichStateWithConfig(state));
  });

  // Изменение состояния с панели управления
  socket.on('updateScoreboard', (newState) => {
    // Управление таймером
    if ('timerRunning' in newState) {
      if (newState.timerRunning && !state.timerRunning) {
        state.timerStartTS = Date.now() - (state.timerSeconds * 1000);
        state.timerRunning = true;
      } else if (!newState.timerRunning && state.timerRunning) {
        state.timerSeconds = Math.floor((Date.now() - state.timerStartTS) / 1000);
        state.timerRunning = false;
        state.timerStartTS = null;
      }
    }

    // Прямое изменение секунд
    if (typeof newState.timerSeconds === 'number') {
      state.timerSeconds = newState.timerSeconds;
      if (state.timerRunning) {
        state.timerStartTS = Date.now() - (state.timerSeconds * 1000);
      }
    }

    // Остальные параметры
    const keys = [
      'score1', 'score2', 'team1', 'team2',
      'team1Short', 'team2Short', 'kit1Color', 'kit2Color',
      'team1Name', 'team2Name', 'team1City', 'team2City',
      'team1Logo', 'team2Logo',
      'team1Id', 'team2Id',
      'team1Players', 'team1Staff', 'team2Players', 'team2Staff',
      'penaltyActive', 'penaltyMode', 'penaltyMaxAttempts', 'penaltySeries'
    ];
    keys.forEach(k => {
      if (k in newState) state[k] = newState[k];
    });

    // Пересчитываем строку времени
    const mm = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
    const ss = (state.timerSeconds % 60).toString().padStart(2, '0');
    state.time = `${mm}:${ss}`;

    io.emit('scoreboardUpdate', enrichStateWithConfig(state));
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
  });

  // Применение предустановки
  socket.on('applyPreset', (data) => {
    const preset = matchPresets.find(p => p.id === data.presetId);
    
    if (!preset) {
      console.error('Preset not found');
      return;
    }

    // Применяем данные из предустановки
    state.team1Name = preset.team1Name;
    state.team1City = preset.team1City;
    state.team1Short = preset.team1Short;
    state.team2Name = preset.team2Name;
    state.team2City = preset.team2City;
    state.team2Short = preset.team2Short;
    state.kit1Color = preset.kit1Color;
    state.kit2Color = preset.kit2Color;
    
    // Сбрасываем счет и таймер
    state.score1 = 0;
    state.score2 = 0;
    state.timerSeconds = 0;
    state.timerRunning = false;
    state.timerStartTS = null;
    state.time = "00:00";
    state.penaltyActive = false;
    state.penaltyMode = "adult";
    state.penaltyMaxAttempts = 5;
    state.penaltySeries = null;

    io.emit('scoreboardUpdate', enrichStateWithConfig(state));
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
  });

  // Сброс табло
  socket.on('resetScoreboard', () => {
    state = {
      timerRunning: false,
      timerSeconds: 0,
      timerStartTS: null,
      time: "00:00",
      score1: 0,
      score2: 0,
      team1: "Хозяева",
      team2: "Гости",
      team1Short: "ХОЗ",
      team2Short: "ГОС",
      kit1Color: "#2b2b2b",
      kit2Color: "#2b2b2b",
      team1Name: "",
      team2Name: "",
      team1City: "",
      team2City: "",
      penaltyActive: false,
      penaltyMode: "adult",
      penaltyMaxAttempts: 5,
      penaltySeries: null
    };

    io.emit('scoreboardUpdate', enrichStateWithConfig(state));
    fs.writeFileSync(SAVE_PATH, JSON.stringify(state));
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Панель управления: http://localhost:${PORT}/control?token=${getActualToken()}`);
  console.log(`Табло vMix: http://localhost:${PORT}/scoreboard_vmix.html`);
  console.log(`Табло: http://localhost:${PORT}/scoreboard.html`);
  console.log(`Пенальти: http://localhost:${PORT}/penalti.html`);
  console.log(`Prematch: http://localhost:${PORT}/prematch.html`);
  console.log(`Break: http://localhost:${PORT}/break.html`);
  console.log(`Preloader: http://localhost:${PORT}/preloader.html`);
  console.log(`Flag: http://localhost:${PORT}/flag.html`);
  console.log(`Logo: http://localhost:${PORT}/logo.html`);
  console.log(`Stadium: http://localhost:${PORT}/stadium.html?token=${getActualStadiumToken()}`);
  console.log(`Members: http://localhost:${PORT}/members.html`);
});

// ====== Custom Styles Functions ======
// Load custom styles
function loadCustomStyles() {
  if (fs.existsSync(CUSTOM_STYLES_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CUSTOM_STYLES_PATH, 'utf8'));
    } catch (error) {
      console.error('Error loading custom styles:', error);
      return {};
    }
  }
  return {};
}

// Save custom styles
function saveCustomStyles(styles) {
  fs.writeFileSync(CUSTOM_STYLES_PATH, JSON.stringify(styles, null, 2));
}

// ====== API для конфигурации (токены) ======
app.get('/api/config', (req, res) => {
  // Разрешаем доступ с токеном управления ИЛИ токеном стадиона
  const token = req.query.token;
  const actualToken = getActualToken();
  const actualStadiumToken = getActualStadiumToken();
  
  // Загружаем полную конфигурацию
  let config = { token: actualToken, stadiumToken: actualStadiumToken };
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      config = { ...config, ...savedConfig };
    } catch (error) {
      console.error('Ошибка загрузки конфигурации:', error);
    }
  }

  // Если токен не предоставлен или неверный, возвращаем только публичные данные
  if (token !== actualToken && token !== actualStadiumToken) {
    // Возвращаем только публичные данные (graphicStyle) без токенов и других секретных данных
    const publicConfig = {
      graphicStyle: config.graphicStyle || 'default'
    };
    
    // Если это custom стиль, загружаем данные стиля
    if (publicConfig.graphicStyle && publicConfig.graphicStyle.startsWith('custom:')) {
      const styleId = publicConfig.graphicStyle.replace('custom:', '');
      const customStyles = loadCustomStyles();
      if (customStyles[styleId]) {
        publicConfig.customStyleData = customStyles[styleId];
      }
    }
    
    return res.json(publicConfig);
  }

  if (config.winners && !config.winnersResolved) {
    const resolved = {
      winner1: resolveWinnerTeamById(config.winners.winner1),
      winner2: resolveWinnerTeamById(config.winners.winner2),
      winner3: resolveWinnerTeamById(config.winners.winner3)
    };

    if (resolved.winner1 || resolved.winner2 || resolved.winner3) {
      config.winnersResolved = resolved;
    }
  }
  
  res.json(config);
});

app.put('/api/config', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  // Загружаем текущую конфигурацию
  let currentConfig = { token: TOKEN, stadiumToken: STADIUM_TOKEN };
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      currentConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      console.error('Ошибка загрузки конфигурации:', error);
    }
  }
  
  // Обновляем только переданные значения, сохраняя остальные
  if (req.body.token !== undefined) {
    currentConfig.token = req.body.token;
  }
  if (req.body.stadiumToken !== undefined) {
    currentConfig.stadiumToken = req.body.stadiumToken;
  }
  if (req.body.stadiumMode !== undefined) {
    currentConfig.stadiumMode = req.body.stadiumMode;
    stadiumModeState = currentConfig.stadiumMode || 'scoreboard';
    // Отправляем событие всем подключенным клиентам stadium.html
    io.emit('stadiumModeChange', { mode: req.body.stadiumMode });
  }
  if (req.body.winners !== undefined) {
    // Сохраняем победителей независимо от режима
    currentConfig.winners = req.body.winners;
    if (req.body.winnersResolved !== undefined) {
      currentConfig.winnersResolved = req.body.winnersResolved;
    }
    // Отправляем событие всем подключенным клиентам stadium.html
    io.emit('stadiumWinnersChange', { 
      winners: req.body.winners,
      winnersTitle: req.body.winnersTitle !== undefined ? req.body.winnersTitle : currentConfig.winnersTitle,
      winnersResolved: currentConfig.winnersResolved || null
    });
  }
  if (req.body.winnersTitle !== undefined) {
    // Сохраняем название победителей независимо от режима
    currentConfig.winnersTitle = req.body.winnersTitle;
    // Отправляем событие всем подключенным клиентам stadium.html
    io.emit('stadiumWinnersChange', { 
      winners: currentConfig.winners || {},
      winnersTitle: req.body.winnersTitle,
      winnersResolved: currentConfig.winnersResolved || null
    });
  }
  if (req.body.tournamentTitle !== undefined) {
    // Сохраняем название турнира
    currentConfig.tournamentTitle = req.body.tournamentTitle;
    // Отправляем событие всем подключенным клиентам для обновления названия
    // Важно: отправляем полный state с обновленным tournamentTitle, чтобы не потерять остальные данные
    io.emit('scoreboardUpdate', enrichStateWithConfig(state));
  }
  if (req.body.graphicStyle !== undefined) {
    // Сохраняем стиль графического оформления
    currentConfig.graphicStyle = req.body.graphicStyle;
    
    // Если это custom стиль, загружаем данные стиля
    let customStyleData = null;
    if (req.body.graphicStyle && req.body.graphicStyle.startsWith('custom:')) {
      const styleId = req.body.graphicStyle.replace('custom:', '');
      const customStyles = loadCustomStyles();
      if (customStyles[styleId]) {
        customStyleData = customStyles[styleId];
      }
    }
    
    // Отправляем событие всем подключенным клиентам для обновления стиля
    io.emit('configUpdate', { 
      graphicStyle: req.body.graphicStyle,
      customStyleData: customStyleData
    });
  }
  // Важно: не перезаписываем winners и stadiumMode, если они не переданы
  
  // Сохраняем конфигурацию
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2));
  
  console.log('Config updated:', { 
    token: req.body.token !== undefined ? '***changed***' : 'unchanged', 
    stadiumToken: req.body.stadiumToken !== undefined ? '***changed***' : 'unchanged',
    stadiumMode: req.body.stadiumMode !== undefined ? req.body.stadiumMode : (currentConfig.stadiumMode || 'scoreboard'),
    winners: req.body.winners !== undefined ? '***changed***' : (currentConfig.winners ? 'preserved' : 'none'),
    graphicStyle: req.body.graphicStyle !== undefined ? req.body.graphicStyle : (currentConfig.graphicStyle || 'default')
  });
  res.json({ success: true, ...currentConfig });
});

// ====== Custom Styles API ======
// Multer для загрузки custom стилей
const customStylesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, CUSTOM_STYLES_DIR);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    let extension = '.png';
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      extension = '.jpg';
    } else if (file.mimetype === 'image/png') {
      extension = '.png';
    } else if (file.mimetype === 'image/gif') {
      extension = '.gif';
    } else if (file.mimetype === 'image/webp') {
      extension = '.webp';
    } else {
      const originalExt = path.extname(file.originalname).toLowerCase();
      if (originalExt && /\.(jpg|jpeg|png|gif|webp)$/i.test(originalExt)) {
        extension = originalExt;
      }
    }
    cb(null, `custom_${timestamp}_${random}${extension}`);
  }
});

const uploadCustomStyle = multer({ storage: customStylesStorage });

// GET /api/custom-styles - Get all custom styles
app.get('/api/custom-styles', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const styles = loadCustomStyles();
  res.json(styles);
});

// POST /api/custom-styles - Create custom style
app.post('/api/custom-styles', uploadCustomStyle.fields([
  { name: 'stripeSingle', maxCount: 1 },
  { name: 'breakStripe', maxCount: 1 },
  { name: 'prematchStripe', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]), (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const name = req.body.name;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const stripeMode = req.body.stripeMode || 'single';
  
  // Check if we have at least one element (logo or stripe)
  const hasStripe = stripeMode === 'single'
    ? (req.files && req.files.stripeSingle)
    : (req.files && (req.files.breakStripe || req.files.prematchStripe));
  const hasLogo = req.files && req.files.logo;
  
  if (!hasStripe && !hasLogo) {
    return res.status(400).json({ error: 'At least one element (logo or stripe) is required' });
  }
  
  const styles = loadCustomStyles();
  const styleId = Date.now().toString();
  
  const style = {
    name: name.trim(),
    stripeMode: stripeMode
  };
  
  if (stripeMode === 'single') {
    if (req.files.stripeSingle) {
      style.breakStripe = `/public/img/custom-styles/${req.files.stripeSingle[0].filename}`;
      style.prematchStripe = `/public/img/custom-styles/${req.files.stripeSingle[0].filename}`;
    }
  } else {
    style.breakStripe = req.files.breakStripe ? `/public/img/custom-styles/${req.files.breakStripe[0].filename}` : null;
    style.prematchStripe = req.files.prematchStripe ? `/public/img/custom-styles/${req.files.prematchStripe[0].filename}` : null;
  }
  
  style.logo = req.files.logo ? `/public/img/custom-styles/${req.files.logo[0].filename}` : null;
  
  styles[styleId] = style;
  saveCustomStyles(styles);
  
  res.json({ success: true, styleId, style });
});

// PUT /api/custom-styles/:id - Update custom style
app.put('/api/custom-styles/:id', uploadCustomStyle.fields([
  { name: 'stripeSingle', maxCount: 1 },
  { name: 'breakStripe', maxCount: 1 },
  { name: 'prematchStripe', maxCount: 1 },
  { name: 'logo', maxCount: 1 }
]), (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const styleId = req.params.id;
  const styles = loadCustomStyles();
  
  if (!styles[styleId]) {
    return res.status(404).json({ error: 'Style not found' });
  }
  
  const existingStyle = styles[styleId];
  const name = req.body.name;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const stripeMode = req.body.stripeMode || existingStyle.stripeMode || 'single';
  
  const style = {
    name: name.trim(),
    stripeMode: stripeMode
  };
  
  if (stripeMode === 'single') {
    if (req.files && req.files.stripeSingle) {
      // New file uploaded
      style.breakStripe = `/public/img/custom-styles/${req.files.stripeSingle[0].filename}`;
      style.prematchStripe = `/public/img/custom-styles/${req.files.stripeSingle[0].filename}`;
      
      // Delete old file if it was different
      if (existingStyle.breakStripe && existingStyle.breakStripe !== style.breakStripe) {
        const oldFilePath = path.join(__dirname, '..', existingStyle.breakStripe);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    } else if (req.body.keepStripeSingle === 'true' && existingStyle.breakStripe) {
      // Keep existing file
      style.breakStripe = existingStyle.breakStripe;
      style.prematchStripe = existingStyle.prematchStripe;
    } else {
      // No file and not keeping - use existing or null
      style.breakStripe = existingStyle.breakStripe || null;
      style.prematchStripe = existingStyle.prematchStripe || null;
    }
  } else {
    // Separate mode
    if (req.files && req.files.breakStripe) {
      style.breakStripe = `/public/img/custom-styles/${req.files.breakStripe[0].filename}`;
      // Delete old file if it was different
      if (existingStyle.breakStripe && existingStyle.breakStripe !== style.breakStripe) {
        const oldFilePath = path.join(__dirname, '..', existingStyle.breakStripe);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    } else if (req.body.keepBreakStripe === 'true' && existingStyle.breakStripe) {
      style.breakStripe = existingStyle.breakStripe;
    } else {
      style.breakStripe = existingStyle.breakStripe || null;
    }
    
    if (req.files && req.files.prematchStripe) {
      style.prematchStripe = `/public/img/custom-styles/${req.files.prematchStripe[0].filename}`;
      // Delete old file if it was different
      if (existingStyle.prematchStripe && existingStyle.prematchStripe !== style.prematchStripe) {
        const oldFilePath = path.join(__dirname, '..', existingStyle.prematchStripe);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    } else if (req.body.keepPrematchStripe === 'true' && existingStyle.prematchStripe) {
      style.prematchStripe = existingStyle.prematchStripe;
    } else {
      style.prematchStripe = existingStyle.prematchStripe || null;
    }
  }
  
  if (req.files && req.files.logo) {
    style.logo = `/public/img/custom-styles/${req.files.logo[0].filename}`;
    // Delete old file if it was different
    if (existingStyle.logo && existingStyle.logo !== style.logo) {
      const oldFilePath = path.join(__dirname, '..', existingStyle.logo);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
  } else if (req.body.removeLogo === 'true') {
    // Remove logo
    if (existingStyle.logo) {
      const oldFilePath = path.join(__dirname, '..', existingStyle.logo);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    style.logo = null;
  } else if (req.body.keepLogo === 'true' && existingStyle.logo) {
    style.logo = existingStyle.logo;
  } else {
    style.logo = existingStyle.logo || null;
  }
  
  styles[styleId] = style;
  saveCustomStyles(styles);
  
  res.json({ success: true, styleId, style });
});

// DELETE /api/custom-styles/:id - Delete custom style
app.delete('/api/custom-styles/:id', (req, res) => {
  if (req.query.token !== getActualToken()) return res.status(403).send('Forbidden');
  
  const styles = loadCustomStyles();
  const styleId = req.params.id;
  
  if (!styles[styleId]) {
    return res.status(404).json({ error: 'Style not found' });
  }
  
  // Check if this style is currently active
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const currentGraphicStyle = config.graphicStyle || 'default';
  
  if (currentGraphicStyle === `custom:${styleId}`) {
    return res.status(400).json({ error: 'Cannot delete active style. Please select another style first.' });
  }
  
  const style = styles[styleId];
  
  // Delete files
  if (style.breakStripe) {
    const filePath = path.join(__dirname, '..', style.breakStripe);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  if (style.prematchStripe) {
    const filePath = path.join(__dirname, '..', style.prematchStripe);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  if (style.logo) {
    const filePath = path.join(__dirname, '..', style.logo);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  delete styles[styleId];
  saveCustomStyles(styles);
  
  res.json({ success: true });
});