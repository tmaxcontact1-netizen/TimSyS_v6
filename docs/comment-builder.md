# Comment Builder

Implemented 2026-11-14 in the `feat/comment-builder` checkout based on main `f320ba2`. Not published or installed.

## Workflow

Learning → Comment Builder. This is a native React component using Principal’Ed navigation, authentication and API transport. Each authenticated user has a private workspace. Enabling the module does not grant access to another user's records, even for administrators. There are no connections to People, gradebooks, observations or report approval.

Create class → add students → configure comment bank → write comments → copy/export. Four separate quarter rosters share each class's five configurable bank categories. Empty categories are valid. New workspaces have no classes, students, selections, personalised wording or character recommendations. Generic category headings are structural labels; no default English comment library or demonstration roster is included.

The module supports class rename/deletion, student edit/deletion, names/pronouns-only quarter copying, optional skill tags, character recommendations per quarter across the user's classes, fragment substitution, personalised comments, restoring generated wording, clipboard copy/next and saved-state CSV export. CSV quotes embedded content and neutralises leading spreadsheet formula characters. Deletion confirmations explain their scope. Other modules' data is untouched.

Bank removal retains unresolved selection IDs until the user clears or replaces them. Personalised comments survive bank edits. Removed selections are visibly flagged, and clipboard copy is blocked until reviewed. CSV exports include a review column. No approval or factual inference occurs.

## Native contract

Authenticated GET `/comment-builder/access` and `/comment-builder/workspace`; POST `/comment-builder/commands`. The standard Principal’Ed backend-prefixed routes also resolve these endpoints. An enabled `comment_builder` assignment is required on every call.

Commands carry `command_id`, `expected_revision`, `action`, and action-specific fields. Supported actions: `createClass`, `renameClass`, `deleteClass`, `bank`, `addStudent`, `editStudent`, `deleteStudent`, `copyRoster`, `comment`, `target`. Class/student/option IDs are server-generated; existing option IDs are validated within their category. Deletion requires matching `confirmId`.

State is keyed by `(app_id, authenticated user_id)`, never a client-supplied owner. Reads do not create database rows. Mutation, revision increment and command receipt share a transaction. Identical retries do not apply twice. Stale revisions or reused command IDs with different payloads return 409; invalid fields return 400, missing owned records 404, disabled modules 403. The UI retains edits after errors, retries the same command on transport failure, and preserves a comparison copy when reloading after a conflict.

The one-time migration enrolls existing Principal’Ed installations without overwriting their other module choices. Fresh installation uses Builder's normal defaults. No shared-runtime or installed-database migration has been run during development.

## Local checks and assets

Harper.js 2.4.0 is vendored with its license and hashes under the component's public assets. The launcher build copies those assets alongside the compiled UI. Dynamic import and WASM URLs are absolute same-origin paths, including at `/app/principal-ed`. No Google runtime or external executable CDN is required. English grammar checks use British English, matching the supplied app; comments themselves are configurable and not subject-bound. Timeout/failure is reported without changing wording.

Original deterministic contradiction checks are retained, including explicit opposing claims and optional skill-tag conflicts. The bank check examines all cross-category option pairs, avoiding an exponential Cartesian product, and checks each option's grammar. These checks cannot establish factual accuracy and never rewrite comments.

## Verification

Four automated suites pass: domain/quarter validation; bank invalidation, personal wording and deletion; text substitution/CSV/advisory checks; full-platform HTTP ownership, authentication, persistence, module enrollment, conflict/retry behavior, native route and packaged asset serving. Run `node --test platform/modules/comment_builder/comment-builder.test.cjs` with the platform's locked dependencies installed. Test databases are disposable and removed on completion.

Production launcher build passed; existing bundle-size advice remains. `git diff --check` passed.

Browser acceptance used a random loopback port and disposable database, not the installed app. Verified empty startup, creating class/student, saving a partial bank, writing/saving/reopening comments, local grammar, personal edits, clipboard text, downloaded CSV content, removed-option warning and preservation, quarter copy, scoped student deletion, two-tab conflict and retained recovery text, bank review and class deletion returning to empty state. At 390px the document width was 390px without horizontal overflow; fields remained readable in dark mode. Tab moved from the comment to Save. The internal workspace scroll exposed the lower controls.

Trade’Ed isolation: watchdog's saved November 1 status was stale; recorded PIDs absent, no validation worker/watchdog, no listeners on 18860/18861, no running TradeEd scheduled tasks, and no recent incidents. All implementation and testing used the isolated checkout. No installed app was restarted and no release was published.
