import os
import json
import re
from html.parser import HTMLParser

class ContentExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.content = []
        self.current_section = "General"
        self.current_tag = None
        self.is_main = False
        self.skip_tags = {"script", "style", "nav", "button", "header", "footer"}
        self.buffer = ""
        self.current_metadata = {"title": "", "url": ""}

    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        if tag == "main" or ('class' in dict(attrs) and 'main' in dict(attrs)['class']):
            self.is_main = True
        
        if tag in ["h1", "h2", "h3", "p", "div", "li", "td", "th"]:
            self.buffer = ""

    def handle_endtag(self, tag):
        if tag == "main":
            self.is_main = False
        
        if self.is_main and tag not in self.skip_tags:
            text = self.buffer.strip()
            if text and len(text) > 20: # Skip short snippets
                if self.current_tag == "h1":
                    self.current_metadata["title"] = text
                elif self.current_tag == "h2":
                    self.current_section = text
                
                self.content.append({
                    "section": self.current_section,
                    "text": text,
                    "tag": self.current_tag,
                    "page_title": self.current_metadata["title"]
                })
        self.buffer = ""
        self.current_tag = None

    def handle_data(self, data):
        if self.is_main and self.current_tag not in self.skip_tags:
            self.buffer += data

def extract_from_file(file_path, base_dir):
    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    parser = ContentExtractor()
    rel_path = os.path.relpath(file_path, base_dir)
    parser.current_metadata["url"] = rel_path
    
    # Try to get title from <title> tag first
    title_match = re.search(r'<title>(.*?)</title>', html_content, re.IGNORECASE)
    if title_match:
        parser.current_metadata["title"] = title_match.group(1).split('|')[0].strip()
    
    parser.feed(html_content)
    return parser.content

def main():
    base_dir = os.getcwd()
    knowledge_base = []
    
    # Modules to scan
    modules = ["module1", "module2", "module3", "."]
    
    for module in modules:
        module_path = os.path.join(base_dir, module)
        if not os.path.exists(module_path):
            continue
            
        for file in os.listdir(module_path):
            # Include all .html files except index.html (which is just a menu)
            if file.endswith(".html") and file != "index.html":
                file_path = os.path.join(module_path, file)
                print(f"Processing {file_path}...")
                try:
                    file_content = extract_from_file(file_path, base_dir)
                    for item in file_content:
                        item["url"] = os.path.relpath(file_path, base_dir)
                    knowledge_base.extend(file_content)
                except Exception as e:
                    print(f"Error processing {file}: {e}")

    output_path = os.path.join(base_dir, "knowledge_base.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(knowledge_base, f, indent=2)
    
    print(f"Knowledge base created with {len(knowledge_base)} entries at {output_path}")

if __name__ == "__main__":
    main()
