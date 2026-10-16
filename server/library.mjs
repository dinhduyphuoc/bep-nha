import { resolve } from 'node:path'
import { createDriveLibrary } from './drive.mjs'
import { createCachedDriveLibrary } from './drive-cache.mjs'

export function createAppLibrary(env, recipes) {
  const library = createDriveLibrary({ rootFolderId: env.DRIVE_ROOT_FOLDER_ID, apiKey: env.DRIVE_API_KEY, recipes })
  const seconds = Number(env.DRIVE_SYNC_INTERVAL_SECONDS || 30)
  return createCachedDriveLibrary({
    library,
    directory: resolve(env.DRIVE_CACHE_DIR || '.cache/drive'),
    identity: JSON.stringify({ root: env.DRIVE_ROOT_FOLDER_ID || '', recipes: recipes.map(({ id, name, driveFolder }) => ({ id, name, driveFolder })) }),
    intervalMs: (Number.isFinite(seconds) && seconds >= 10 ? seconds : 30) * 1000,
  })
}
