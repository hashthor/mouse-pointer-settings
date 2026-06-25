# digitaleu.me — In House Software Integration

This folder contains ready-to-use Next.js (App Router) files for adding the
**In House Software** page to the digitaleu.me website.

## Files to copy into the digitaleu.me repo

| File here | Destination in digitaleu.me repo |
|-----------|----------------------------------|
| `software-data.ts` | `src/data/software-data.ts` (or `lib/`) |
| `InHouseSoftwareCard.tsx` | `src/components/InHouseSoftwareCard.tsx` |
| `page.tsx` | `src/app/about/in-house-software/page.tsx` |

## Navigation update

In your site's navigation config or nav component, add under **About Us**:

```tsx
{ label: 'In House Software', href: '/about/in-house-software' }
```

## Updating when new tools are released

Add a new entry to `software-data.ts` — the page renders the grid automatically.
No other code changes needed.
