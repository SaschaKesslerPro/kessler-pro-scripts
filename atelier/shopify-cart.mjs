/* The live integration reuses Kessler's existing Worker and Shopyflow cart.
 * It is deliberately not enabled by the local design preview. */
export async function addConfiguredPlate({workerUrl,body,quantity=1,shopyflow,fetchImpl=fetch}){
  if(!Number.isSafeInteger(quantity)||quantity<1)throw new Error('Bitte eine gültige Stückzahl eingeben.');
  if(!shopyflow||typeof shopyflow.addToCart!=='function')throw new Error('Der Shop-Warenkorb ist noch nicht verbunden.');
  const target=new URL(workerUrl);
  if(target.protocol!=='https:')throw new Error('Der Warenkorb-Endpunkt muss HTTPS verwenden.');
  // preis is always the price of ONE plate, as expected by the existing Worker.
  const payload=structuredClone(body);
  const response=await fetchImpl(target.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok||!result.variantId)throw new Error(result.fehler||'Die Platte konnte noch nicht in den Warenkorb gelegt werden. Bitte erneut versuchen.');
  // Never add a variant if the server changed the price without user-visible review.
  if(!Number.isFinite(result.preis)||Math.abs(result.preis-body.preis)>.011)throw new Error('Der Preis wurde aktualisiert. Bitte die Konfiguration neu laden.');
  if(result.lager&&(!body.lager||body.konfig?.cuts?.length||Object.values(body.konfig?.extras||{}).some(Boolean)))throw new Error('Die Variante passt nicht zur konfigurierten Platte.');
  await shopyflow.addToCart({lineItems:[{merchandiseId:result.variantId,quantity,attributes:result.attribute||[]}],useShopifyId:true});
  if(typeof shopyflow.openCart==='function')shopyflow.openCart();
  return result;
}

export const lineTotal=(price,quantity)=>Math.round(price*100)*quantity/100;
