export function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <div className="diff">
      {lines.map((l, i) => {
        let cls = "";
        if (l.startsWith("+++") || l.startsWith("---")) cls = "hunk";
        else if (l.startsWith("@@")) cls = "hunk";
        else if (l.startsWith("+")) cls = "add";
        else if (l.startsWith("-")) cls = "del";
        return (
          <div key={i} className={cls}>{l || " "}</div>
        );
      })}
    </div>
  );
}
