const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_NAME = 'server-config.json'

function configPath() {
  return path.join(app.getPath('userData'), CONFIG_NAME)
}

function loadConfig() {
  try {
    const p = configPath()
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'))
    }
  } catch (_) {}
  return {
    serverUrl: process.env.PET_GARDEN_URL || 'http://127.0.0.1:4158',
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}

let mainWindow = null
let cfg = loadConfig()

function normalizeUrl(url) {
  let u = String(url || '').trim()
  if (!u) return 'http://127.0.0.1:4158'
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u
  return u.replace(/\/+$/, '')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '东郭工作室·班级宠物园',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  buildMenu()
  loadAppHome()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function loadAppHome() {
  const base = normalizeUrl(cfg.serverUrl)
  cfg.serverUrl = base
  saveConfig(cfg)
  mainWindow.loadURL(base + '/overview').catch(() => {
    mainWindow.loadFile(path.join(__dirname, 'settings.html'))
  })
}

function openPath(route) {
  const base = normalizeUrl(cfg.serverUrl)
  mainWindow.loadURL(base + route)
}

function buildMenu() {
  const template = [
    {
      label: '班级',
      submenu: [
        {
          label: '总览 / 登录',
          accelerator: 'CmdOrCtrl+1',
          click: () => openPath('/overview'),
        },
        {
          label: '宠物教室',
          accelerator: 'CmdOrCtrl+2',
          click: () => openPath('/'),
        },
        {
          label: '学生管理',
          click: () => openPath('/students'),
        },
        {
          label: '排行榜',
          click: () => openPath('/ranking'),
        },
        { type: 'separator' },
        {
          label: '刷新',
          accelerator: 'F5',
          click: () => mainWindow && mainWindow.reload(),
        },
      ],
    },
    {
      label: '管理',
      submenu: [
        {
          label: '系统管理（管理员）',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => openPath('/admin'),
        },
        {
          label: '规则设置',
          click: () => openPath('/settings'),
        },
        {
          label: '评价记录',
          click: () => openPath('/records'),
        },
      ],
    },
    {
      label: '设置',
      submenu: [
        {
          label: '服务器地址…',
          click: async () => {
            const r = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              buttons: ['打开设置页', '取消'],
              defaultId: 0,
              title: '服务器地址',
              message: '当前服务器：\n' + normalizeUrl(cfg.serverUrl),
              detail: '可在设置页修改群晖 / 本机地址，例如 http://192.168.1.10:4158',
            })
            if (r.response === 0) {
              mainWindow.loadFile(path.join(__dirname, 'settings.html'))
            }
          },
        },
        {
          label: '在浏览器中打开',
          click: () => shell.openExternal(normalizeUrl(cfg.serverUrl)),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '东郭工作室·班级宠物园 桌面客户端',
              detail:
                '支持 Windows 7 / Windows 10。\n班级登录、课堂评价、管理员系统管理均在客户端内完成。\n首次请设置服务器地址（本机或群晖）。\n版本 ' +
                app.getVersion(),
            })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('get-config', () => ({
  serverUrl: normalizeUrl(cfg.serverUrl),
}))

ipcMain.handle('save-config', (_e, data) => {
  cfg.serverUrl = normalizeUrl(data && data.serverUrl)
  saveConfig(cfg)
  return { ok: true, serverUrl: cfg.serverUrl }
})

ipcMain.handle('go-home', () => {
  loadAppHome()
  return { ok: true }
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(createWindow)

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
