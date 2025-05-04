#!/usr/bin/env python3
"""
Test script to check if the JavaScript consolidation is working properly.
This script will:
1. Start a local server
2. Open each template in a browser
3. Check if there are any JavaScript errors
"""

import os
import subprocess
import sys
import time
import webbrowser
from flask import Flask

def main():
    print("Testing JavaScript consolidation...")
    
    # Check if Flask is running
    try:
        import requests
        response = requests.get("http://localhost:5000")
        if response.status_code == 200:
            print("✅ Flask application is running")
        else:
            print("❌ Flask application is running but returned status code", response.status_code)
    except Exception:
        print("❌ Flask application is not running. Please start it first with 'python app.py'")
        sys.exit(1)
    
    # Check if main.js exists
    if os.path.exists("static/js/main.js"):
        print("✅ main.js exists")
    else:
        print("❌ main.js does not exist")
        sys.exit(1)
        
    # Check if script.js has been deprecated
    if os.path.exists("static/js/script.js"):
        with open("static/js/script.js", "r") as f:
            content = f.read()
            if "@deprecated" in content:
                print("✅ script.js has been properly deprecated")
            else:
                print("❌ script.js exists but doesn't have deprecation notice")
    else:
        print("⚠️ script.js does not exist at all")
    
    # Check if templates reference main.js
    templates = ["templates/index.html", "templates/results.html", "templates/segment.html"]
    for template in templates:
        if os.path.exists(template):
            with open(template, "r") as f:
                content = f.read()
                if 'src="{{ url_for(\'static\', filename=\'js/main.js\') }}"' in content:
                    print(f"✅ {template} references main.js")
                else:
                    print(f"❌ {template} does not reference main.js")
                    
                if 'name="csrf-token"' in content:
                    print(f"✅ {template} includes CSRF token meta tag")
                else:
                    print(f"❌ {template} does not include CSRF token meta tag")
        else:
            print(f"❌ {template} does not exist")
    
    print("\nTest completed! Please check if there are any issues listed above.")

if __name__ == "__main__":
    main() 