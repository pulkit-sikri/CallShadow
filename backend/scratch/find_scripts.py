import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('c:/Projects/SIH_MVP/frontend/index.html', 'r', encoding='utf-8') as f:
    text = f.read()
import re
scripts = re.findall(r'<script.*?>.*?</script>|<script.*?/>', text, re.DOTALL)
for s in scripts:
    print(s[:150])
