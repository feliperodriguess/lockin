import { app, Menu, nativeImage, Tray } from "electron"

import trayIcon from "~/resources/lockinTemplate.png"

export function createTray() {
	const icon = nativeImage.createFromDataURL(trayIcon)
	const tray = new Tray(icon)
	const menu = Menu.buildFromTemplate([{ label: "lockin", enabled: false }, { type: "separator" }])
	tray.setContextMenu(menu)
}

app.whenReady().then(() => {})
