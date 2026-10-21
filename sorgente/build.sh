#!/bin/sh
# Rigenera ../index.html e ../mercato.json dai pezzi in src/ (lanciare da qualsiasi cartella)
cd "$(dirname "$0")"
cat src/a_top.html src/b_body.html src/c_core.js src/d_pan.js src/e_con.js src/f_off.js src/i_chi.js src/h_dat.js > pagina.tmp
python3 -c "
s=open('pagina.tmp',encoding='utf8').read();m=open('../mercato.json',encoding='utf8').read().strip();w=open('web_shim.js',encoding='utf8').read()
assert s.count('__MERCATO__')==1;s=s.replace('__MERCATO__',m)
h='<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><meta name=\"description\" content=\"Carica le tue bollette di luce e gas e confronta le offerte del mercato. I dati restano nel tuo browser.\"><script>'+w+'</script></head><body>'
open('../index.html','w',encoding='utf8').write(h+s+'</body></html>')"
rm pagina.tmp
