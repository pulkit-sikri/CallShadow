import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('c:/Projects/SIH_MVP/frontend/index.html', 'r', encoding='utf-8') as f:
    text = f.read()
target = 'id="view-upload"'
idx = text.find(target)
target2 = 'id="view-enroll"'
idx2 = text.find(target2)
print(text[idx:idx2])
