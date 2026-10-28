# UI template usage (provided by user)

Package: `@designcodeio/threeui` (npm, v1.2.0 at time of build). React component.

```jsx
import { CompleteShelfLandingPage } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene() {
  return (
    <div className="shader-frame">
      <CompleteShelfLandingPage
        headingFont="iowan-old-style"
        bodyFont="inter"
        headingWeight="400"
        bodyWeight="400"
        primaryColor="#c87046"
        headingSize={60}
        bodySize={12}
        headingLetterSpacing={-0.055}
      />
    </div>
  );
}
```

Visual reference: "Working Volumes" Three.js book shelf (dark paper #171a24, ink #f4eee6,
copper accent #c87046, Iowan Old Style headings, Inter body, books open into a detail panel).
