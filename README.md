# graphile-worker-publish-lambda

## Publishing

1. Make a version bump pull request called e.g. "RELEASE 1.1.0". Update the
   version in `package.json` and `types/src/package.json`. Include a changelog
   entry.
2. From the root of the project, run `npm ci`.
3. From `types/src`, run `npm publish`. You may need to log on to GitHub to
   complete the last step of this process.
