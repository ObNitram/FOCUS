process.env.DIST_ELECTRON = join(__dirname, '../../..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST_ELECTRON, '../public')

import { app, BrowserWindow, dialog, IpcMain } from 'electron'
import { join } from 'path'
import * as fs from './FileSystemModule'

const urlDev = process.env.VITE_DEV_SERVER_URL + '#/vault-manager'
const urlProd = join('file://', process.env.DIST, 'index.html') + '#/vault-manager'
const defaultPath = app.getPath('home') + '/Documents'

function setupWindow(win: BrowserWindow) {

  // resize window
  win.setSize(1000, 420);
  win.setResizable(false);

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    win.loadURL(urlDev)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadURL(urlProd)
  }
}

function setupEvents(ipc: IpcMain, win: BrowserWindow) {
  ipc.on('choose-directory', async (event) => {
    const { filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose a directory to use as a vault',
      defaultPath: defaultPath,
      buttonLabel: 'Use as vault',
      properties: ['openDirectory'],
    })
    event.reply('directory-chosen', filePaths[0])
  })


  ipc.on('create-vault', async (event, vaultName: string, vaultPath: string) => {
    if (!vaultName) {
      return
    }

    if (!vaultPath) {
      vaultPath = defaultPath
    }

    const vault = fs.createFolder(vaultName, vaultPath)
    if (!vault) {
      return
    }
    event.reply('vault-created', vault)
  })
}

export function init(win: BrowserWindow, ipc: IpcMain) {

  setupWindow(win)
  setupEvents(ipc, win)
}