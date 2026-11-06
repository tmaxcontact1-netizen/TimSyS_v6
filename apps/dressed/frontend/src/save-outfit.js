export async function saveOutfitConfirmed(api, payload) {
  const saved = await api('/api/timsys/v1/apps/dressed/backend/1.0.0/ensembles/save', {
    method: 'POST', actionFeedback: false, body: JSON.stringify(payload),
  });
  if (!saved?.id || !saved?.name) throw new Error('The service did not return a saved outfit. Your selection is still here; no save has been confirmed.');
  let list;
  try { list = await api('/api/timsys/v1/apps/dressed/backend/1.0.0/ensembles/saved'); }
  catch { throw new Error('The save request completed, but the saved list could not be checked. Refresh Saved outfits before saving again to avoid a duplicate.'); }
  if (!list?.items?.some(item => item.id === saved.id)) throw new Error('The service accepted the save, but the outfit is missing from Saved outfits. Your selection is still here. Refresh the list before trying again.');
  return {saved, items: list.items};
}
