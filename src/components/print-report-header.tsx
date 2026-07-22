import { LogoMark, Wordmark } from "./logo";

/** Only rendered when printing — gives a spooled PDF a proper letterhead
 * instead of a bare screenshot of the dashboard. */
export function PrintReportHeader({
  title,
  generatedBy,
}: {
  title: string;
  generatedBy: string;
}) {
  return (
    <div className="mb-6 hidden border-b border-slate-300 pb-4 print:flex print:items-center print:justify-between">
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-8 w-8" />
        <div>
          <Wordmark className="text-base" />
          <p className="text-xs text-ink-500">{title}</p>
        </div>
      </div>
      <div className="text-right text-xs text-ink-500">
        <p>
          Generated{" "}
          {new Date().toLocaleString("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
        <p>By {generatedBy}</p>
      </div>
    </div>
  );
}
