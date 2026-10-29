# Junta o app num único HTML (CSS, JS, ícones e manifest embutidos) para publicar por link.
import base64, json, pathlib
raiz = pathlib.Path(__file__).resolve().parent.parent
ler = lambda n: (raiz / n).read_text(encoding='utf-8')
b64 = lambda n, t: f'data:{t};base64,' + base64.b64encode((raiz / n).read_bytes()).decode()

html = ler('index.html')
manifest = json.loads(ler('manifest.json'))
manifest['start_url'] = '/'
manifest['icons'] = [
    {'src': b64('icon-192.png', 'image/png'), 'sizes': '192x192', 'type': 'image/png'},
    {'src': b64('icon-512.png', 'image/png'), 'sizes': '512x512', 'type': 'image/png'},
]
trocas = {
    '<link rel="manifest" href="manifest.json">':
        '<link rel="manifest" href="data:application/manifest+json;base64,' + base64.b64encode(json.dumps(manifest).encode()).decode() + '">',
    '<link rel="icon" href="icon.svg" type="image/svg+xml">': f'<link rel="icon" href="{b64("icon.svg", "image/svg+xml")}" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="icon-180.png">': f'<link rel="apple-touch-icon" href="{b64("icon-180.png", "image/png")}">',
    '<link rel="stylesheet" href="style.css">': '<style>\n' + ler('style.css') + '</style>',
    '<script src="app.js"></script>': '<script>\n' + ler('app.js') + '</script>',
}
for antes, depois in trocas.items():
    assert antes in html, antes
    html = html.replace(antes, depois)
(raiz / 'publicar' / 'minasuai.html').write_text(html, encoding='utf-8')
