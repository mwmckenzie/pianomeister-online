/**
 * A note label in the overlap pass (brief decision 114): `new` until first placed (on entering
 * range, or after a seek), then `hidden` or `shown`. Shown is final until the label passes the
 * now line.
 */
export type LabelState = 'new' | 'hidden' | 'shown'
