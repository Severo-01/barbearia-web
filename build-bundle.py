#!/usr/bin/env python3
"""Gera dist/barbearia-completo.html: o site inteiro (landing + sistema) em UM arquivo HTML.

Uso (na raiz do repositório):   python3 tools/build-bundle.py
Requer Python 3 e a biblioteca Pillow (pip install pillow). Não altera nenhum arquivo do repositório.

Como funciona: a landing e as mídias ficam embutidas; o sistema (app/) vai dentro de um Shadow DOM,
isolado da landing. Os botões "Agendar" e "Quero este plano" abrem o sistema na própria página.
"""
import base64, io, json, mimetypes, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDN_SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js'

def read(p): return open(os.path.join(ROOT, p), encoding='utf8').read()
def b64(s): return base64.b64encode(s.encode('utf8')).decode()
def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or ('video/mp4' if path.endswith('.mp4') else 'application/octet-stream')
    return f'data:{mime};base64,' + base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()

def thumb_uri(path, size=160):
    from PIL import Image
    im = Image.open(os.path.join(ROOT, path)).convert('RGB'); im.thumbnail((size, size))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()

def shadow_css(css):
    css = re.sub(r'html\{[^}]*\}\n?', '', css)
    css = css.replace(':root{', ':host{')
    css = re.sub(r'(^|\n)body\{', r'\1:host{display:block;', css)
    return css.replace('body.drawer #side', ':host(.drawer) #side').replace('body.drawer #scrim', ':host(.drawer) #scrim')

ROUTER = r'''<script>
/* Roteador do arquivo único: abre o sistema (Shadow DOM) quando necessário. */
(function(){
  var P=%s;
  function dec(b){return decodeURIComponent(escape(atob(b)))}
  var entered=false;
  function enterApp(){
    if(entered) return; entered=true; window.__APP_MODE=true;
    try{ if(window.ScrollTrigger) ScrollTrigger.getAll().forEach(function(t){t.kill(true)}); }catch(e){}
    Array.prototype.forEach.call(document.querySelectorAll('video'),function(v){try{v.pause()}catch(e){}});
    var land=document.getElementById('landing-root'); if(land) land.style.display='none';
    var host=document.getElementById('app-host'); host.style.display='block'; host.style.minHeight='100vh';
    var root=host.attachShadow({mode:'open'});
    root.innerHTML='<style>'+dec(P.css)+'</style>'+dec(P.html);
    window.APP_ROOT=root; window.APP_HOST=host; window.APP_PHOTOS=P.photos;
    document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0,0);
    var s=document.createElement('script'); s.src=%s;
    s.onload=function(){ [dec(P.app),dec(P.admin)].forEach(function(code){var x=document.createElement('script');x.textContent=code;document.head.appendChild(x)}) };
    s.onerror=function(){ var b=root.querySelector('#boot'); if(b) b.innerHTML='<p>Não foi possível carregar o sistema. Verifique a internet e recarregue a página.</p>'; };
    document.head.appendChild(s);
  }
  window.__enterApp=enterApp;
  var auto=/^#\/app/.test(location.hash)||/[?&](code|token_hash|error_description)=/.test(location.search)||/error_description=/.test(location.hash);
  if(auto){ window.__APP_MODE=true; document.addEventListener('DOMContentLoaded',enterApp); }
  else window.addEventListener('hashchange',function(){ if(/^#\/app/.test(location.hash)) enterApp(); });
})();
</script>
'''

def build(landing, app_html, app_css, app_js, admin_js, assets):
    """assets: função (caminho relativo) -> data URI."""
    h = landing
    # sem o redirecionamento da versão em pastas (no arquivo único não existe /app/)
    h = re.sub(r'<script>/\* links dos e-mails.*?</script>\n?', '', h, flags=re.S)
    # botões -> sistema dentro da própria página
    h = h.replace('app/?go=agendar', '#/app/agendar')
    h = re.sub(r'app/\?go=planos&plano=(\d)', r'#/app/planos?plano=\1', h)
    # mídias embutidas
    h = re.sub(r'assets/(?:img|video)/[A-Za-z0-9_\-/]+\.(?:jpg|png|mp4)', lambda m: assets(m.group(0)), h)
    frames = sorted(set(re.findall(r'assets/tour/frame-\d{3}\.webp', h))) or None
    h = re.sub(r'Array\.from\(\{length:(\d+)\},\(_,i\)=>"assets/tour/frame-"\+String\(i\+1\)\.padStart\(3,"0"\)\+"\.webp"\)',
               lambda m: json.dumps([assets('assets/tour/frame-%03d.webp' % (i + 1)) for i in range(int(m.group(1)))]), h)
    # landing dentro de #landing-root; scripts da landing não rodam se abrir direto no sistema
    i0 = h.index('<body>') + len('<body>'); i1 = h.index('<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap')
    h = h[:i0] + '\n<div id="landing-root">' + h[i0:i1] + '</div>\n<div id="app-host" style="display:none"></div>\n@@ROUTER@@' + h[i1:]
    h = re.sub(r'<script>(.*?)</script>', lambda m: '<script>if(!window.__APP_MODE){' + m.group(1) + '\n}</script>', h, flags=re.S)
    # ---- sistema
    body = re.search(r'<body>(.*?)<script src=', app_html, flags=re.S).group(1)
    body = body.replace('../assets/img/logo.png', assets('assets/img/logo.png')).replace('href="../"', 'href="./"')
    P = {'css': b64(shadow_css(app_css)), 'html': b64(body), 'app': b64(app_js), 'admin': b64(admin_js),
         'photos': {'/equipe/wesley.jpg': assets('equipe/wesley.jpg'), '/equipe/anderson.jpg': assets('equipe/anderson.jpg')}}
    return h.replace('@@ROUTER@@', ROUTER % (json.dumps(P), json.dumps(CDN_SUPABASE)))

if __name__ == '__main__':
    def assets(p):
        return thumb_uri(p) if p.startswith('equipe/') else data_uri(p)
    out = build(read('index.html'), read('app/index.html'), read('app/app.css'), read('app/app.js'), read('app/admin.js'), assets)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    path = os.path.join(ROOT, 'dist', 'barbearia-completo.html')
    open(path, 'w', encoding='utf8').write(out)
    print('gerado:', path, round(len(out) / 1048576, 1), 'MB')
