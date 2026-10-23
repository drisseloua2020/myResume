import React from 'react';
import JobsWorkbench from './JobsWorkbench';
export default function JobsToApplyWorkflowPage({ onPrepareAutoApply }: { onPrepareAutoApply: () => void }) {
  return <JobsWorkbench mode="jobs" onNext={onPrepareAutoApply} />;
}
