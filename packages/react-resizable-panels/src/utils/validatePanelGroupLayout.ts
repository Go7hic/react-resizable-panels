import { isDevelopment } from "#is-development";
import { PanelConstraints } from "../Panel";
import { fuzzyNumbersEqual } from "./numbers/fuzzyNumbersEqual";
import { resizePanel } from "./resizePanel";

// All units must be in percentages; pixel values should be pre-converted
export function validatePanelGroupLayout({
  groupSizePixels,
  layout: prevLayout,
  panelConstraints,
}: {
  groupSizePixels: number;
  layout: number[];
  panelConstraints: PanelConstraints[];
}): number[] {
  const nextLayout = [...prevLayout];

  // Validate layout expectations
  if (nextLayout.length !== panelConstraints.length) {
    throw Error(
      `Invalid ${panelConstraints.length} panel layout: ${nextLayout
        .map((size) => `${size}%`)
        .join(", ")}`
    );
  } else if (
    !fuzzyNumbersEqual(
      nextLayout.reduce((accumulated, current) => accumulated + current, 0),
      100
    )
  ) {
    // This is not ideal so we should warn about it, but it may be recoverable in some cases
    // (especially if the amount is small)
    if (isDevelopment) {
      console.warn(
        `WARNING: Invalid layout total size: ${nextLayout
          .map((size) => `${size}%`)
          .join(", ")}`
      );
    }
  }

  let remainingSize = 0;

  // First pass: Validate the proposed layout given each panel's constraints
  for (let index = 0; index < panelConstraints.length; index++) {
    const unsafeSize = nextLayout[index]!;

    const safeSize = resizePanel({
      groupSizePixels,
      panelConstraints,
      panelIndex: index,
      size: unsafeSize,
    });

    if (unsafeSize != safeSize) {
      remainingSize += unsafeSize - safeSize;

      nextLayout[index] = safeSize;
    }
  }

  // If there is additional, left over space, assign it to any panel(s) that permits it
  // (It's not worth taking multiple additional passes to evenly distribute)
  if (!fuzzyNumbersEqual(remainingSize, 0)) {
    for (let index = 0; index < panelConstraints.length; index++) {
      const prevSize = nextLayout[index]!;
      const unsafeSize = prevSize + remainingSize;
      const safeSize = resizePanel({
        groupSizePixels,
        panelConstraints,
        panelIndex: index,
        size: unsafeSize,
      });

      if (prevSize !== safeSize) {
        remainingSize -= safeSize - prevSize;
        nextLayout[index] = safeSize;

        // Once we've used up the remainder, bail
        if (fuzzyNumbersEqual(remainingSize, 0)) {
          break;
        }
      }
    }
  }

  return nextLayout;
}