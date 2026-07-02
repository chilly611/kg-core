# Import template — column spec

*Authored 2026-07-01 during CODE-C (Cowork had not delivered a spec; this default is now canonical — supersede deliberately, not silently). `tests/fixtures/harborline-import.xlsx` is the living example; regenerate fixtures with `node scripts/make-fixtures.mjs`.*

One row = one project ± one contact link. Repeat the project columns to attach more contacts to the same project; groups, addresses, projects, and contacts dedupe within the file and against the database (email > phone > name for contacts; place_id > street+city+postal for addresses; lowercased name for groups/projects).

| column | notes |
| --- | --- |
| `group_name` | optional; groups dedupe by name |
| `group_kind` | `single_residence` \| `multi_family` \| `commercial` (list_values) |
| `project_name` | **required** for a project row |
| `street` | nullable — concept/dream projects may have city/region only |
| `city`, `region`, `postal`, `country` | at least ONE jurisdiction part required per new project |
| `contact_name` | with email/phone forms the contact |
| `contact_type` | vocabulary code (`lessee`, `vendor`, …). Unknown codes become **draft** types for review (Rubicon queue) — never a silent vocabulary write |
| `contact_phone`, `contact_email` | dedupe keys |
| `preferred_contact_method` | free text (`email`, `sms`, `phone`, …) |
| `lease_start`, `lease_end` | `YYYY-MM-DD` (Excel date cells fine); `lease_start <= lease_end` enforced; an already-ended lease imports as effective-inactive |
| `notes` | lands in `projects.attrs.notes` |

Header aliases accepted: `zip`→postal, `state`→region, `phone`/`email`→contact fields, `tenant`→contact_name, `building`→group_name, and similar (see `lib/intake/normalize.ts`).

Both `.xlsx` and `.csv` are accepted. Files are never rejected: unreadable values surface as fixable issues in the preview grid.
