#!/usr/bin/env python3
import os
import re
from pathlib import Path
from collections import defaultdict

def is_comment_line(line, file_ext):
    """Check if a line is a comment based on file extension."""
    line = line.strip()
    if not line:
        return False
    
    # Single line comments
    if file_ext in ['.js', '.ts', '.jsx', '.tsx', '.rs', '.sol']:
        if line.startswith('//'):
            return True
    elif file_ext in ['.py']:
        if line.startswith('#'):
            return True
    elif file_ext in ['.css', '.scss', '.sass']:
        if line.startswith('/*') or line.startswith('//'):
            return True
    
    # Multi-line comment starts
    if file_ext in ['.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.sass']:
        if line.startswith('/*'):
            return True
    elif file_ext in ['.rs']:
        if line.startswith('/*') or line.startswith('///') or line.startswith('//!'):
            return True
    
    return False

def is_in_multiline_comment(line, file_ext, in_multiline_comment):
    """Check if line is inside a multi-line comment."""
    line = line.strip()
    
    if file_ext in ['.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.sass']:
        if '/*' in line and '*/' in line:
            return False
        if '/*' in line:
            return True
        if '*/' in line:
            return False
    elif file_ext in ['.rs']:
        if '/*' in line and '*/' in line:
            return False
        if '/*' in line:
            return True
        if '*/' in line:
            return False
    
    return in_multiline_comment

def count_lines_in_file(file_path):
    """Count non-comment lines in a single file."""
    file_ext = Path(file_path).suffix.lower()
    
    # Skip binary files and other non-text files
    skip_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', 
                      '.wasm', '.bin', '.db', '.sqlite', '.lock', '.log', '.map', '.min.js', '.min.css'}
    
    if file_ext in skip_extensions:
        return 0
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0
    
    count = 0
    in_multiline_comment = False
    
    for line in lines:
        # Check if we're entering or exiting a multi-line comment
        in_multiline_comment = is_in_multiline_comment(line, file_ext, in_multiline_comment)
        
        # Skip empty lines, comment lines, and lines inside multi-line comments
        if (line.strip() and 
            not is_comment_line(line, file_ext) and 
            not in_multiline_comment):
            count += 1
    
    return count

def should_skip_file(file_path):
    """Check if file should be skipped (dependencies, generated files, test data, etc.)."""
    file_path_str = str(file_path).lower()
    
    # Skip dependency files and large data files
    skip_patterns = [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'node_modules',
        'target/',
        'dist/',
        'build/',
        '.next/',
        'coverage/',
        '.cache/',
        '.parcel-cache/',
        'bower_components/',
        'jspm_packages/',
        'vendor/',
        'public/',
        'static/',
        'assets/',
        'images/',
        'icons/',
        'fonts/',
        'test_scripts/output/',  # Skip test data files
        'backend/test_scripts/', # Skip all backend test scripts
        'test/',  # Skip test folders
        'tests/',  # Skip tests folders
        'artifacts/',
        'res/',
        '*.wasm',
        '*.bin',
        '*.db',
        '*.sqlite',
        '*.lock',
        '*.log',
        '*.map',
        '*.min.js',
        '*.min.css',
        'bithive_records.json',  # Large test data files
        'selected_withdrawal_records.json'
    ]
    
    for pattern in skip_patterns:
        if pattern in file_path_str:
            return True
    
    return False

def count_actual_source_lines(project_path):
    """Count lines of code in actual source files only."""
    project_path = Path(project_path)
    
    # File extensions to count (focus on source code)
    source_extensions = {
        '.js', '.ts', '.jsx', '.tsx', '.rs', '.sol', '.py', '.css', '.scss', '.sass',
        '.html', '.htm', '.xml', '.json', '.yaml', '.yml', '.toml', '.md', '.txt'
    }
    
    # Directories to skip
    skip_dirs = {
        'node_modules', '.git', '.next', 'target', 'dist', 'build', 'coverage',
        'public', 'static', 'assets', 'images', 'icons', 'fonts', 'vendor',
        'bower_components', 'jspm_packages', '.cache', '.parcel-cache',
        'test', 'tests', 'test_scripts'  # Skip test directories
    }
    
    total_lines = 0
    file_counts = defaultdict(int)
    extension_counts = defaultdict(int)
    skipped_files = []
    
    for root, dirs, files in os.walk(project_path):
        # Skip unwanted directories
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        
        # Only process backend/ and contract/ directories
        root_path = Path(root)
        if not (str(root_path.relative_to(project_path)).startswith('backend') or 
                str(root_path.relative_to(project_path)).startswith('contract')):
            continue
        
        for file in files:
            file_path = Path(root) / file
            file_ext = file_path.suffix.lower()
            
            # Skip files that should be excluded
            if should_skip_file(file_path):
                skipped_files.append(str(file_path.relative_to(project_path)))
                continue
            
            # Only count files with relevant extensions
            if file_ext in source_extensions:
                lines = count_lines_in_file(file_path)
                if lines > 0:
                    total_lines += lines
                    file_counts[str(file_path.relative_to(project_path))] = lines
                    extension_counts[file_ext] += lines
    
    return total_lines, file_counts, extension_counts, skipped_files

def main():
    """Main function to count lines and display results."""
    project_path = "."  # Current directory
    
    print("Counting lines of source code in BACKEND and CONTRACT folders only (excluding comments)...")
    print("=" * 80)
    
    total_lines, file_counts, extension_counts, skipped_files = count_actual_source_lines(project_path)
    
    print(f"\nTotal lines of source code (excluding comments): {total_lines:,}")
    print("\nBreakdown by file extension:")
    print("-" * 30)
    
    for ext, count in sorted(extension_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"{ext:>8}: {count:>8,} lines")
    
    print(f"\nTotal source files analyzed: {len(file_counts)}")
    print(f"Files skipped (dependencies/generated/test data): {len(skipped_files)}")
    
    # Show top 20 largest source files
    print("\nTop 20 largest source files:")
    print("-" * 40)
    for file_path, count in sorted(file_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
        print(f"{count:>6,} lines: {file_path}")
    
    # Calculate summary by project area
    backend_lines = 0
    contract_lines = 0
    
    for file_path, count in file_counts.items():
        parts = Path(file_path).parts
        if len(parts) > 0 and parts[0] == 'backend':
            backend_lines += count
        elif len(parts) > 0 and parts[0] == 'contract':
            contract_lines += count
    
    print(f"\nBreakdown by project area:")
    print("-" * 30)
    print(f"Backend (backend/):  {backend_lines:>8,} lines")
    print(f"Contracts (contract/): {contract_lines:>8,} lines")
    print(f"Total:              {total_lines:>8,} lines")
    
    # Save detailed results to file
    with open('actual_source_line_count.txt', 'w') as f:
        f.write(f"Total lines of source code in BACKEND and CONTRACT folders (excluding comments): {total_lines:,}\n\n")
        f.write("Breakdown by file extension:\n")
        f.write("-" * 30 + "\n")
        for ext, count in sorted(extension_counts.items(), key=lambda x: x[1], reverse=True):
            f.write(f"{ext:>8}: {count:>8,} lines\n")
        f.write(f"\nTotal source files analyzed: {len(file_counts)}\n")
        f.write(f"Files skipped (dependencies/generated/test data): {len(skipped_files)}\n\n")
        f.write("Breakdown by project area:\n")
        f.write("-" * 30 + "\n")
        f.write(f"Backend (backend/):  {backend_lines:>8,} lines\n")
        f.write(f"Contracts (contract/): {contract_lines:>8,} lines\n")
        f.write(f"Total:              {total_lines:>8,} lines\n\n")
        f.write("All source files:\n")
        f.write("-" * 30 + "\n")
        for file_path, count in sorted(file_counts.items(), key=lambda x: x[1], reverse=True):
            f.write(f"{count:>6,} lines: {file_path}\n")
        f.write(f"\nSkipped files:\n")
        f.write("-" * 30 + "\n")
        for file_path in sorted(skipped_files):
            f.write(f"  {file_path}\n")
    
    print(f"\nDetailed results saved to 'actual_source_line_count.txt'")

if __name__ == "__main__":
    main() 