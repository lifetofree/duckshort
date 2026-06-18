# Pull Request

## Summary

<!-- One or two sentences. Focus on the *why*, not the *what* (the diff shows that). -->

## Linked Issues

<!-- `Closes #123`, `Refs ISSUESTOFIX.md B-12`, etc. -->

## Test Plan

<!--
List the test commands you ran locally. Copy the actual test names from
the output so reviewers can grep for them later. Include any manual checks.
-->

- [ ] `npm run lint` — passes
- [ ] `npm run typecheck` — passes
- [ ] `npm test` — passes (which describe blocks?)
- [ ] `npm run test:coverage` — thresholds met
- [ ] Manual check:

## Rollback Plan

<!--
How do we undo this PR if it ships and breaks production?
- Which file / commit to revert?
- Is there a feature flag to flip instead?
- Do we need to roll back a D1 migration?
-->

## Screenshots

<!-- For UI changes, attach a dark-mode screenshot. -->

## Checklist

- [ ] Conventional commit prefix (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`)
- [ ] No secrets, API keys, or `.dev.vars` content in the diff
- [ ] Updated `ISSUESTOFIX.md` if this closes a known issue
- [ ] Updated `CHANGELOG.md` for user-facing changes
