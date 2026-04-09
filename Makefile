# =============================================================
#  Shopping List with Grocy Card — Developer Makefile
# =============================================================
#
#  make help           Show this help
#  make install        Install Node dependencies
#  make lint           Check formatting (prettier + eslint)
#  make format         Auto-format sources
#  make build          Build dist/shopping-list-with-grocy-card.js
#  make dev            Watch mode (hot rebuild)
#
#  make version        Show current version
#  make bump-patch     x.y.Z+1  -- bug fix
#  make bump-minor     x.Y+1.0  -- new feature
#  make bump-major     X+1.0.0  -- breaking change
#
#  make release        lint + build -> bump-patch -> tag -> push
#  make release-minor  lint + build -> bump-minor -> tag -> push
#  make release-major  lint + build -> bump-major -> tag -> push

.DEFAULT_GOAL := help

PACKAGE := package.json
DIST    := dist/shopping-list-with-grocy-card.js

# ── Helpers ──────────────────────────────────────────────────

_version = $(shell node -p "require('./$(PACKAGE)').version")

define _bump
	node -e "\
const fs = require('fs'); \
const p = JSON.parse(fs.readFileSync('$(PACKAGE)', 'utf8')); \
const parts = p.version.split('.').map(Number); \
const idx = {patch: 2, minor: 1, major: 0}['$(1)']; \
parts[idx]++; \
for (let i = idx+1; i < 3; i++) parts[i] = 0; \
p.version = parts.join('.'); \
fs.writeFileSync('$(PACKAGE)', JSON.stringify(p, null, 4) + '\n'); \
console.log('Bumped to', p.version); \
"
endef

# ── Help ─────────────────────────────────────────────────────

.PHONY: help
help:
	@echo ""
	@echo "  Shopping List with Grocy Card — Developer Commands"
	@echo ""
	@echo "  make install        Install Node dependencies"
	@echo "  make lint           Check sources (eslint + prettier)"
	@echo "  make format         Auto-format sources"
	@echo "  make build          Build dist/shopping-list-with-grocy-card.js"
	@echo "  make dev            Watch mode (hot rebuild on save)"
	@echo ""
	@echo "  make version        Show current version"
	@echo "  make bump-patch     x.y.Z+1  -- bug fix"
	@echo "  make bump-minor     x.Y+1.0  -- new feature"
	@echo "  make bump-major     X+1.0.0  -- breaking change"
	@echo ""
	@echo "  make release        lint + build -> bump-patch -> tag -> push"
	@echo "  make release-minor  lint + build -> bump-minor -> tag -> push"
	@echo "  make release-major  lint + build -> bump-major -> tag -> push"
	@echo ""

# ── Dependencies ─────────────────────────────────────────────

.PHONY: install
install:
	@echo "--- Installing Node dependencies"
	npm ci
	@echo "Done."

# ── Lint ─────────────────────────────────────────────────────

.PHONY: lint
lint:
	@echo "--- eslint"
	npm run lint
	@echo "--- prettier check"
	npx prettier --check "src/**/*.{ts,js}"
	@echo "Lint passed."

# ── Format ───────────────────────────────────────────────────

.PHONY: format
format:
	@echo "--- prettier write"
	npx prettier --write "src/**/*.{ts,js}"
	@echo "--- eslint fix"
	npm run lint-fix

# ── Build ────────────────────────────────────────────────────

.PHONY: build
build:
	@echo "--- rollup build"
	npm run build
	@echo "Built: $(DIST)"

.PHONY: dev
dev:
	@echo "--- rollup watch (Ctrl+C to stop)"
	npx rollup -c --watch

# ── Version ──────────────────────────────────────────────────

.PHONY: version
version:
	@echo "Current version: $(_version)"

.PHONY: bump-patch
bump-patch:
	$(call _bump,patch)

.PHONY: bump-minor
bump-minor:
	$(call _bump,minor)

.PHONY: bump-major
bump-major:
	$(call _bump,major)

# ── Release ──────────────────────────────────────────────────

.PHONY: release
release: lint build bump-patch
	$(eval V := $(_version))
	@echo "--- Releasing v$(V)"
	git add $(PACKAGE) $(DIST)
	git commit -m "chore(release): prepare for v$(V)"
	git tag -a "v$(V)" -m "Release v$(V)"
	git push && git push --tags
	@echo "Released v$(V) ✓"

.PHONY: release-minor
release-minor: lint build bump-minor
	$(eval V := $(_version))
	@echo "--- Releasing v$(V)"
	git add $(PACKAGE) $(DIST)
	git commit -m "chore(release): prepare for v$(V)"
	git tag -a "v$(V)" -m "Release v$(V)"
	git push && git push --tags
	@echo "Released v$(V) ✓"

.PHONY: release-major
release-major: lint build bump-major
	$(eval V := $(_version))
	@echo "--- Releasing v$(V)"
	git add $(PACKAGE) $(DIST)
	git commit -m "chore(release): prepare for v$(V)"
	git tag -a "v$(V)" -m "Release v$(V)"
	git push && git push --tags
	@echo "Released v$(V) ✓"