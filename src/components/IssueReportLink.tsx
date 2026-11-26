const REPORT_EMAIL = 'youxunzhangjim@gmail.com';

export function IssueReportLink() {
  // Query strings may contain license keys or financial inputs.
  const page = window.location.origin + window.location.pathname;
  const body = "Project / 專案: LeverLab\n\nWhat happened? / 遇到什麼問題？\n\nSteps to reproduce / 重現步驟:\n1. \n2. \n\nExpected result / 預期結果:\n\nBrowser or device / 瀏覽器或裝置:\n" + '\nPage / 頁面: ' + page;
  const href = 'mailto:' + REPORT_EMAIL
    + '?subject=' + encodeURIComponent("[LeverLab] Problem report / 問題回報")
    + '&body=' + encodeURIComponent(body);

  return (
    <a className="issue-report-link" href={href} data-issue-report
      title={'Email / 寄信至 ' + REPORT_EMAIL}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 4h16v12H9l-5 4V4Z" strokeLinejoin="round" />
        <path d="M12 7v4m0 2v1" />
      </svg>
      <span>Report · 回報問題</span>
    </a>
  );
}
