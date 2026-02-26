import os

def fix_app_css():
    with open('src/App.css', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    in_conflict = False
    conflict_part = 0 # 1 for top (ujjwal), 2 for bottom (main)
    
    for i, line in enumerate(lines):
        if line.startswith('<<<<<<<'):
            in_conflict = True
            conflict_part = 1
            continue
        elif line.startswith('======='):
            # Special case for conflict 3: add missing closing brace for page-viewport
            if 'padding: 32px;' in lines[i-1] or 'padding: 32px;\n' in lines[i-1]:
                new_lines.append('}\n\n')
            conflict_part = 2
            continue
        elif line.startswith('>>>>>>>'):
            in_conflict = False
            conflict_part = 0
            continue
            
        new_lines.append(line)
        
    with open('src/App.css', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print("Fixed App.css")

fix_app_css()
