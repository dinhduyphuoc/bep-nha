export function mergePhotoLibrary(recipes, library) {
  if (!library?.configured) {
    return {
      recipes: recipes.map(recipe => ({ ...recipe, image: '/dishes/empty.svg', carouselPhotos: [], gallery: [], photoSource: 'empty' })),
      events: [],
    }
  }
  const merged = recipes.map(recipe => {
    const album = library.albums.find(album => album.dishId === recipe.id)
    const photos = album?.photos || []
    return { ...recipe, carouselPhotos: photos, gallery: album?.galleryPhotos || [], image: photos[0]?.image || '/dishes/empty.svg', photoSource: 'drive' }
  })
  // Deduplicate Drive files that appear in more than one mapped album.
  const unique = new Map()
  for (const album of library.albums) for (const photo of [...album.photos, ...(album.galleryPhotos || [])]) if (!unique.has(photo.id)) unique.set(photo.id, photo)
  return { recipes: merged, events: [...unique.values()] }
}
