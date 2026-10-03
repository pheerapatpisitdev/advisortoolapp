/**
 * The family at the corner of a result panel, beside the premium it is for.
 *
 * Placed over the panel rather than in its flow, so the eight calculators that share the panel
 * need no change to their layout. The photograph has a white ground, and `multiply` lets the
 * panel show through it: on a phone, where a long premium can run under the picture, the
 * figures stay readable instead of being covered by a white square.
 */
export function PanelPhoto() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/card/family.jpg"
      alt=""
      aria-hidden
      width={520}
      height={520}
      className="pointer-events-none absolute right-2 top-2 z-0 h-24 w-24 mix-blend-multiply sm:h-32 sm:w-32"
    />
  );
}
