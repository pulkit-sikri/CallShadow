import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('c:/Projects/SIH_MVP/frontend/index.html', 'r', encoding='utf-8') as f:
    text = f.read()
import re
panels = re.findall(r'<div[^>]*id="view-[^"]*"[^>]*>', text)
for p in panels:
    print(p)
