#!/bin/bash
# Codebase Indexing Script
# Generates a JSON index of the entire codebase for AI context

set -e

WORKSPACE_DIR="${1:-/workspace}"
INDEX_FILE="${WORKSPACE_DIR}/.kalpana/codebase-index.json"
TEMP_FILE="${WORKSPACE_DIR}/.kalpana/codebase-index.tmp.json"

# Create .kalpana directory if it doesn't exist
mkdir -p "${WORKSPACE_DIR}/.kalpana"

echo "🔍 Indexing codebase in ${WORKSPACE_DIR}..." >&2

# Initialize JSON skeleton
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

# Detect language from extension
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

# Arrays
declare -a files_array
declare -a functions_array
declare -a classes_array
declare -a exports_array
total_files=0
total_lines=0

# Index files
while IFS= read -r -d '' file; do
    rel_path="${file#$WORKSPACE_DIR/}"
    [[ "$rel_path" == .* ]] && continue

    rel_path_escaped=$(echo "$rel_path" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g; s/\r/\\r/g; s/\n/\\n/g')
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    language=$(detect_language "$file")

    if [[ -f "$file" ]]; then
        lines=$(wc -l < "$file" 2>/dev/null || echo 0)
        total_lines=$((total_lines + lines))
    else
        lines=0
    fi

    files_array+=("{\"path\":\"$rel_path_escaped\",\"language\":\"$language\",\"size\":$size,\"lines\":$lines}")
    total_files=$((total_files + 1))

    # -------- SYMBOL EXTRACTION --------
    if [[ "$language" == "typescript" || "$language" == "javascript" ]]; then
        # Functions (classic + async)
        while IFS=: read -r line_num line_content; do
            func_name=$(echo "$line_content" | sed -E 's/.*\bfunction\s+([A-Za-z_][A-Za-z0-9_]*).*/\1/')
            if [[ -n "$func_name" ]]; then
                functions_array+=("{\"name\":\"$func_name\",\"file\":\"$rel_path_escaped\",\"line\":$line_num}")
            fi
        done < <(grep -nE "^\s*(export\s+)?(async\s+)?function\s+[A-Za-z_]" "$file" 2>/dev/null || true)

        # Arrow functions & React-style components
        while IFS=: read -r line_num line_content; do
            func_name=$(echo "$line_content" | sed -E 's/.*\b(const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*).*/\2/')
            if [[ -n "$func_name" ]]; then
                functions_array+=("{\"name\":\"$func_name\",\"file\":\"$rel_path_escaped\",\"line\":$line_num}")
            fi
        done < <(grep -nE "^\s*(export\s+)?(const|let|var)\s+[A-Za-z_][A-Za-z0-9_]*\s*=?\s*\(?.*=>.*" "$file" 2>/dev/null || true)

        # Classes
        while IFS=: read -r line_num line_content; do
            class_name=$(echo "$line_content" | sed -E 's/.*\bclass\s+([A-Za-z_][A-Za-z0-9_]*).*/\1/')
            if [[ -n "$class_name" ]]; then
                classes_array+=("{\"name\":\"$class_name\",\"file\":\"$rel_path_escaped\",\"line\":$line_num}")
            fi
        done < <(grep -nE "^\s*(export\s+)?class\s+[A-Za-z_]" "$file" 2>/dev/null || true)

        # TypeScript types/interfaces/enums
        while IFS=: read -r line_num line_content; do
            ts_symbol=$(echo "$line_content" | sed -E 's/.*\b(export\s+)?(interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*).*/\3/')
            if [[ -n "$ts_symbol" ]]; then
                exports_array+=("{\"name\":\"$ts_symbol\",\"file\":\"$rel_path_escaped\",\"line\":$line_num}")
            fi
        done < <(grep -nE "^\s*export\s+(interface|type|enum)\s+" "$file" 2>/dev/null || true)

        # Default exports
        while IFS=: read -r line_num line_content; do
            exports_array+=("{\"name\":\"default\",\"file\":\"$rel_path_escaped\",\"line\":$line_num}")
        done < <(grep -nE "^\s*export\s+default" "$file" 2>/dev/null || true)
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

# -------- Build Final JSON --------
{
    echo "{"
    echo "  \"lastUpdated\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
    echo "  \"files\": ["
    for i in "${!files_array[@]}"; do
        echo -n "    ${files_array[$i]}"
        [[ $i -lt $((${#files_array[@]} - 1)) ]] && echo "," || echo ""
    done
    echo "  ],"
    echo "  \"symbols\": {"
    echo "    \"functions\": ["
    for i in "${!functions_array[@]}"; do
        echo -n "      ${functions_array[$i]}"
        [[ $i -lt $((${#functions_array[@]} - 1)) ]] && echo "," || echo ""
    done
    echo "    ],"
    echo "    \"classes\": ["
    for i in "${!classes_array[@]}"; do
        echo -n "      ${classes_array[$i]}"
        [[ $i -lt $((${#classes_array[@]} - 1)) ]] && echo "," || echo ""
    done
    echo "    ],"
    echo "    \"exports\": ["
    for i in "${!exports_array[@]}"; do
        echo -n "      ${exports_array[$i]}"
        [[ $i -lt $((${#exports_array[@]} - 1)) ]] && echo "," || echo ""
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

rm -f "$TEMP_FILE"

echo "✅ Codebase indexed: $total_files files, $total_lines lines" >&2
echo "📄 Index saved to: $INDEX_FILE" >&2
