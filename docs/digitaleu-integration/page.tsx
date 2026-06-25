import type { Metadata } from 'next';
import { inHouseSoftware } from '@/data/software-data';
import { InHouseSoftwareCard } from '@/components/InHouseSoftwareCard';

export const metadata: Metadata = {
  title: 'In House Software | OuDigital EU',
  description:
    'Open-source tools and desktop utilities built internally by OuDigital EU and released freely to the community.',
  openGraph: {
    title: 'In House Software | OuDigital EU',
    description:
      'Open-source tools and desktop utilities built internally by OuDigital EU and released freely to the community.',
    url: 'https://digitaleu.me/about/in-house-software',
  },
};

export default function InHouseSoftwarePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      {/* Page header */}
      <div className="mb-12">
        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
          About Us
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 dark:text-white tracking-tight mb-4">
          In House Software
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
          At OuDigital EU we build tools to solve real problems — then we open-source them.
          Everything listed here is free to use, modify, and distribute under the MIT license.
        </p>
      </div>

      {/* Software grid */}
      {inHouseSoftware.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {inHouseSoftware.map((project) => (
            <InHouseSoftwareCard key={project.slug} project={project} />
          ))}
        </div>
      ) : (
        <p className="text-neutral-500 dark:text-neutral-400">
          No software published yet — check back soon.
        </p>
      )}
    </main>
  );
}
