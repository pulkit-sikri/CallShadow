import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('c:/Projects/SIH_MVP/frontend/index.html', 'r', encoding='utf-8') as f:
    text = f.read()
target = 'id="view-analysis"'
idx = text.find(target)
if idx != -1:
    print(text[idx+3000:idx+7000])
