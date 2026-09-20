import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('c:/Projects/SIH_MVP/frontend/js/trustEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()
target = 'renderTrustResult('
idx = text.find(target)
print(text[idx:idx+2500])
