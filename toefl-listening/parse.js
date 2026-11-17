// Convierte el .md de transcripción en "items" (un audio = un item)
// item: {nums:[n..], sp:[{who,text}], q:{n:texto de la pregunta}}
function parse(md){
  const items=[];let cur=null,m;
  for(const line of md.split('\n')){
    if(m=line.match(/^#### Number (\d+)\s*$/)){cur={nums:[+m[1]],sp:[],q:{}};items.push(cur);continue}
    if(m=line.match(/^### Questions (\d+)\D+(\d+)/)){
      const n=[];for(let i=+m[1];i<=+m[2];i++)n.push(i);
      cur={nums:n,sp:[],q:{}};items.push(cur);continue}
    if(/^#{1,3} /.test(line)||/^---/.test(line)){cur=null;continue}
    if(!cur)continue;
    const b=line.match(/\*\*([^*]+?):\*\*\s*(.*)$/);if(!b)continue;
    const label=b[1].trim(),text=b[2].replace(/\*/g,'').trim();
    if(/^Number \d+$/.test(label))cur.q[label.slice(7)]=text;
    else if(label==='Question')cur.q[cur.nums[0]]=text;
    else if(text&&!/^(Questions|Directions)/.test(label))cur.sp.push({who:label,text});
  }
  return items;
}
if(typeof module!=='undefined')module.exports=parse;
