#!/bin/bash
# Codebase Indexing Script
# Generates a JSON index of the entire codebase for AI context

set -e

WORKSPACE_DIR="${1:-/workspace}"
INDEX_FILE="${WORKSPACE_DIR}/.kalpana/codebase-index.json"
TEMP_FILE="${WORKSPACE_DIR}/.kalpana/codebase-index.tmp.json"

# Create .kalpana directory if it doesn't exist
mkdir -p "${WORKSPACE_DIR}/.kalpana"

echo "🔍 Indexing codebase in ${WORKSPACE_DIR}..."

# Start building JSON
cat > "$TEMP_FILE" << 'EOF'
{
  "lastUpdated": "",
  "files": [],
  "structure": {},
  "symbols": {
    "functions": [],
    "classes": [],
    "exports": []
  },
  "stats": {
    "totalFiles": 0,
    "totalLines": 0,
    "languages": {}
  }
}
EOF

# Function to detect language from file extension
detect_language() {
    local file="$1"
    case "${file##*.}" in
        ts|tsx) echo "typescript" ;;
        js|jsx) echo "javascript" ;;
        py) echo "python" ;;
        go) echo "go" ;;
        rs) echo "rust" ;;
        java) echo "java" ;;
        cpp|cc|cxx) echo "cpp" ;;
        c) echo "c" ;;
        rb) echo "ruby" ;;
        php) echo "php" ;;
        sh|bash) echo "shell" ;;
        html) echo "html" ;;
        css|scss|sass) echo "css" ;;
        json) echo "json" ;;
        yaml|yml) echo "yaml" ;;
        md) echo "markdown" ;;
        *) echo "unknown" ;;
    esac
}

# Arrays to store data
declare -a files_array
declare -a functions_array
declare -a classes_array
declare -a exports_array
total_files=0
total_lines=0

# Find all files, excluding common ignore patterns
while IFS= read -r -d '' file; do
    # Get relative path
    rel_path="${file#$WORKSPACE_DIR/}"
    
    # Skip if starts with .
    [[ "$rel_path" == .* ]] && continue
    
    # Get file info
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    language=$(detect_language "$file")
    
    # Count lines
    if [[ -f "$file" ]]; then
        lines=$(wc -l < "$file" 2>/dev/null || echo 0)
        total_lines=$((total_lines + lines))
    else
        lines=0
    fi
    
    # Add to files array
    files_array+=("{\"path\":\"$rel_path\",\"language\":\"$language\",\"size\":$size,\"lines\":$lines}")
    total_files=$((total_files + 1))
    
    # Extract symbols based on language
    if [[ "$language" == "typescript" || "$language" == "javascript" ]]; then
        # Extract function declarations
        while IFS= read -r line_num; do
            func_name=$(sed -n "${line_num}p" "$file" | grep -oE '(function|const|let|var)\s+\w+' | awk '{print $2}' | head -1)
            if [[ -n "$func_name" ]]; then
                functions_array+=("{\"name\":\"$func_name\",\"file\":\"$rel_path\",\"line\":$line_num}")
            fi
        done < <(grep -n "^\s*\(export\s\+\)\?\(function\|const\|let\|var\)\s\+\w\+" "$file" 2>/dev/null | cut -d: -f1 || true)
        
        # Extract class declarations
        while IFS= read -r line_num; do
            class_name=$(sed -n "${line_num}p" "$file" | grep -oE 'class\s+\w+' | awk '{print $2}')
            if [[ -n "$class_name" ]]; then
                classes_array+=("{\"name\":\"$class_name\",\"file\":\"$rel_path\",\"line\":$line_num}")
            fi
        done < <(grep -n "^\s*\(export\s\+\)\?class\s\+\w\+" "$file" 2>/dev/null | cut -d: -f1 || true)
        
        # Extract exports
        while IFS= read -r line_num; do
            export_name=$(sed -n "${line_num}p" "$file" | grep -oE 'export\s+(const|let|var|function|class|interface|type)\s+\w+' | awk '{print $3}')
            if [[ -n "$export_name" ]]; then
                exports_array+=("{\"name\":\"$export_name\",\"file\":\"$rel_path\",\"line\":$line_num}")
            fi
        done < <(grep -n "^\s*export\s\+" "$file" 2>/dev/null | cut -d: -f1 || true)
    fi
    
done < <(find "$WORKSPACE_DIR" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/.next/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.kalpana/*" \
    -not -path "*/coverage/*" \
    -not -path "*/__pycache__/*" \
    -not -path "*/.pytest_cache/*" \
    -not -path "*/venv/*" \
    -not -path "*/.venv/*" \
    -print0)

# Build final JSON
{
    echo "{"
    echo "  \"lastUpdated\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
    echo "  \"files\": ["
    
    # Output files
    for i in "${!files_array[@]}"; do
        echo -n "    ${files_array[$i]}"
        if [[ $i -lt $((${#files_array[@]} - 1)) ]]; then
            echo ","
        else
            echo ""
        fi
    done
    
    echo "  ],"
    echo "  \"symbols\": {"
    echo "    \"functions\": ["
    
    # Output functions
    for i in "${!functions_array[@]}"; do
        echo -n "      ${functions_array[$i]}"
        if [[ $i -lt $((${#functions_array[@]} - 1)) ]]; then
            echo ","
        else
            echo ""
        fi
    done
    
    echo "    ],"
    echo "    \"classes\": ["
    
    # Output classes
    for i in "${!classes_array[@]}"; do
        echo -n "      ${classes_array[$i]}"
        if [[ $i -lt $((${#classes_array[@]} - 1)) ]]; then
            echo ","
        else
            echo ""
        fi
    done
    
    echo "    ],"
    echo "    \"exports\": ["
    
    # Output exports
    for i in "${!exports_array[@]}"; do
        echo -n "      ${exports_array[$i]}"
        if [[ $i -lt $((${#exports_array[@]} - 1)) ]]; then
            echo ","
        else
            echo ""
        fi
    done
    
    echo "    ]"
    echo "  },"
    echo "  \"stats\": {"
    echo "    \"totalFiles\": $total_files,"
    echo "    \"totalLines\": $total_lines,"
    echo "    \"totalFunctions\": ${#functions_array[@]},"
    echo "    \"totalClasses\": ${#classes_array[@]},"
    echo "    \"totalExports\": ${#exports_array[@]}"
    echo "  }"
    echo "}"
} > "$INDEX_FILE"

# Clean up temp file
rm -f "$TEMP_FILE"

echo "✅ Codebase indexed: $total_files files, $total_lines lines"
echo "📄 Index saved to: $INDEX_FILE"
