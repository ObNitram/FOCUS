// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '../..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST_ELECTRON, '../public')

import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { release } from 'os'
import { join } from 'path'
import chokidar from 'chokidar'

import * as VaultManagement from './modules/VaultManagementModule'
import * as WindowsManagement from './modules/WindowsManagement'
import * as printMessage from './modules/OutputModule'
import * as MarkdownConverter from './modules/markdownConversion/MarkdownConversionModule'
import { initConfig, saveInSettingPathVault, initGeneralConfig, saveSizeSideBar, getSizeSidebar } from './modules/ManageConfig'
import { removeMD } from './modules/FileSystemModule'

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const urlDev = process.env.VITE_DEV_SERVER_URL
const urlProd = join('file://', process.env.DIST, 'index.html')

let pathVault: string | null = null
let mainWindow: BrowserWindow | null = null

let watcher: chokidar.FSWatcher | null = null

let modificationsInVaultFromApp: number = 0
let modificationsInVaultFromOutsideTimer: NodeJS.Timeout | null = null

function sendVaultContent() {
  printMessage.printINFO('Request to get folder content !')
  VaultManagement.getVaultContent().then((content) => {
    console.log(content)
    mainWindow?.webContents.send('folder-content', content)
  })
    .catch((err) => {
      printMessage.printError(err)
    })
}

function setupWatcher() {
  if (watcher) {
    watcher.close()
  }

  if (VaultManagement.getPathVault() === null) {
    return
  }

  watcher = chokidar.watch(VaultManagement.getPathVault(), {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: false,
    ignoreInitial: true
  })

  watcher.on('all', (event, path) => {
    if (modificationsInVaultFromApp > 0) {
      modificationsInVaultFromApp--

      switch (event) {
        case 'add':
          VaultManagement.getNoteOrFolderInfo(path).then((note) => {
            printMessage.printLog('add ' + path)
            mainWindow?.webContents.send('note-created', removeMD(note))
          })
          break
        case 'addDir':
          VaultManagement.getNoteOrFolderInfo(path).then((folder) => {
            printMessage.printLog('addDir ' + path)
            mainWindow?.webContents.send('note-created', folder)
          })
          break
        case 'change':
          VaultManagement.getNoteOrFolderInfo(path, true).then((note) => {
            printMessage.printLog('change ' + path)
            mainWindow?.webContents.send('note-updated', removeMD(note))
          })
          break
        case 'unlink':
          printMessage.printLog('remove ' + path)
          mainWindow?.webContents.send('note-or-folder-deleted', path)
          break
        case 'unlinkDir':
          printMessage.printLog('removeDir ' + path)
          mainWindow?.webContents.send('note-or-folder-deleted', path)
          break
      }
    }

    else {
      if (modificationsInVaultFromOutsideTimer) {
        clearTimeout(modificationsInVaultFromOutsideTimer)
      }

      modificationsInVaultFromOutsideTimer = setTimeout(() => {
        printMessage.printLog('Vault modified from outside')
        sendVaultContent()
      }, 1000)
    }
  })
}

function setupEvents() {
  setupWatcher()

  ipcMain.on('get-folder-content', () => {
    sendVaultContent()
  })

  ipcMain.on('create-note', (event, pathVault: string | null = null) => {
    printMessage.printINFO('Request to add note !')
    modificationsInVaultFromApp++

    VaultManagement.createNote(pathVault ? pathVault : VaultManagement.getPathVault()).then((note) => {
      if (note) {
        printMessage.printOK('Note added')
      } else {
        printMessage.printError('Note not added')
      }
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('create-folder', (event, pathVault: string | null = null) => {
    printMessage.printINFO('Request to add folder !')
    modificationsInVaultFromApp++

    VaultManagement.createFolder(pathVault ? pathVault : VaultManagement.getPathVault(), 'Untitled').then((folder) => {
      if (folder) {
        printMessage.printOK('Folder added')
      } else {
        printMessage.printError('Folder not added')
      }
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('delete-note-or-folder', (event, arg) => {
    printMessage.printINFO('Request to remove : ' + arg)
    modificationsInVaultFromApp++

    VaultManagement.deleteFileOrFolder(arg).then(() => {
      printMessage.printOK(arg + ' removed!')
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('rename-note-or-folder', (event, path: string, newName: string) => {
    printMessage.printINFO('Request to rename : ' + path)
    modificationsInVaultFromApp += 2

    VaultManagement.renameFileOrFolder(path, newName).then(() => {
      printMessage.printOK(path + ' renamed!')
    })
      .catch((err) => {
        printMessage.printError(err)
        VaultManagement.getNoteOrFolderInfo(path, true).then((note) => {
          mainWindow?.webContents.send('note-updated', note)
        })
          .catch((err) => {
            printMessage.printError(err)
          })
      })
  })

  ipcMain.on('move-note-or-folder', (event, path: string, newParentFolder: string | null = null) => {
    if (newParentFolder === null) {
      newParentFolder = VaultManagement.getPathVault()
    }

    printMessage.printINFO('Request to move : ' + path + ' to ' + newParentFolder)
    if (path === newParentFolder || path === newParentFolder.concat('/', path.split('/').pop())) {
      printMessage.printINFO('No move needed')
      return
    }

    let pathParts = path.split('/')
    const newPath = join(newParentFolder, pathParts[pathParts.length - 1])

    modificationsInVaultFromApp += 2

    VaultManagement.moveFileOrFolder(path, newPath).then(() => {
      printMessage.printOK(path + ' moved!')
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('copy-note-or-folder', (event, path: string, newParentFolder: string | null = null) => {
    if (newParentFolder === null) {
      newParentFolder = VaultManagement.getPathVault()
    }

    printMessage.printINFO('Request to copy : ' + path + ' to ' + newParentFolder)

    let pathParts = path.split('/')
    const newPath = join(newParentFolder, pathParts[pathParts.length - 1])

    modificationsInVaultFromApp += 2

    VaultManagement.copyFileOrFolder(path, newPath).then(() => {
      printMessage.printOK(path + ' copied!')
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('open-note', (event, path: string) => {
    printMessage.printINFO('Request to open : ' + path)
    VaultManagement.openFile(path).then((noteData: string) => {
      MarkdownConverter.convertMarkdownToJSON(noteData).then((noteData) => {
        VaultManagement.getNoteOrFolderInfo(path, false).then((note) => {
          printMessage.printOK(path + ' opened!')
          mainWindow?.webContents.send('note-opened', note.name, noteData)
        })
          .catch((err) => {
            printMessage.printError(err)
          })
      })
        .catch((err) => {
          printMessage.printError(err)
        })
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('save-note', (event, noteData: string) => {
    const path = VaultManagement.getOpenedFilePath()
    printMessage.printINFO('Request to save : ' + path)
    modificationsInVaultFromApp++

    MarkdownConverter.convertJSONToMarkdown(noteData).then((noteData) => {
      VaultManagement.saveOpenedFile(noteData).then(() => {
        printMessage.printOK(path + ' saved!')
      })
        .catch((err) => {
          printMessage.printError(err)
        })
    })
      .catch((err) => {
        printMessage.printError(err)
      })
  })

  ipcMain.on('show-in-explorer', (event, path: string) => {
    printMessage.printINFO('Request to show in explorer : ' + path)
    VaultManagement.showInExplorer(path)
  })

  ipcMain.on('open_main_window', (event, path: string) => {
    if (!saveInSettingPathVault(path)) {
      app.exit();
    }
    setupWatcher()
    mainWindow = WindowsManagement.closeVaultWindowAndOpenMain()
  })

  ipcMain.on('closeApp', () => {
    printMessage.printLog('Close application is asked')

    if (VaultManagement.getOpenedFilePath() !== null) {
      mainWindow?.webContents.send('is-note-saved')

      ipcMain.once('is-note-saved-answer', (event, isSaved) => {
        printMessage.printLog('Note is saved : ' + isSaved)
        if (isSaved) {
          closeApp();
          return
        }
        printMessage.printLog('Note is not saved, ask user if he wants to continue')
        VaultManagement.alertUserNoteNotSaved().then((userWantsToContinue) => {
          if (!userWantsToContinue) {
            printMessage.printLog('User canceled the action')
            return
          }
          printMessage.printLog('User wants to continue, close application')
          closeApp();
        })
          .catch((err) => {
            printMessage.printError(err)
          })
      })
    } else {
      closeApp();
    }
  })

  ipcMain.on('maximizeWindow', (event) => {
    printMessage.printLog('Maximize application is asked')
    BrowserWindow.getFocusedWindow().maximize()
  })

  ipcMain.on('hideWindow', (event) => {
    printMessage.printLog('hide application is asked')
    BrowserWindow.getFocusedWindow().minimize()
  })

  ipcMain.on('getSizeSidebar', (event) => {
    event.reply('size_sidebar', getSizeSidebar())
  })

  ipcMain.on('newSizeSideBar', (event, number) => {
    printMessage.printLog('Save size of sidebar asked')
    saveSizeSideBar(number).then((value) => printMessage.printOK(value)).catch((reason) => printMessage.printError(reason))
  })

  ipcMain.on('open-link', (event, link) => {
    link = link.replace(/['"]+/g, '')
    printMessage.printLog('Open link asked: ' + link)

    shell.openExternal(link)
  })
}



if (initConfig() == false || initGeneralConfig() == false) {
  printMessage.printError('The configuration of settings is corrupted or a system error occured. Exiting...')
  app.exit();
}

app.whenReady().then(() => {
  setupEvents();
  pathVault = VaultManagement.getPathVault()
  printMessage.printLog('Path found is ' + pathVault)
  if (pathVault == null) {
    printMessage.printINFO('This is the first time of application launch or the config was reseted !')
    printMessage.printINFO('Launch select vault location window...')
    WindowsManagement.createVaultWindow()
  } else {
    printMessage.printINFO('A valid configuration is found, launching the main window...')
    VaultManagement.setPath(pathVault)
    mainWindow = WindowsManagement.createMainWindow();
  }
})

function closeApp() {
  app.quit()
}


app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (mainWindow) {
    // Focus on the main window if the user tried to open another
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    mainWindow = WindowsManagement.createMainWindow()
  }
})

// new window example arg: new windows url
ipcMain.handle('open-win', (event, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${urlDev}#${arg}`)
  } else {
    childWindow.loadURL(`${urlProd}#${arg}`)
  }
})

// import wasm library

import { add, parse } from './modules/wasm_lib/focus_lib.js'

ipcMain.on('debug', async (event) => {
  printMessage.printLog("debug");
  printMessage.printLog(add(1, 2).toString());
  printMessage.printLog(parse("Hello"));
});
