#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

echo "Running the production quality gate..."
npm run quality

echo "Checking the proposed repository contents..."
git diff --check

if git ls-files .project-trash | rg -q .; then
  echo "Upload blocked: .project-trash contains tracked files." >&2
  exit 1
fi

obsolete_paths="$(git ls-files app/chatgpt-auth.ts db drizzle drizzle.config.ts examples/d1 examples/assessment-door-sample.ifc examples/buildingsmart-pcert-architecture.ifc public/file.svg public/globe.svg public/window.svg)"
if [[ -n "$obsolete_paths" ]]; then
  echo "Upload blocked: obsolete starter files are still tracked:" >&2
  echo "$obsolete_paths" >&2
  exit 1
fi

credential_matches="$(git ls-files -z | xargs -0 rg -l -I 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|Bearer[[:space:]]+[A-Za-z0-9._-]{24,}' || true)"
if [[ -n "$credential_matches" ]]; then
  echo "Upload blocked: a tracked file contains credential-like text:" >&2
  echo "$credential_matches" >&2
  exit 1
fi

echo "Pre-upload checks passed. The source tree is ready for upload confirmation."
