import { setGlobalOptions } from 'firebase-functions/v2/options'

// Must be imported before any function file's onCall/onDocumentUpdated call —
// ES module `export ... from` declarations elsewhere in index.ts are hoisted
// and evaluate before plain statements, so setGlobalOptions has to live in
// its own module that index.ts imports first, not as a statement in index.ts.
setGlobalOptions({ region: 'asia-southeast1' })
