"""Rebuild mercato.json from the private site's database.
usage: python3 -I sync_mercato.py <dir with offerte/*.json from ArtifactData list out_dir> <indici.json>
Keeps active market offers only: drops attiva:false, da_verificare, fonte "utente"/manual ones,
and fixed prices under 60% of PUN/PSV (almost always misreads or teasers)."""
import json,sys,glob,os
src,ind=sys.argv[1],sys.argv[2]
ix=json.load(open(ind));ix=ix.get("indici",ix)
keep={k:ix[k] for k in ("pun","psv","data","fonte","note","luce_extra") if k in ix}
O={};skip=[]
for f in sorted(glob.glob(os.path.join(src,"offerte","*.json"))):
    k=os.path.basename(f)[:-5];o=json.load(open(f));o=o.get("data",o) if "tipo" not in o else o
    idx=keep["pun"] if o.get("tipo")=="luce" else keep["psv"]
    bad=o.get("attiva") is False or o.get("da_verificare") or str(o.get("fonte","")).lower() in ("utente","") \
        or (o.get("modo")=="fisso" and not (o.get("prezzo") or 0)>=0.6*idx)
    (skip if bad else [None]).append(k) if bad else None
    if not bad: O[k]={x:v for x,v in o.items() if x not in ("da_verificare",)}
json.dump({"offerte":O,"indici":keep},open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"mercato.json"),"w"),ensure_ascii=False,separators=(",",":"))
print(f"{len(O)} offerte tenute; escluse: {', '.join(skip) or 'nessuna'}; PUN {keep['pun']} PSV {keep['psv']} al {keep.get('data')}")
