#!/usr/bin/env bash
# Wrap status.html (an Artifact page body) into a full HTML document for GitHub Pages: docs/index.html
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}img{max-width:100%%}</style>\n</head>\n<body>\n'
  cat status.html
  printf '\n</body>\n</html>\n'
} > index.html
touch .nojekyll
echo "docs/index.html"
