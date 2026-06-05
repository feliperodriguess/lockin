import Store from "electron-store"

type StoreType = {
	data: Record<string, any>
}

export const store = new Store<StoreType>({
	defaults: {
		data: {},
	},
})
