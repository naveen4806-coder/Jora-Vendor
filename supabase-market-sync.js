/* Requests secure vendor-to-user marketplace sync after shop/product writes. */
(function(){
  const original=window.db&&window.db.collection;
  if(!original)return;
  window.db.collection=function(collection){
    const query=original(collection),getDoc=query.doc.bind(query);
    query.doc=function(id){
      const ref=getDoc(id);
      if(['shops','products'].includes(collection)){
        ['set','update'].forEach(method=>{const base=ref[method].bind(ref);ref[method]=async function(){const result=await base.apply(null,arguments);try{const response=await window.joraSupabase.functions.invoke('sync-marketplace',{body:{collection,id}});if(response.error)console.warn('Marketplace sync queued:',response.error.message);}catch(error){console.warn('Marketplace sync unavailable:',error.message)}return result;};});
      }
      return ref;
    };
    if(['shops','products'].includes(collection)){
      const add=query.add.bind(query);
      query.add=async function(data){
        const result=await add(data);
        try{
          const response=await window.joraSupabase.functions.invoke('sync-marketplace',{body:{collection,id:result.id}});
          if(response.error)console.warn('Marketplace sync queued:',response.error.message);
        }catch(error){
          console.warn('Marketplace sync unavailable:',error.message);
        }
        return result;
      };
    }
    return query;
  };
})();
