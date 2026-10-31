# Viola: Untertitel offline übersetzen (argostranslate). Aufruf: python translate.py <von> <nach>   (JSON-Liste von Texten auf stdin, JSON-Liste auf stdout)
# Braucht: pip install argostranslate. Sprachpakete werden beim ersten Mal heruntergeladen (Internet nötig).
import sys, json
src, dst = sys.argv[1], sys.argv[2]
texts = json.load(sys.stdin)
import argostranslate.package as pkg, argostranslate.translate as tr
def have():
    langs = tr.get_installed_languages()
    a = next((l for l in langs if l.code == src), None); b = next((l for l in langs if l.code == dst), None)
    return a and b and a.get_translation(b)
if not have():
    pkg.update_package_index()
    av = pkg.get_available_packages()
    for p in av:
        if p.from_code == src and p.to_code == dst:
            pkg.install_from_path(p.download()); break
t = have()
if not t:
    print(json.dumps({'error': f'Kein Sprachpaket {src}->{dst}'}))
    sys.exit(2)
print(json.dumps([t.translate(x) for x in texts], ensure_ascii=False))
