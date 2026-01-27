#!/usr/bin/env bash
set -euo pipefail

# Kur ieškoti (pakeisk jei reikia)
SRC_ROOT="${1:-$HOME/Downloads}"

# Kur kopijuoti
DST_DIR="${2:-$HOME/Projects/studiofx/workingfiles}"

# Log failas
LOG_FILE="${DST_DIR}/copy.log"

mkdir -p "$DST_DIR"

echo "[$(date -Is)] Starting copy from: $SRC_ROOT -> $DST_DIR" | tee -a "$LOG_FILE"

# Naudojam find + rsync per sąrašą, kad:
# - veiktų su tarpais pavadinimuose
# - išlaikytų kelią (relative path)
# - nekopijuotų be reikalo (tik delta)
cd "$SRC_ROOT"

# Surenkam failų sąrašą (relative paths)
mapfile -d '' FILES < <(find . -type f -name 'tiktok*.json' -print0)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "[$(date -Is)] No files found matching tiktok*.json under $SRC_ROOT" | tee -a "$LOG_FILE"
  exit 0
fi

# rsync su --files-from per STDIN
# --relative: išlaiko kelią nuo SRC_ROOT (su ./...)
# --mkpath: sukuria trūkstamus katalogus (jei rsync versija palaiko; jei ne, žiūrėk pastabą žemiau)
printf '%s\0' "${FILES[@]}" | rsync -0a --relative --ignore-existing --info=NAME,STATS2 --from0 --files-from=- ./ "$DST_DIR/" | tee -a "$LOG_FILE"

echo "[$(date -Is)] Done. Copied ${#FILES[@]} candidate files (some may have been skipped if already existed)." | tee -a "$LOG_FILE"

echo "[$(date -Is)] Remove files from source directory" | tee -a "$LOG_FILE"

cd "$SRC_ROOT"
rm -rf tiktok*.json