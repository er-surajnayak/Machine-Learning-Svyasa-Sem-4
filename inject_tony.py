import os

def inject_scripts():
    root_dir = os.getcwd()
    
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                rel_depth = len(os.path.relpath(root, root_dir).split(os.sep))
                if os.path.relpath(root, root_dir) == ".":
                    rel_prefix = "./"
                else:
                    rel_prefix = "../" * rel_depth
                
                keys_script = f'<script src="{rel_prefix}tony_keys.js"></script>'
                tony_script = f'<script src="{rel_prefix}tony.js"></script>'
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if 'tony.js' in content:
                    print(f"Skipping {file_path} (already injected)")
                    continue
                
                if '</body>' in content:
                    print(f"Injecting into {file_path}...")
                    new_content = content.replace('</body>', f'{keys_script}\n{tony_script}\n</body>')
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    inject_scripts()
