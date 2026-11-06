export async function readDocumentary(path, signal) {
  const response=await fetch(`/nervous-breakdown${path}`,{
    signal,headers:{Authorization:`Bearer ${localStorage.getItem('jwt_token')||''}`,'X-Requested-With':'XMLHttpRequest'}
  });
  const data=await response.json();
  if(!response.ok||data.success===false)throw Error(data.error?.message||'The documentary source could not be read.');
  return data;
}
