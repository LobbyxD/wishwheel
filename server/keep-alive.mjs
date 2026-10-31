// Server-only health check for Wishwheel's private D1 binding.
export async function handleKeepAlive(request,env) {
 const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 const json=(body,status)=>Response.json(body,{status,headers});
 if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'GET'}});
 const secret=env.KEEP_ALIVE_SECRET;
 if(!secret)return json({error:'KEEP_ALIVE_SECRET is not configured on the server'},500);
 if(request.headers.get('Authorization')!==`Bearer ${secret}`)return json({error:'Unauthorized'},401);
 try {
  const row=await env.DB.prepare('UPDATE keep_alive SET last_updated = ? WHERE id = 1 RETURNING last_updated').bind(new Date().toISOString()).first();
  if(!row)return json({error:'Keep-alive row not found',hint:'Run the seed SQL: INSERT INTO keep_alive (id) VALUES (1);'},404);
  return json({ok:true,updated_at:row.last_updated},200);
 } catch {
  return json({error:'Database update failed'},500);
 }
}
