import Link from 'next/link';
import type { SoftwareProject } from '@/data/software-data';

interface Props {
  project: SoftwareProject;
}

export function InHouseSoftwareCard({ project }: Props) {
  return (
    <article className="group flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Screenshot / placeholder */}
      <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        {project.screenshotUrl ? (
          <img
            src={project.screenshotUrl}
            alt={`${project.name} screenshot`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl select-none" aria-hidden>🖱️</span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white leading-tight">
            {project.name}
          </h3>
          <span className="shrink-0 text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full">
            v{project.version}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed flex-1">
          {project.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Meta */}
        <div className="text-xs text-neutral-500 dark:text-neutral-500 space-y-0.5">
          <div>Platform: <span className="font-medium">{project.platform}</span></div>
          <div>License: <span className="font-medium">{project.license}</span></div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Link
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm font-medium px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            View on GitHub
          </Link>
          <Link
            href={project.releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm font-medium px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Download
          </Link>
        </div>
      </div>
    </article>
  );
}
