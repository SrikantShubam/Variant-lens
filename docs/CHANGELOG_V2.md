# Changelog

## [2.0.0] - 2024-03-01

### Added
- PDB structure resolution hierarchy (preferred over AlphaFold)
- Blinded validation set with 10 curated variants
- Expert alignment scoring and public VALIDATION.md
- Batch processing (max 20 variants)
- Case file export (JSON + Markdown)
- Rate limiting and caching layer
- Mobile fallback for structure viewer
- Accessibility baseline (keyboard navigation)
- Structured agent prompts with CriticAgent validation
- Citation enforcement (PMID/DOI required)
- Data retention policies (30-day auto-deletion)
- Multi-provider LLM support (OpenRouter/Gemini/Mock)

### Changed
- Structure badge: "PDB (Experimental)" vs "AlphaFold (Predicted)"
- Confidence calibration: Agent now says "uncertain" when appropriate
- Distribution strategy: Education-first outreach

### Security
- Added rate limiting per IP
- Input sanitization for HGVS
- API key rotation procedures

### Fixed
- Citation hallucinations (strict validation)
- Mobile WebGL failures (static image fallback)

## [1.0.0] - 2024-01-15
- Initial release
- AlphaFold-only structures
- Single variant analysis
- Basic agent hypothesis
